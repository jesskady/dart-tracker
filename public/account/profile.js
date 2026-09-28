/* Your profile. Reads the same /api/me the account bubble uses. */

(function () {
  const box = document.getElementById('profile');
  if (!box) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function avatar(user) {
    if (user.avatar_url) {
      const img = el('img', 'prof-avatar');
      img.src = user.avatar_url;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.replaceWith(initials(user)));
      return img;
    }
    return initials(user);
  }

  function initials(user) {
    const name = (user.display_name || '?').trim();
    const txt = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return el('span', 'prof-avatar acct-initials', txt || '?');
  }

  function card(title, bodyNode) {
    const c = el('section', 'prof-card');
    c.append(el('h2', null, title), bodyNode);
    return c;
  }

  function showSignedOut() {
    const a = el('a', 'prof-signin');
    a.href = '/auth/google/start?next=' + encodeURIComponent('/account/');
    a.append(el('span', 'acct-g', 'G'), document.createTextNode('Sign in with Google'));

    box.replaceChildren(
      el('p', 'prof-empty', 'Sign in to keep a history of the games you play.'),
      a
    );
  }

  function showProfile(user) {
    const head = el('div', 'prof-head');
    const id = el('div', 'prof-id');
    id.append(el('h1', null, user.display_name));
    if (user.email) id.append(el('small', null, user.email));
    head.append(avatar(user), id);

    // Nothing writes game history yet, so this says so plainly rather than
    // showing an empty table that looks broken.
    const history = el('p', 'prof-empty',
      'No games recorded yet. Finished games will appear here once history syncing is switched on.');

    box.replaceChildren(head, card('Your games', history));
  }

  fetch('/api/me', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) throw new Error('no response');
      if (!data.auth) {
        box.replaceChildren(el('p', 'prof-empty', 'Sign-in is not configured on this deployment.'));
        return;
      }
      if (data.user) showProfile(data.user);
      else showSignedOut();
    })
    .catch(() => {
      box.replaceChildren(el('p', 'prof-empty', 'Could not load your profile. Check your connection and reload.'));
    });
})();

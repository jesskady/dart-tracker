/* The account strip on the chooser.
 *
 * Signing in is optional — the games work without it — so this is written to
 * degrade quietly: if /api/me fails, or sign-in is not configured on this
 * deployment, the strip simply stays empty and nothing else is affected.
 */

(function () {
  const box = document.getElementById('account');
  if (!box) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function showSignedOut() {
    const a = el('a', 'acct-signin');
    a.href = '/auth/google/start?next=' + encodeURIComponent(location.pathname);
    a.append(el('span', 'acct-g', 'G'), document.createTextNode('Sign in with Google'));

    box.replaceChildren(a, el('p', 'acct-why', 'Optional — sign in to keep a history of your games.'));
  }

  function showSignedIn(user) {
    const who = el('div', 'acct-who');

    if (user.avatar_url) {
      const img = el('img', 'acct-avatar');
      img.src = user.avatar_url;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';   // Google blocks hotlinks with a referrer
      who.append(img);
    }
    who.append(el('b', null, user.display_name));

    const out = el('button', 'acct-signout', 'Sign out');
    out.addEventListener('click', async () => {
      out.disabled = true;
      try { await fetch('/auth/logout', { method: 'POST' }); } catch (e) { /* offline */ }
      location.reload();
    });

    box.replaceChildren(who, out);
  }

  fetch('/api/me', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.auth) return;      // sign-in not configured here
      if (data.user) showSignedIn(data.user);
      else showSignedOut();
    })
    .catch(() => { /* offline: the games still work, so say nothing */ });
})();

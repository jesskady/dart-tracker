/* The account bubble, top right of every page.
 *
 * Injects its own markup rather than expecting each page to carry it, so
 * adding a game means adding one script tag and nothing else. Signing in is
 * optional — the games work without it — so this degrades quietly: if
 * /api/me fails or sign-in is not configured, nothing appears at all.
 */

(function () {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const root = el('div', 'acct');
  root.hidden = true;                      // nothing reserves space until we know
  document.body.appendChild(root);

  const signInHref = () =>
    '/auth/google/start?next=' + encodeURIComponent(location.pathname + location.search);

  /* ---------------- signed out ---------------- */

  function renderSignedOut() {
    const a = el('a', 'acct-pill');
    a.href = signInHref();
    a.title = 'Sign in to keep a history of your games';
    a.append(el('span', 'acct-g', 'G'), el('span', 'acct-pill-text', 'Sign in'));
    root.replaceChildren(a);
    root.hidden = false;
  }

  /* ---------------- signed in ---------------- */

  function avatarNode(user, cls) {
    if (user.avatar_url) {
      const img = el('img', cls);
      img.src = user.avatar_url;
      img.alt = '';
      // Google serves profile images only to requests without a referrer
      img.referrerPolicy = 'no-referrer';
      // if the image 404s or is blocked, fall back to initials in place
      img.addEventListener('error', () => img.replaceWith(initialsNode(user, cls)));
      return img;
    }
    return initialsNode(user, cls);
  }

  function initialsNode(user, cls) {
    const name = (user.display_name || '?').trim();
    const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return el('span', cls + ' acct-initials', initials || '?');
  }

  function renderSignedIn(user) {
    const btn = el('button', 'acct-bubble');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Account menu');
    btn.append(avatarNode(user, 'acct-img'));

    const menu = el('div', 'acct-menu');
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const head = el('div', 'acct-head');
    head.append(avatarNode(user, 'acct-img-lg'));
    const who = el('div', 'acct-names');
    who.append(el('b', null, user.display_name));
    if (user.email) who.append(el('small', null, user.email));
    head.append(who);

    const profile = el('a', 'acct-item', 'Your profile');
    profile.href = '/account/';
    profile.setAttribute('role', 'menuitem');

    const out = el('button', 'acct-item acct-danger', 'Sign out');
    out.type = 'button';
    out.setAttribute('role', 'menuitem');
    out.addEventListener('click', async () => {
      out.disabled = true;
      try { await fetch('/auth/logout', { method: 'POST' }); } catch (e) { /* offline */ }
      location.reload();
    });

    menu.append(head, el('div', 'acct-sep'), profile, out);

    const setOpen = (open) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      root.classList.toggle('is-open', open);
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(menu.hidden);
    });

    // the two ways every familiar menu closes
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !root.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
    });

    root.replaceChildren(btn, menu);
    root.hidden = false;
  }

  /* ---------------- boot ---------------- */

  fetch('/api/me', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.auth) return;     // sign-in not configured on this deployment
      if (data.user) renderSignedIn(data.user);
      else renderSignedOut();
    })
    .catch(() => { /* offline: the games still work, so say nothing */ });
})();

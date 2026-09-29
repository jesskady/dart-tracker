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

  const fmtDate = (ms) =>
    new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  /* A stat only earns a tile if it has a value. Showing "Best checkout: —"
     to someone who has never checked out is noise dressed as data. */
  function tile(label, value, note) {
    if (value == null) return null;
    const t = el('div', 'stat');
    t.append(el('b', null, String(value)), el('span', null, label));
    if (note) t.append(el('small', null, note));
    return t;
  }

  function statsGrid(s) {
    const winPct = s.finished ? Math.round((s.won / s.finished) * 100) : null;

    const tiles = [
      tile('3-dart average', s.three_dart_average),
      tile('Games won', s.finished ? `${s.won}/${s.finished}` : null, winPct != null ? `${winPct}%` : null),
      tile('Best turn', s.best_turn),
      tile('Best checkout', s.best_checkout),
      tile('Best leg', s.best_leg_darts, s.best_leg_darts ? 'darts' : null),
      tile('180s', s.n180),
      tile('140+', s.n140),
      tile('100+', s.n100),
      tile('Darts thrown', s.darts),
      tile('Busts', s.busts),
    ].filter(Boolean);

    const grid = el('div', 'stat-grid');
    tiles.forEach((t) => grid.append(t));
    return grid;
  }

  function chevron() {
    const wrap = el('span', 'game-go');
    wrap.innerHTML =
      '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
      '<path d="M9 5.5 L15 12 L9 18.5" fill="none" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return wrap;
  }

  function gameRow(g) {
    const row = el('li', 'game-row');
    const unfinished = !g.ended_at;
    if (unfinished) row.classList.add('has-manage');

    const names = (g.players || []).map((p) => p.name);
    const won = g.winner_idx != null ? names[g.winner_idx] : null;
    const label = names.join(' vs ') || 'Game';

    // Both kinds of row lead somewhere now: an unfinished game back to the
    // board, a finished one to its own statistics. game_type picks the
    // resume destination, so that needs no change when a second game exists.
    const inner = el('a', 'game-inner game-link');
    inner.href = unfinished
      ? `/${encodeURIComponent(g.game_type)}/?resume=${encodeURIComponent(g.id)}`
      : `/account/game/?id=${encodeURIComponent(g.id)}`;
    inner.setAttribute('aria-label', (unfinished ? 'Resume ' : 'Statistics for ') + label);

    const main = el('div', 'game-main');
    main.append(el('b', null, label));

    const bits = [];
    if (g.config && g.config.start) bits.push(String(g.config.start));
    if (g.config && g.config.doubleIn) bits.push('double in');
    if (g.config && g.config.doubleOut) bits.push('double out');
    bits.push(g.turn_count === 1 ? '1 turn' : `${g.turn_count} turns`);
    main.append(el('small', null, bits.join(' · ')));

    const side = el('div', 'game-side');
    // an unfinished game is the useful thing to spot in this list, so it is
    // the one that gets a badge rather than the finished ones
    side.append(el('span', unfinished ? 'game-tag live' : 'game-tag',
      unfinished ? 'Resume' : (won ? `${won} won` : 'Finished')));
    side.append(el('small', null, fmtDate(g.ended_at || g.updated_at || g.started_at)));

    inner.append(main, side, chevron());
    row.append(inner);

    /* A pending row's tap resumes the game, so managing it needs its own
       target. A sibling rather than a nested link — an <a> inside an <a> is
       invalid and behaves unpredictably. Finished rows already lead here. */
    if (unfinished) {
      const manage = el('a', 'game-manage');
      manage.href = `/account/game/?id=${encodeURIComponent(g.id)}`;
      manage.setAttribute('aria-label', 'Manage ' + label);
      manage.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
        '<circle cx="5" cy="12" r="1.8" fill="currentColor"/>' +
        '<circle cx="12" cy="12" r="1.8" fill="currentColor"/>' +
        '<circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>';
      row.append(manage);
    }
    return row;
  }

  function showProfile(user) {
    const head = el('div', 'prof-head');
    const id = el('div', 'prof-id');
    id.append(el('h1', null, user.display_name));
    if (user.email) id.append(el('small', null, user.email));
    head.append(avatar(user), id);

    const statsBody = el('p', 'prof-empty', 'Loading…');
    const statsCard = card('Darts', statsBody);

    const loading = el('p', 'prof-empty', 'Loading your games…');
    box.replaceChildren(head, statsCard, card('Your games', loading));

    fetch('/api/stats?game_type=darts', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s || !s.turns) {
          statsBody.textContent = 'Play a game and your darts statistics will appear here.';
          return;
        }
        statsBody.replaceWith(statsGrid(s));
      })
      .catch(() => { statsBody.textContent = 'Could not load your statistics.'; });

    fetch('/api/games?limit=50', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const games = (data && data.games) || [];
        if (!games.length) {
          loading.textContent =
            'No games yet. Finish a game, or hit Save mid-game, and it will show up here.';
          return;
        }
        const list = el('ul', 'game-list');
        games.forEach((g) => list.append(gameRow(g)));
        loading.replaceWith(list);
      })
      .catch(() => { loading.textContent = 'Could not load your games.'; });
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

/* One game's statistics.
 *
 * Computed here rather than in SQL: /api/games/:id already returns every turn
 * for the board to be rebuilt from, so a second round trip to have the server
 * count the same rows would buy nothing. The profile's lifetime figures are
 * the opposite case and are aggregated in SQL.
 */

(function () {
  const box = document.getElementById('game');
  if (!box) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const id = new URLSearchParams(location.search).get('id');

  function card(title, body) {
    const c = el('section', 'prof-card');
    c.append(el('h2', null, title), body);
    return c;
  }

  function tile(label, value, note) {
    if (value == null) return null;
    const t = el('div', 'stat');
    t.append(el('b', null, String(value)), el('span', null, label));
    if (note) t.append(el('small', null, note));
    return t;
  }

  /* One player's figures, from their turns alone. */
  function summarise(turns) {
    let points = 0, darts = 0, busts = 0, best = 0, n180 = 0, n140 = 0, n100 = 0, checkout = null;

    for (const t of turns) {
      points += t.points;
      darts += (t.darts || []).length;
      if (t.bust) busts += 1;
      if (t.points > best) best = t.points;
      if (t.points === 180) n180 += 1;
      if (t.points >= 140) n140 += 1;
      if (t.points >= 100) n100 += 1;
      if (t.score_after === 0) checkout = t.points;
    }

    return {
      turns: turns.length, points, darts, busts, best, n180, n140, n100, checkout,
      // points per dart scaled to a three-dart turn — the standard figure
      average: darts ? Math.round((points / darts) * 3 * 10) / 10 : null,
    };
  }

  function playerCard(name, s, isMe, won) {
    const head = el('div', 'pl-head');
    head.append(el('b', null, name));
    if (isMe) head.append(el('span', 'game-tag', 'You'));
    if (won) head.append(el('span', 'game-tag live', 'Won'));

    const grid = el('div', 'stat-grid');
    [
      tile('3-dart average', s.average),
      tile('Best turn', s.turns ? s.best : null),
      tile('Checkout', s.checkout),
      tile('Turns', s.turns),
      tile('Darts', s.darts),
      tile('180s', s.n180),
      tile('140+', s.n140),
      tile('100+', s.n100),
      tile('Busts', s.busts),
    ].filter(Boolean).forEach((t) => grid.append(t));

    const wrap = el('section', 'prof-card');
    wrap.append(head, grid);
    return wrap;
  }

  /* Turn by turn, newest last, the way the leg was actually played. */
  function turnList(g, names) {
    const list = el('ol', 'turn-list');

    for (const t of g.turns) {
      const row = el('li', 'turn-row' + (t.bust ? ' is-bust' : ''));
      row.append(el('span', 'turn-who', names[t.player_idx] || '?'));
      row.append(el('span', 'turn-darts', (t.darts || []).map((d) => d.label).join(' ') || '—'));
      row.append(el('span', 'turn-pts', t.bust ? 'bust' : String(t.points)));
      row.append(el('span', 'turn-left', String(t.score_after)));
      list.append(row);
    }
    return list;
  }

  function show(g) {
    const names = (g.players || []).map((p) => p.name);
    const cfg = g.config || {};

    const head = el('div', 'prof-head');
    const idBox = el('div', 'prof-id');
    idBox.append(el('h1', null, names.join(' vs ') || 'Game'));

    const bits = [];
    if (cfg.start) bits.push(String(cfg.start));
    if (cfg.doubleIn) bits.push('double in');
    if (cfg.doubleOut) bits.push('double out');
    bits.push(new Date(g.ended_at || g.updated_at || g.started_at)
      .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
    idBox.append(el('small', null, bits.join(' · ')));
    head.append(idBox);

    const parts = [head];
    names.forEach((name, i) => {
      const mine = g.turns.filter((t) => t.player_idx === i);
      parts.push(playerCard(name, summarise(mine), i === g.me_idx, g.winner_idx === i));
    });

    if (g.turns.length) parts.push(card('Every turn', turnList(g, names)));
    box.replaceChildren(...parts);
  }

  if (!id) {
    box.replaceChildren(el('p', 'prof-empty', 'No game specified.'));
    return;
  }

  fetch('/api/games/' + encodeURIComponent(id), { headers: { accept: 'application/json' } })
    .then((r) => {
      if (r.status === 401) throw new Error('Sign in to see this game.');
      if (!r.ok) throw new Error('That game could not be found.');
      return r.json();
    })
    .then((data) => show(data.game))
    .catch((e) => {
      box.replaceChildren(el('p', 'prof-empty', e.message || 'Could not load that game.'));
    });
})();

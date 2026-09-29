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

  /* Turn by turn, newest last, the way the leg was actually played.

     Numbered by round rather than by position in this list: turn_no is each
     player's own count, so both players' entries in a round share a number,
     which is how a darts scoreboard is written. A solo game numbers 1, 2,
     3… either way. */
  function turnList(g, names) {
    const list = el('ol', 'turn-list');

    for (const t of g.turns) {
      const row = el('li', 'turn-row' + (t.bust ? ' is-bust' : ''));
      row.append(el('span', 'turn-no', String(t.turn_no + 1)));
      row.append(el('span', 'turn-who', names[t.player_idx] || '?'));
      row.append(el('span', 'turn-darts', (t.darts || []).map((d) => d.label).join(' ') || '—'));
      row.append(el('span', 'turn-pts', t.bust ? 'bust' : String(t.points)));
      row.append(el('span', 'turn-left', String(t.score_after)));
      list.append(row);
    }
    return list;
  }

  /* Correcting who the account holder was. The darts are a record of what
     happened and stay put; this only relabels whose statistics they land in,
     so the page re-renders from the server afterwards rather than guessing. */
  function whoCard(g, names) {
    const row = el('div', 'preset-row');

    names.forEach((name, i) => {
      const btn = el('button', 'seg' + (i === g.me_idx ? ' is-on' : ''), name);
      btn.type = 'button';
      btn.addEventListener('click', async () => {
        if (i === g.me_idx) return;
        [...row.children].forEach((b) => { b.disabled = true; });
        try {
          const res = await fetch('/api/games/' + encodeURIComponent(g.id), {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ me_idx: i }),
          });
          if (!res.ok) throw new Error();
          load();                       // stats are now someone else's; re-read
        } catch (e) {
          [...row.children].forEach((b) => { b.disabled = false; });
          note.textContent = 'Could not change that. Check your connection.';
        }
      });
      row.append(btn);
    });

    const wrap = el('section', 'prof-card');
    const note = el('p', 'prof-note', 'Statistics on this game count only this player’s darts.');
    wrap.append(el('h2', null, 'You were'), row, note);
    return wrap;
  }

  /* Two steps rather than a modal: the page has no confirm sheet of its own,
     and deleting a game is not something to do on a mis-tap. */
  function dangerCard(g) {
    const wrap = el('section', 'prof-card');
    wrap.append(el('h2', null, 'Delete'));

    const msg = el('p', 'prof-note', 'Removes this game and every turn in it. This cannot be undone.');
    const first = el('button', 'ghost danger-link', 'Delete this game');
    first.type = 'button';

    const confirmRow = el('div', 'confirm-row');
    confirmRow.hidden = true;
    const yes = el('button', 'danger big', 'Delete permanently');
    yes.type = 'button';
    const no = el('button', 'ghost', 'Cancel');
    no.type = 'button';
    confirmRow.append(yes, no);

    first.addEventListener('click', () => { first.hidden = true; confirmRow.hidden = false; });
    no.addEventListener('click', () => { confirmRow.hidden = true; first.hidden = false; });

    yes.addEventListener('click', async () => {
      yes.disabled = true;
      yes.textContent = 'Deleting…';
      try {
        const res = await fetch('/api/games/' + encodeURIComponent(g.id), { method: 'DELETE' });
        if (!res.ok) throw new Error();
        location.href = '/account/';
      } catch (e) {
        yes.disabled = false;
        yes.textContent = 'Delete permanently';
        msg.textContent = 'Could not delete that. Check your connection and try again.';
      }
    });

    wrap.append(msg, first, confirmRow);
    return wrap;
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

    // an unfinished game is here to be managed, but picking it back up is
    // the likelier reason to have opened it
    if (!g.ended_at) {
      const resume = el('a', 'primary big resume-link', 'Resume this game');
      resume.href = `/${encodeURIComponent(g.game_type)}/?resume=${encodeURIComponent(g.id)}`;
      parts.push(resume);
    }

    if (names.length > 1) parts.push(whoCard(g, names));
    if (g.turns.length) parts.push(card('Every turn', turnList(g, names)));
    parts.push(dangerCard(g));
    box.replaceChildren(...parts);
  }

  if (!id) {
    box.replaceChildren(el('p', 'prof-empty', 'No game specified.'));
    return;
  }

  function load() {
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
  }

  load();
})();

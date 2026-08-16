/* Dart Tracker — two-player countdown scoring */

const KEY = 'dart-tracker-v1';
const MAX_DARTS = 3;

const $ = (id) => document.getElementById(id);

let S = null;      // game state, null until a game starts
let msgTimer = null;

/* ---------------- state ---------------- */

function makePlayer(name, start, doubleIn) {
  return { name, score: start, points: 0, turns: 0, opened: !doubleIn };
}

function newGame(names, start, rules) {
  return {
    players: names.map(n => makePlayer(n, start, rules.doubleIn)),
    start,
    doubleIn: !!rules.doubleIn,
    doubleOut: !!rules.doubleOut,
    cur: 0,
    darts: [],       // {label, val}
    mode: 'darts',
    mult: 1,
    lump: '',
    log: [],         // completed turns, for undo
    over: false
  };
}

function save() {
  try {
    if (S) localStorage.setItem(KEY, JSON.stringify(S));
    else localStorage.removeItem(KEY);
  } catch (e) { /* private mode, ignore */ }
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); }
  catch (e) { return null; }
}

/* ---------------- messages ---------------- */

function say(text, ms = 2600) {
  $('msg').textContent = text;
  clearTimeout(msgTimer);
  if (text) msgTimer = setTimeout(() => { $('msg').textContent = ''; }, ms);
}

/* ---------------- setup screen ---------------- */

function buildSetup() {
  const scorePresets = document.querySelectorAll('#presets .preset');
  scorePresets.forEach(btn => {
    btn.addEventListener('click', () => {
      scorePresets.forEach(b => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      $('startScore').value = btn.dataset.score;
    });
  });

  $('startScore').addEventListener('input', () => {
    scorePresets.forEach(b => {
      b.classList.toggle('is-on', b.dataset.score === $('startScore').value);
    });
  });

  // two-player vs solo practice
  let playerCount = 2;
  const modeBtns = document.querySelectorAll('#modeRow .preset');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      playerCount = parseInt(btn.dataset.players, 10);
      $('field2').classList.toggle('hidden', playerCount === 1);
      $('label1').textContent = playerCount === 1 ? 'Name' : 'Player 1';
      $('name1').placeholder = playerCount === 1 ? 'You' : 'Player 1';
    });
  });

  const toggles = {};
  ['doubleIn', 'doubleOut'].forEach(id => {
    const btn = $(id);
    toggles[id] = btn;
    btn.addEventListener('click', () => {
      const on = !btn.classList.contains('is-on');
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', String(on));
    });
  });

  $('startBtn').addEventListener('click', () => {
    const start = parseInt($('startScore').value, 10);
    if (!Number.isFinite(start) || start < 2) {
      $('startScore').focus();
      return;
    }
    const names = playerCount === 1
      ? [$('name1').value.trim() || 'You']
      : [$('name1').value.trim() || 'Player 1', $('name2').value.trim() || 'Player 2'];

    S = newGame(names, start, {
      doubleIn: toggles.doubleIn.classList.contains('is-on'),
      doubleOut: toggles.doubleOut.classList.contains('is-on')
    });
    save();
    showGame();
  });

  const saved = load();
  if (saved && !saved.over) {
    const btn = $('resumeBtn');
    btn.textContent = 'Resume: ' + saved.players.map(p => p.name).join(' vs ');
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => {
      S = saved;
      showGame();
    });
  }
}

/* ---------------- game board ---------------- */

function buildBoard() {
  // 1-20 number grid
  const grid = $('numgrid');
  for (let n = 1; n <= 20; n++) {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = n;
    b.addEventListener('click', () => addDart(n));
    grid.appendChild(b);
  }

  // lump-sum keypad
  const pad = $('keypad');
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','C'];
  keys.forEach(k => {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = k;
    b.addEventListener('click', () => lumpKey(k));
    pad.appendChild(b);
  });

  // multiplier
  document.querySelectorAll('.mult').forEach(b => {
    b.addEventListener('click', () => {
      S.mult = parseInt(b.dataset.m, 10);
      render();
    });
  });

  // mode tabs
  document.querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => {
      if (S.mode === b.dataset.mode) return;
      S.mode = b.dataset.mode;
      S.darts = [];          // the two entry methods don't mix
      S.lump = '';
      S.mult = 1;
      render();
      save();
    });
  });

  document.querySelector('[data-bull]').addEventListener('click', () => addDart(25, true));
  document.querySelector('[data-miss]').addEventListener('click', () => addDart(0));
  $('undoDart').addEventListener('click', undoDart);
  $('submitBtn').addEventListener('click', submitTurn);
  $('undoTurn').addEventListener('click', undoTurn);

  $('quitBtn').addEventListener('click', () => {
    if (S.log.length && !confirm('End this game and return to setup?')) return;
    S = null; save(); location.reload();
  });

  $('rematchBtn').addEventListener('click', () => {
    S = newGame(S.players.map(p => p.name), S.start,
                { doubleIn: S.doubleIn, doubleOut: S.doubleOut });
    save();
    $('winOverlay').classList.add('hidden');
    render();
  });

  $('newBtn').addEventListener('click', () => { S = null; save(); location.reload(); });

  // tapping a player card switches whose turn it is (fixes mis-taps)
  [0, 1].forEach(i => {
    $('p' + i).addEventListener('click', () => {
      if (S.over || S.cur === i || S.players.length < 2) return;
      if (S.darts.length || S.lump) { say('Clear the current turn first'); return; }
      S.cur = i;
      render(); save();
    });
  });
}

function showGame() {
  $('setup').classList.add('hidden');
  $('game').classList.remove('hidden');
  render();
}

/* ---------------- dart entry ---------------- */

function addDart(n, isBull = false) {
  if (S.over) return;
  if (S.darts.length >= MAX_DARTS) { say('3 darts thrown — submit the turn'); return; }

  let m = S.mult;
  if (isBull && m === 3) { say('No triple bull'); return; }
  if (n === 0) m = 1;

  const val = n * m;
  const prefix = n === 0 ? '' : (m === 2 ? 'D' : m === 3 ? 'T' : '');
  const label = n === 0 ? 'miss' : prefix + n;

  // dbl is what the double-out rule checks on the winning dart
  S.darts.push({ label, val, dbl: m === 2 && n > 0 });
  S.mult = 1;                       // multiplier applies to one dart only
  render(); save();
}

function undoDart() {
  if (!S.darts.length) return;
  S.darts.pop();
  render(); save();
}

function lumpKey(k) {
  if (S.over) return;
  if (k === 'C') S.lump = '';
  else if (k === '⌫') S.lump = S.lump.slice(0, -1);
  else if (S.lump.length < 3) S.lump = (S.lump + k).replace(/^0+(?=\d)/, '');
  render(); save();
}

/* Where a turn of `pts` leaves the current player, and whether it's legal.
   Shared by the live projection, the submit button and submitTurn itself. */
function outcome(pts) {
  const left = S.players[S.cur].score - pts;

  if (left < 0) return { left, bust: true, win: false, why: 'overshot' };

  if (S.doubleOut) {
    if (left === 1) return { left, bust: true, win: false, why: 'left 1' };
    if (left === 0 && S.mode === 'darts') {
      const last = S.darts[S.darts.length - 1];
      if (!last || !last.dbl) {
        return { left, bust: true, win: false, why: 'no double to finish' };
      }
    }
  }

  return { left, bust: false, win: left === 0, why: '' };
}

/* Splits the turn in progress into what actually scores and what doesn't.
   Under double-in, darts thrown before the opening double are shown but
   score nothing. `open` is the player's state once the turn is applied. */
function breakdown() {
  const p = S.players[S.cur];

  if (S.mode === 'total') {
    const raw = parseInt(S.lump, 10) || 0;
    // no record of individual darts, so a scoring total is taken to have opened
    return { pts: raw, counted: [], open: p.opened || raw > 0 };
  }

  let open = p.opened;
  let pts = 0;
  const counted = [];

  for (const d of S.darts) {
    if (!open) {
      if (!d.dbl) { counted.push(false); continue; }  // still not in
      open = true;
    }
    counted.push(true);
    pts += d.val;
  }

  return { pts, counted, open };
}

function turnPoints() {
  return breakdown().pts;
}

/* ---------------- turn resolution ---------------- */

function submitTurn() {
  if (S.over) return;

  const { pts, open } = breakdown();
  if (pts > 180) { say('Max 180 in three darts'); return; }
  if (S.mode === 'total' && S.lump === '') { say('Enter a score, or use the Darts pad'); return; }

  const p = S.players[S.cur];
  const before = p.score;
  const wasOpen = p.opened;
  const { left, bust, win, why } = outcome(pts);

  S.log.push({
    player: S.cur,
    before,
    wasOpen,
    pts,
    bust,
    darts: S.darts.slice(),
    lump: S.lump,
    mode: S.mode
  });

  p.turns += 1;
  p.opened = open;              // a landed double opens you even if the turn busts
  if (!bust) {
    p.score = left;
    p.points += pts;
  }

  S.darts = [];
  S.lump = '';
  S.mult = 1;

  if (win) {
    S.over = true;
    S.winner = S.cur;
    render(); save();
    showWin(p);
    return;
  }

  if (bust) say(`Bust — ${why}. ${p.name} stays on ${before}`);
  else if (S.doubleIn && !wasOpen && open) say(`${p.name} is in`);
  else if (S.doubleIn && !open) say(`${p.name} still needs a double to open`);

  if (S.players.length > 1) S.cur = 1 - S.cur;
  render(); save();
}

function undoTurn() {
  if (!S.log.length) { say('Nothing to undo'); return; }

  // an in-progress turn is discarded first
  if (S.darts.length || S.lump) {
    S.darts = []; S.lump = ''; S.mult = 1;
    render(); save();
    say('Current turn cleared');
    return;
  }

  const last = S.log.pop();
  const p = S.players[last.player];
  p.score = last.before;
  p.turns -= 1;
  if (last.wasOpen !== undefined) p.opened = last.wasOpen;
  if (!last.bust) p.points -= last.pts;

  S.cur = last.player;
  S.over = false;
  S.winner = undefined;
  $('winOverlay').classList.add('hidden');

  render(); save();
  say(`Undid ${p.name}'s ${last.pts}`);
}

function showWin(p) {
  const solo = S.players.length === 1;
  const avg = p.turns ? (p.points / p.turns).toFixed(1) : '0';
  $('winName').textContent = solo ? `${p.name} checked out!` : `${p.name} wins!`;
  $('winStats').textContent = `${S.start} down in ${p.turns} turns · ${avg} average`;
  $('rematchBtn').textContent = solo ? 'Go again' : 'Rematch';
  $('winOverlay').classList.remove('hidden');
}

/* ---------------- render ---------------- */

function render() {
  if (!S) return;

  const { pts, counted } = breakdown();
  const solo = S.players.length === 1;
  const p0 = S.players[S.cur];

  // rule badges; double-in turns red until the player has opened
  $('badges').classList.toggle('hidden', !S.doubleIn && !S.doubleOut);
  $('bIn').classList.toggle('hidden', !S.doubleIn);
  $('bOut').classList.toggle('hidden', !S.doubleOut);
  if (S.doubleIn) {
    const needs = !p0.opened && !S.over;
    $('bIn').classList.toggle('alert', needs);
    $('bIn').textContent = needs ? `${p0.name} needs a double to open` : 'Double in';
  }

  // scoreboard
  $('scoreboard').classList.toggle('solo', solo);
  $('p1').classList.toggle('hidden', solo);

  S.players.forEach((p, i) => {
    const el = $('p' + i);
    const isTurn = i === S.cur && !S.over;
    el.classList.toggle('active', isTurn);
    el.querySelector('.pname').textContent = p.name;
    el.querySelector('.pnum').textContent = p.score;

    // live projection of where this turn leaves them
    const pend = el.querySelector('.ppend');
    el.classList.toggle('pending', isTurn && pts > 0);
    pend.classList.remove('bust', 'checkout');
    if (isTurn && pts > 0) {
      const o = outcome(pts);
      if (o.bust) {
        pend.textContent = '→ bust';
        pend.classList.add('bust');
      } else {
        pend.textContent = '→ ' + o.left;
        if (o.win) pend.classList.add('checkout');
      }
    }

    const avg = p.turns ? (p.points / p.turns).toFixed(1) : '—';
    el.querySelector('.pmeta').textContent = `${p.turns} turns · avg ${avg}`;
  });

  // dart slots (hidden when entering a lump sum)
  document.querySelector('.turnbar').classList.toggle('lump', S.mode === 'total');
  const slots = $('dartSlots');
  slots.innerHTML = '';
  for (let i = 0; i < MAX_DARTS; i++) {
    const d = S.darts[i];
    const el = document.createElement('div');
    // counted[i] === false means it landed before the double-in and scores nothing
    el.className = 'slot' + (d ? (counted[i] === false ? ' filled void' : ' filled') : '');
    el.textContent = d ? d.label : '–';
    slots.appendChild(el);
  }

  $('turnTotal').textContent = pts;
  $('lumpValue').textContent = S.lump === '' ? '0' : S.lump;

  // multiplier + tabs
  document.querySelectorAll('.mult').forEach(b => {
    b.classList.toggle('is-on', parseInt(b.dataset.m, 10) === S.mult);
  });
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('is-on', b.dataset.mode === S.mode);
  });
  $('dartsPad').classList.toggle('hidden', S.mode !== 'darts');
  $('totalPad').classList.toggle('hidden', S.mode !== 'total');

  // submit button
  const btn = $('submitBtn');
  const o = outcome(pts);
  if (S.over) {
    btn.textContent = 'Game over';
  } else if (pts > 0 && o.bust) {
    btn.textContent = `Submit ${pts} — bust`;
  } else if (o.win) {
    btn.textContent = `Submit ${pts} — checkout!`;
  } else {
    btn.textContent = solo ? `Submit ${pts}` : `Submit ${pts} for ${p0.name}`;
  }
}

/* ---------------- boot ---------------- */

buildSetup();
buildBoard();

/* Dart Tracker — two-player countdown scoring */

const KEY = 'dart-tracker-v1';
const MAX_DARTS = 3;

const $ = (id) => document.getElementById(id);

let S = null;      // game state, null until a game starts
let msgTimer = null;

/* ---------------- state ---------------- */

function newGame(name1, name2, start) {
  return {
    players: [
      { name: name1, score: start, points: 0, turns: 0 },
      { name: name2, score: start, points: 0, turns: 0 }
    ],
    start,
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
  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset').forEach(b => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      $('startScore').value = btn.dataset.score;
    });
  });

  $('startScore').addEventListener('input', () => {
    document.querySelectorAll('.preset').forEach(b => {
      b.classList.toggle('is-on', b.dataset.score === $('startScore').value);
    });
  });

  $('startBtn').addEventListener('click', () => {
    const n1 = $('name1').value.trim() || 'Player 1';
    const n2 = $('name2').value.trim() || 'Player 2';
    const start = parseInt($('startScore').value, 10);
    if (!Number.isFinite(start) || start < 2) {
      $('startScore').focus();
      return;
    }
    S = newGame(n1, n2, start);
    save();
    showGame();
  });

  const saved = load();
  if (saved && !saved.over) {
    const btn = $('resumeBtn');
    btn.textContent = `Resume: ${saved.players[0].name} vs ${saved.players[1].name}`;
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
    S = newGame(S.players[0].name, S.players[1].name, S.start);
    save();
    $('winOverlay').classList.add('hidden');
    render();
  });

  $('newBtn').addEventListener('click', () => { S = null; save(); location.reload(); });

  // tapping a player card switches whose turn it is (fixes mis-taps)
  [0, 1].forEach(i => {
    $('p' + i).addEventListener('click', () => {
      if (S.over || S.cur === i) return;
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

  S.darts.push({ label, val });
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

function turnPoints() {
  return S.mode === 'darts'
    ? S.darts.reduce((a, d) => a + d.val, 0)
    : (parseInt(S.lump, 10) || 0);
}

/* ---------------- turn resolution ---------------- */

function submitTurn() {
  if (S.over) return;

  const pts = turnPoints();
  if (pts > 180) { say('Max 180 in three darts'); return; }
  if (S.mode === 'total' && S.lump === '') { say('Enter a score, or use the Darts pad'); return; }

  const p = S.players[S.cur];
  const before = p.score;
  const after = before - pts;
  const bust = after < 0;

  S.log.push({
    player: S.cur,
    before,
    pts,
    bust,
    darts: S.darts.slice(),
    lump: S.lump,
    mode: S.mode
  });

  p.turns += 1;
  if (!bust) {
    p.score = after;
    p.points += pts;
  }

  S.darts = [];
  S.lump = '';
  S.mult = 1;

  if (!bust && after === 0) {
    S.over = true;
    S.winner = S.cur;
    render(); save();
    showWin(p);
    return;
  }

  if (bust) say(`Bust! ${p.name} stays on ${before}`);
  S.cur = 1 - S.cur;
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
  if (!last.bust) p.points -= last.pts;

  S.cur = last.player;
  S.over = false;
  S.winner = undefined;
  $('winOverlay').classList.add('hidden');

  render(); save();
  say(`Undid ${p.name}'s ${last.pts}`);
}

function showWin(p) {
  const avg = p.turns ? (p.points / p.turns).toFixed(1) : '0';
  $('winName').textContent = `${p.name} wins!`;
  $('winStats').textContent = `${p.turns} turns · ${avg} average`;
  $('winOverlay').classList.remove('hidden');
}

/* ---------------- render ---------------- */

function render() {
  if (!S) return;

  // scoreboard
  S.players.forEach((p, i) => {
    const el = $('p' + i);
    el.classList.toggle('active', i === S.cur && !S.over);
    el.querySelector('.pname').textContent = p.name;
    el.querySelector('.pscore').textContent = p.score;
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
    el.className = 'slot' + (d ? ' filled' : '');
    el.textContent = d ? d.label : '–';
    slots.appendChild(el);
  }

  const pts = turnPoints();
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
  const p = S.players[S.cur];
  const btn = $('submitBtn');
  if (S.over) {
    btn.textContent = 'Game over';
  } else if (pts > p.score) {
    btn.textContent = `Submit ${pts} — bust`;
  } else if (pts === p.score && pts > 0) {
    btn.textContent = `Submit ${pts} — checkout!`;
  } else {
    btn.textContent = `Submit ${pts} for ${p.name}`;
  }
}

/* ---------------- boot ---------------- */

buildSetup();
buildBoard();

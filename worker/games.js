/* Game history.
 *
 * A game is written whole: the client sends the game, its players and every
 * turn so far, and this upserts the lot. That suits both callers — the button
 * that saves an unfinished game and the automatic write when one is won — and
 * it means a failed save is simply retried rather than reconciled.
 *
 * The client chooses the game id, which is what makes a retry idempotent.
 * Turns are keyed by where they sit in the game, so resending a turn updates
 * it instead of duplicating it.
 */

import { currentUserId } from './auth.js';

/* Free-tier D1 allows 50 queries per Worker invocation and 100 bound
   parameters per query. Turns therefore go up in multi-row inserts of ten
   (80 parameters), which keeps even a long 701 leg to a handful of
   statements rather than one per turn. */
const TURNS_PER_STATEMENT = 10;
const MAX_TURNS = 400;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const isInt = (v) => Number.isInteger(v);
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);

/* ---------------- validation ---------------- */

/* Rejects anything malformed rather than letting SQLite decide. The payload
   comes from a browser, so it is untrusted even when the session is valid. */
function validate(body) {
  if (!body || typeof body !== 'object') return 'not an object';

  if (!str(body.id, 64)) return 'id';
  if (!str(body.game_type, 32)) return 'game_type';
  if (!isInt(body.started_at)) return 'started_at';
  if (body.ended_at != null && !isInt(body.ended_at)) return 'ended_at';
  if (body.winner_idx != null && !isInt(body.winner_idx)) return 'winner_idx';

  if (!Array.isArray(body.players) || body.players.length < 1 || body.players.length > 8) return 'players';
  for (const p of body.players) {
    if (!isInt(p.idx) || p.idx < 0 || p.idx > 7) return 'player.idx';
    if (!str(p.name, 40)) return 'player.name';
  }

  if (!Array.isArray(body.turns)) return 'turns';
  if (body.turns.length > MAX_TURNS) return 'too many turns';
  for (const t of body.turns) {
    if (!isInt(t.player_idx) || t.player_idx < 0 || t.player_idx > 7) return 'turn.player_idx';
    if (!isInt(t.turn_no) || t.turn_no < 0) return 'turn.turn_no';
    if (!isInt(t.points)) return 'turn.points';
    if (!isInt(t.score_after)) return 'turn.score_after';
    if (!isInt(t.created_at)) return 'turn.created_at';
    if (!Array.isArray(t.darts) || t.darts.length > 3) return 'turn.darts';
  }

  return null;
}

/* ---------------- write ---------------- */

export async function saveGame(request, env) {
  const uid = await currentUserId(request, env);
  if (!uid) return json({ error: 'Not signed in' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const bad = validate(body);
  if (bad) return json({ error: `Invalid payload: ${bad}` }, 400);

  // A game id is chosen by the client, so it could name someone else's row.
  // Refuse rather than overwrite.
  const owner = await env.DB.prepare('SELECT owner_user_id FROM games WHERE id = ?')
    .bind(body.id).first();
  if (owner && owner.owner_user_id !== uid) return json({ error: 'Not your game' }, 403);

  const now = Date.now();
  const config = JSON.stringify(body.config ?? {});
  const stmts = [];

  stmts.push(
    env.DB.prepare(
      `INSERT INTO games (id, owner_user_id, game_type, config, started_at, ended_at, winner_idx, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         config = excluded.config,
         ended_at = excluded.ended_at,
         winner_idx = excluded.winner_idx,
         updated_at = excluded.updated_at`
    ).bind(body.id, uid, body.game_type, config, body.started_at,
           body.ended_at ?? null, body.winner_idx ?? null, now)
  );

  for (const p of body.players) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO game_players (game_id, idx, name, user_id) VALUES (?, ?, ?, ?)
         ON CONFLICT(game_id, idx) DO UPDATE SET name = excluded.name`
      ).bind(body.id, p.idx, p.name, null)
    );
  }

  for (let i = 0; i < body.turns.length; i += TURNS_PER_STATEMENT) {
    const chunk = body.turns.slice(i, i + TURNS_PER_STATEMENT);
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const binds = [];
    for (const t of chunk) {
      binds.push(
        crypto.randomUUID(), body.id, t.player_idx, t.turn_no,
        JSON.stringify(t.darts), t.points, t.bust ? 1 : 0, t.score_after, t.created_at
      );
    }
    stmts.push(
      env.DB.prepare(
        `INSERT INTO turns (id, game_id, player_idx, turn_no, darts, points, bust, score_after, created_at)
         VALUES ${values}
         ON CONFLICT(game_id, player_idx, turn_no) DO UPDATE SET
           darts = excluded.darts,
           points = excluded.points,
           bust = excluded.bust,
           score_after = excluded.score_after`
      ).bind(...binds)
    );
  }

  await env.DB.batch(stmts);
  return json({ ok: true, id: body.id, statements: stmts.length, updated_at: now });
}

/* ---------------- read ---------------- */

/* Summaries for the profile and for the resume list. Turns are counted rather
   than returned: the list never needs the darts, and a user with a hundred
   games would otherwise pull every throw they have ever made. */
export async function listGames(request, env, url) {
  const uid = await currentUserId(request, env);
  if (!uid) return json({ error: 'Not signed in' }, 401);

  const unfinishedOnly = url.searchParams.get('state') === 'unfinished';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  const rows = await env.DB.prepare(
    `SELECT g.id, g.game_type, g.config, g.started_at, g.ended_at, g.winner_idx, g.updated_at,
            (SELECT COUNT(*) FROM turns t WHERE t.game_id = g.id) AS turn_count,
            (SELECT json_group_array(json_object('idx', p.idx, 'name', p.name))
               FROM (SELECT idx, name FROM game_players WHERE game_id = g.id ORDER BY idx) p
            ) AS players
       FROM games g
      WHERE g.owner_user_id = ?
        ${unfinishedOnly ? 'AND g.ended_at IS NULL' : ''}
      ORDER BY COALESCE(g.ended_at, g.updated_at) DESC
      LIMIT ?`
  ).bind(uid, limit).all();

  return json({ games: (rows.results || []).map(shape) });
}

/* Everything needed to put a game back on the board. */
export async function getGame(request, env, id) {
  const uid = await currentUserId(request, env);
  if (!uid) return json({ error: 'Not signed in' }, 401);

  const game = await env.DB.prepare(
    `SELECT id, owner_user_id, game_type, config, started_at, ended_at, winner_idx, updated_at
       FROM games WHERE id = ?`
  ).bind(id).first();

  if (!game || game.owner_user_id !== uid) return json({ error: 'Not found' }, 404);

  const players = await env.DB.prepare(
    'SELECT idx, name FROM game_players WHERE game_id = ? ORDER BY idx'
  ).bind(id).all();

  const turns = await env.DB.prepare(
    `SELECT player_idx, turn_no, darts, points, bust, score_after, created_at
       FROM turns WHERE game_id = ? ORDER BY turn_no, player_idx`
  ).bind(id).all();

  delete game.owner_user_id;
  return json({
    game: {
      ...game,
      config: parse(game.config, {}),
      players: players.results || [],
      turns: (turns.results || []).map((t) => ({ ...t, darts: parse(t.darts, []), bust: !!t.bust })),
    },
  });
}

export async function deleteGame(request, env, id) {
  const uid = await currentUserId(request, env);
  if (!uid) return json({ error: 'Not signed in' }, 401);

  // scoped by owner, so a guessed id cannot delete someone else's game
  const res = await env.DB.prepare('DELETE FROM games WHERE id = ? AND owner_user_id = ?')
    .bind(id, uid).run();

  if (!res.meta || res.meta.changes === 0) return json({ error: 'Not found' }, 404);
  return json({ ok: true });
}

/* ---------------- helpers ---------------- */

function parse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function shape(row) {
  return {
    id: row.id,
    game_type: row.game_type,
    config: parse(row.config, {}),
    players: parse(row.players, []),
    started_at: row.started_at,
    ended_at: row.ended_at,
    winner_idx: row.winner_idx,
    updated_at: row.updated_at,
    turn_count: row.turn_count,
  };
}

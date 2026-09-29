/* Darts statistics for the signed-in player.
 *
 * Aggregated in SQL rather than by shipping every turn to the browser: a
 * player with a few hundred games would otherwise download every dart they
 * have ever thrown to show eight numbers.
 *
 * Everything here is scoped to the account holder's own turns —
 * `t.player_idx = g.me_idx` — so an opponent's 180 never lands in your stats.
 */

import { currentUserId } from './auth.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function getStats(request, env, url) {
  const uid = await currentUserId(request, env);
  if (!uid) return json({ error: 'Not signed in' }, 401);

  const gameType = url.searchParams.get('game_type') || 'darts';

  /* Turn-level totals. json_array_length counts the darts actually thrown,
     which matters: a leg won on the second dart of a turn must not be
     charged for a third that was never thrown, or averages come out low. */
  const turns = await env.DB.prepare(
    `SELECT
       COUNT(*)                                            AS turns,
       COALESCE(SUM(t.points), 0)                          AS points,
       COALESCE(SUM(json_array_length(t.detail)), 0)        AS darts,
       COALESCE(MAX(t.points), 0)                          AS best_turn,
       COALESCE(SUM(CASE WHEN t.points = 180 THEN 1 ELSE 0 END), 0)   AS n180,
       COALESCE(SUM(CASE WHEN t.points >= 140 THEN 1 ELSE 0 END), 0)  AS n140,
       COALESCE(SUM(CASE WHEN t.points >= 100 THEN 1 ELSE 0 END), 0)  AS n100,
       COALESCE(SUM(t.bust), 0)                            AS busts,
       MAX(CASE WHEN t.score_after = 0 THEN t.points END)  AS best_checkout
     FROM turns t
     JOIN games g ON g.id = t.game_id
     WHERE g.owner_user_id = ? AND g.game_type = ? AND t.player_idx = g.me_idx`
  ).bind(uid, gameType).first();

  const games = await env.DB.prepare(
    `SELECT
       COUNT(*)                                                          AS games,
       COALESCE(SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS finished,
       COALESCE(SUM(CASE WHEN ended_at IS NOT NULL AND winner_idx = me_idx THEN 1 ELSE 0 END), 0) AS won
     FROM games
     WHERE owner_user_id = ? AND game_type = ?`
  ).bind(uid, gameType).first();

  /* Fewest darts taken to win a leg. Restricted to games actually won, so an
     abandoned game cannot masquerade as a spectacular one. */
  const bestLeg = await env.DB.prepare(
    `SELECT MIN(d) AS best_leg FROM (
       SELECT SUM(json_array_length(t.detail)) AS d
         FROM turns t
         JOIN games g ON g.id = t.game_id
        WHERE g.owner_user_id = ? AND g.game_type = ?
          AND g.ended_at IS NOT NULL AND g.winner_idx = g.me_idx
          AND t.player_idx = g.me_idx
        GROUP BY g.id
     )`
  ).bind(uid, gameType).first();

  const darts = turns.darts || 0;

  return json({
    game_type: gameType,
    games: games.games || 0,
    finished: games.finished || 0,
    won: games.won || 0,
    turns: turns.turns || 0,
    darts,
    points: turns.points || 0,
    // the standard darts figure: points per dart, scaled to a three-dart turn
    three_dart_average: darts ? Math.round((turns.points / darts) * 3 * 10) / 10 : null,
    best_turn: turns.turns ? turns.best_turn : null,
    best_checkout: turns.best_checkout ?? null,
    best_leg_darts: bestLeg ? bestLeg.best_leg : null,
    n180: turns.n180 || 0,
    n140: turns.n140 || 0,
    n100: turns.n100 || 0,
    busts: turns.busts || 0,
  });
}

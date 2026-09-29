/* Request router.
 *
 * Almost everything here is static: the games live in public/ and are served
 * straight from the asset store. This Worker exists for the www redirect and
 * for the handful of /auth and /api routes behind sign-in.
 */

import { authConfigured, startGoogle, callbackGoogle, logout, me } from './auth.js';
import { saveGame, listGames, getGame, deleteGame } from './games.js';
import { getStats } from './stats.js';

const CANONICAL = 'scorechalk.com';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.' + CANONICAL) {
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/me') {
      // Deliberately not an error when auth is unconfigured: the site is
      // usable signed out, so "nobody is signed in" is the honest answer.
      if (!authConfigured(env)) return json({ user: null, auth: false });
      return json({ ...(await me(request, env)), auth: true });
    }

    if (url.pathname === '/api/stats') {
      if (!authConfigured(env)) return json({ error: 'Sign-in is not configured.' }, 503);
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return getStats(request, env, url);
    }

    if (url.pathname === '/api/games') {
      if (!authConfigured(env)) return json({ error: 'Sign-in is not configured.' }, 503);
      if (request.method === 'POST') return saveGame(request, env);
      if (request.method === 'GET') return listGames(request, env, url);
      return json({ error: 'Method not allowed' }, 405);
    }

    const game = url.pathname.match(/^\/api\/games\/([A-Za-z0-9_-]{1,64})$/);
    if (game) {
      if (!authConfigured(env)) return json({ error: 'Sign-in is not configured.' }, 503);
      if (request.method === 'GET') return getGame(request, env, game[1]);
      if (request.method === 'DELETE') return deleteGame(request, env, game[1]);
      return json({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname.startsWith('/auth/')) {
      if (!authConfigured(env)) {
        return json({ error: 'Sign-in is not configured on this deployment.' }, 503);
      }
      if (url.pathname === '/auth/google/start') return startGoogle(request, env, url);
      if (url.pathname === '/auth/google/callback') return callbackGoogle(request, env, url);
      if (url.pathname === '/auth/logout' && request.method === 'POST') return logout(url);
      return json({ error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

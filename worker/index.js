/* Request router.
 *
 * Almost everything here is static: the games live in public/ and are served
 * straight from the asset store. This Worker exists for the www redirect and
 * for the handful of /auth and /api routes behind sign-in.
 */

import { authConfigured, startGoogle, callbackGoogle, logout, me } from './auth.js';

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

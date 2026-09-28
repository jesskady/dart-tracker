/* The site is static and this Worker exists for exactly one reason: to send
   www.scorechalk.com to the apex. Everything else is handed straight to the
   asset store, which applies the same not_found_handling it would on its own. */

const CANONICAL = 'scorechalk.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.' + CANONICAL) {
      url.hostname = CANONICAL;
      // 301: the apex is permanent, and browsers may cache it freely
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};

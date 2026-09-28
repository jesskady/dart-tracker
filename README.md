# 🎯 Score Chalk

Mobile-first scorekeeping for the games I play. The home page is a chooser; each game is a self-contained page under it. No build step, no dependencies, no framework — just static files.

**Darts** is the first one: countdown scoring (501, 301, or any starting score you like), head to head or solo for practice.

## Use it

Live: **https://scorechalk.com**

Add it to your phone's home screen for a full-screen app feel.

## How it works

**Setup** — choose **Two player** or **Practice**, enter the name(s), pick a starting score (301 / 501 / 701, or type your own), and optionally switch on **Double in** and **Double out**.

**Scoring** — tap `Single` / `Double` / `Triple`, then a number `1`–`20`. Tapping *Double* then *20* records `D20` = 40. The multiplier applies to one dart and resets to Single afterwards. `Bull` scores 25 (50 with Double selected) and `Miss` scores 0. Up to three darts per turn.

Then hit **Submit turn** to subtract it and pass play to the other player.

### Checkout suggestions

When the score can be finished with the darts left in the turn, the bar under the turn strip shows how — `T20 · T19 · D12` for 141. It re-solves after every dart, so with two darts left on 81 it shows `T19 · D12`, and with one left on 24 it shows `D12`. It follows the double rules: with **Double out** on, the last dart shown is always a double, and with **Double in** on and the player not yet open, the first one is.

If the score is low enough to be finishable in principle but has no path — the bogey numbers 169, 168, 166, 165, 163, 162 and 159 — it says so instead. Above that, where no finish is on yet, the bar says so quietly rather than sitting blank.

When a number has more than one route, an arrow on the right pages to the next one, and a back arrow appears once you've paged over. Only routes using the same number of darts are offered — if a leg closes in one dart, three-dart paths to it aren't alternatives — and routes differing only in the order of their setup darts are treated as one. The first suggestion is always the chart answer; paging is there for when you'd rather leave yourself a different double.

The suggestions are searched, not looked up in a table: the board only has 62 distinct throws, so every route is enumerated and ranked by what a player would actually choose (aim big first, avoid setting up on a double or the bull, finish on a friendly double). This reproduces the standard checkout chart — 170 as `T20 T20 Bull`, 141 as `T20 T19 D12`, 60 as `20 D20` — while adapting to darts remaining and the rule switches, which a fixed table couldn't.

### Practice mode

Pick **Practice** in setup for a solo game: one wide score card, no turn switching, and the same rules and stats as a two-player game. Useful for timing how many turns a 501 takes you and watching your three-dart average.

## Rules it enforces

- Turn totals are capped at 180.
- Going below zero is a **bust** — the score is left untouched and the turn passes.
- Landing exactly on zero wins.

Both optional rules below are off by default, and each shows a badge during the game when it's on.

### Double in

Nothing scores until you **open with a double**. Darts thrown before that still appear in the turn, struck through, and add nothing. The badge names whoever still needs to open, and once a double lands you're in for the rest of the game — including if that same turn later busts.

### Double out

Two extra rules:

- The **winning dart must be a double** — `D1`–`D20`, or the double bull (`Bull` with `Double` selected, 50). Reaching zero any other way is a bust.
- **Leaving exactly 1 is a bust**, since there's no double that finishes from there.

Because every turn is entered dart by dart, both rules are checked against the actual throws rather than taken on trust.

## Other bits

- A smaller **projected score** appears next to the active player's total as you enter darts, showing what they'd be left on. It reads `bust` in red if the turn overshoots, and turns green on an exact checkout.
- Assets are referenced as `style.css?v=N` / `app.js?v=N`. **Bump `N` in `index.html` whenever you change either file** — each file is cached independently at the edge, so without it a fresh `index.html` can load against a stale `app.js`.
- Running turn count and three-dart average for each player.
- **Bust** voids the turn: it scores nothing, whatever darts have been entered, and play passes. The app already busts a turn automatically when the arithmetic says so — this is for the cases it can't see, like a bounce-out, a mis-entry, or a throw out of turn. The turn still counts toward the player's turn count and average, exactly as an automatic bust does. No confirmation, since **Undo turn** reverses it cleanly.
- **Undo turn** rolls back the last completed turn (or clears a turn in progress). **Undo turn** and **New game** both ask for confirmation first, naming exactly what's about to be lost.
- Tap the other player's card to switch whose turn it is if you mis-tapped (two-player games).
- The game is saved to `localStorage`, so closing the tab won't lose it — you'll be offered **Resume** next time.

## Layout

```
public/
  index.html      game chooser
  home.css        chooser styles
  shared.css      palette + reset, used by every page
  account.js      account bubble, injected into every page
  account/
    index.html    your profile
    profile.js
    profile.css
  darts/
    index.html
    app.js
    style.css
worker/
  index.js        router: www redirect, /auth and /api
  auth.js         Google OIDC + signed session cookie
migrations/
  0001_init.sql   users, games, game_players, turns
```

`public/` is what gets published and nothing outside it is, so
`wrangler.jsonc`, `worker/` and this README stay unpublished by virtue of
living above it.

**Adding a game** means adding a folder under `public/` and one `<a>` to the
chooser. Games share `shared.css` — the palette and the reset — and nothing
else, so one game's layout can never break another's. Keep game-specific rules
in that game's own stylesheet.

## Running locally

Either a plain static server:

```sh
npx http-server public -p 8080
```

or the real Workers runtime, which is what production serves:

```sh
npx wrangler dev --port 8790
```

## Accounts

Signing in is **optional** — every game works signed out, exactly as it did
before accounts existed. Signing in adds a stored history of your games.

Sign-in is Google only, via OIDC with PKCE. The session is a cookie carrying a
signed `{uid, exp}` payload rather than a row in a sessions table, so an
authenticated request costs no database read. Data lives in Cloudflare D1
(`migrations/`); the schema is in `migrations/0001_init.sql`.

With nothing configured the site still serves normally: `/api/me` reports
`auth: false` and the account strip stays hidden. To turn it on:

1. **Google Cloud Console** → create a project → **APIs & Services →
   Credentials** → *Create credentials → OAuth client ID* → **Web application**.
   - Authorised redirect URI: `https://scorechalk.com/auth/google/callback`
   - Fill in the OAuth consent screen. Publishing it externally needs a
     privacy policy URL.
2. Put the client id in `wrangler.jsonc` under `vars.GOOGLE_CLIENT_ID` — it is
   public by design and travels in the sign-in URL.
3. Set the two secrets, which must **never** go in `wrangler.jsonc`:

   ```sh
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET     # e.g. openssl rand -hex 32
   ```

Rotating `SESSION_SECRET` signs everyone out, which is the intended lever if a
session ever needs revoking.

### Migrations

```sh
npx wrangler d1 migrations apply scorechalk --local    # dev database
npx wrangler d1 migrations apply scorechalk --remote   # production
```

Local dev reads secrets from `.dev.vars` (gitignored). It is **not watched** —
restart `wrangler dev` after editing it.

## Deploying

Hosted on Cloudflare as a **Worker with static assets** — not Pages. The site
itself is static; `worker/index.js` exists only to 301 `www.scorechalk.com` to
the apex, and hands every other request to `public/` untouched. Both hostnames
are declared in `wrangler.jsonc`, so a fresh clone can rebuild the whole
deployment from that file.

```sh
npx wrangler login     # once per machine
npx wrangler deploy
```

Unknown paths 404 (`not_found_handling: "none"`). There is no client-side
routing to rescue, so a wrong path is genuinely not found.

# 🎯 Dart Tracker

A tiny, mobile-first score tracker for countdown darts (501, 301, or any starting score you like) — head to head, or solo for practice. No build step, no dependencies — three static files.

## Use it

Live: **https://jesskady.github.io/dart-tracker/**

Add it to your phone's home screen for a full-screen app feel.

## How it works

**Setup** — choose **Two player** or **Practice**, enter the name(s), pick a starting score (301 / 501 / 701, or type your own), and optionally switch on **Double in** and **Double out**.

**Scoring** — tap `Single` / `Double` / `Triple`, then a number `1`–`20`. Tapping *Double* then *20* records `D20` = 40. The multiplier applies to one dart and resets to Single afterwards. `Bull` scores 25 (50 with Double selected) and `Miss` scores 0. Up to three darts per turn.

Then hit **Submit turn** to subtract it and pass play to the other player.

### Checkout suggestions

When the score can be finished with the darts left in the turn, the bar under the turn strip shows how — `T20 · T19 · D12` for 141. It re-solves after every dart, so with two darts left on 81 it shows `T19 · D12`, and with one left on 24 it shows `D12`. It follows the double rules: with **Double out** on, the last dart shown is always a double, and with **Double in** on and the player not yet open, the first one is.

If the score is low enough to be finishable in principle but has no path — the bogey numbers 169, 168, 166, 165, 163, 162 and 159 — it says so instead. Above that it stays blank.

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
- Assets are referenced as `style.css?v=N` / `app.js?v=N`. **Bump `N` in `index.html` whenever you change either file** — GitHub Pages caches each file for 10 minutes independently, so without it a fresh `index.html` can load against a stale `app.js`.
- Running turn count and three-dart average for each player.
- **Undo turn** rolls back the last completed turn (or clears a turn in progress).
- Tap the other player's card to switch whose turn it is if you mis-tapped (two-player games).
- The game is saved to `localStorage`, so closing the tab won't lose it — you'll be offered **Resume** next time.

## Running locally

Any static server works:

```sh
npx http-server -p 8080
```

Then open `http://localhost:8080`.

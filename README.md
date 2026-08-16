# 🎯 Dart Tracker

A tiny, mobile-first score tracker for two-player countdown darts (501, 301, or any starting score you like). No build step, no dependencies — three static files.

## Use it

Live: **https://jesskady.github.io/dart-tracker/**

Add it to your phone's home screen for a full-screen app feel.

## How it works

**Setup** — enter both player names, pick a starting score (301 / 501 / 701, or type your own), and optionally switch on **Double out**.

**Scoring** — each turn can be entered two ways:

- **Darts tab** — tap `Single` / `Double` / `Triple`, then a number `1`–`20`. Tapping *Double* then *20* records `D20` = 40. The multiplier applies to one dart and resets to Single afterwards. `Bull` scores 25 (50 with Double selected) and `Miss` scores 0. Up to three darts per turn.
- **Total tab** — type the whole turn as one number on the keypad and submit it.

Then hit **Submit turn** to subtract it and pass play to the other player.

## Rules it enforces

- Turn totals are capped at 180.
- Going below zero is a **bust** — the score is left untouched and the turn passes.
- Landing exactly on zero wins.

### Double out

Off by default. When switched on in setup (a `DOUBLE OUT` badge then shows during the game), two extra rules apply:

- The **winning dart must be a double** — `D1`–`D20`, or the double bull (`Bull` with `Double` selected, 50). Reaching zero any other way is a bust.
- **Leaving exactly 1 is a bust**, since there's no double that finishes from there.

One caveat: on the **Total** tab there's no record of which dart landed last, so a lump sum that reaches zero is taken at face value as a legal checkout. The "can't leave 1" and overshoot rules are still enforced. If you want the double verified, enter the finishing turn on the Darts tab.

## Other bits

- A smaller **projected score** appears next to the active player's total as you enter darts, showing what they'd be left on. It reads `bust` in red if the turn overshoots, and turns green on an exact checkout.
- Running turn count and three-dart average for each player.
- **Undo turn** rolls back the last completed turn (or clears a turn in progress).
- Tap the other player's card to switch whose turn it is if you mis-tapped.
- The game is saved to `localStorage`, so closing the tab won't lose it — you'll be offered **Resume** next time.

## Running locally

Any static server works:

```sh
npx http-server -p 8080
```

Then open `http://localhost:8080`.

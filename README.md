# 🎯 Dart Tracker

A tiny, mobile-first score tracker for two-player countdown darts (501, 301, or any starting score you like). No build step, no dependencies — three static files.

## Use it

Live: **https://jesskady.github.io/dart-tracker/**

Add it to your phone's home screen for a full-screen app feel.

## How it works

**Setup** — enter both player names and pick a starting score (301 / 501 / 701, or type your own).

**Scoring** — each turn can be entered two ways:

- **Darts tab** — tap `Single` / `Double` / `Triple`, then a number `1`–`20`. Tapping *Double* then *20* records `D20` = 40. The multiplier applies to one dart and resets to Single afterwards. `Bull` scores 25 (50 with Double selected) and `Miss` scores 0. Up to three darts per turn.
- **Total tab** — type the whole turn as one number on the keypad and submit it.

Then hit **Submit turn** to subtract it and pass play to the other player.

## Rules it enforces

- Turn totals are capped at 180.
- Going below zero is a **bust** — the score is left untouched and the turn passes.
- Landing exactly on zero wins. (There's no double-out requirement.)

## Other bits

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

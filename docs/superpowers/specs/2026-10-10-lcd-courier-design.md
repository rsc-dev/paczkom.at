# paczkom.at — LCD courier game

Date: 2026-10-10 · Status: design approved in conversation (four sections),
awaiting written-spec review · Replaces the air-quality card that is live on
`main` (PR #1, merged at 88e717a). That card and its InPost follow-up stay in
git history (`main` before this change; branch `smog-card`); the original
memory game stays under the tag `game-final`.

## Goal

paczkom.at becomes a single arcade game in the style of the 1980s/90s LCD
handhelds known in Poland as "Jajka" (Elektronika IM-02 "Nu, pogodi!"),
re-themed around parcel lockers: a courier catches parcels sliding down four
chutes from delivery vans and posts them into the locker. Play as long as you
like, beat your own record, share the score.

Out of scope: daily challenge, global leaderboard, accounts, backend, hourly
jobs, any third-party data.

## Decisions taken

| Question | Decision |
| --- | --- |
| Relation to the live site | Replace it entirely |
| Core | Arcade: Game A / Game B, local record per game, share score |
| Look | Whole handheld on screen: case, grey LCD with ghost segments, physical-style buttons |
| Hero | The courier |
| Rendering | Fixed SVG segments toggled from a pure game core (no canvas, no engine) |

## Brand and IP

- No wolf, hare or "Nu, pogodi!" name, characters or artwork (Soyuzmultfilm);
  the catch-from-four-lanes mechanic is not protected. All art is original.
- The machine is a generic "automat paczkowy". The word "Paczkomat", the
  operator's logo and colours never appear; existing tests keep enforcing it.
  No InPost or other operator name anywhere in copy.

## 1. Rules and tempo

- **Board**: four chutes — left-upper (LU), left-lower (LD), right-upper (RU),
  right-lower (RD). Each has five parcel positions; position 5 is the lip
  where the courier catches. The courier has four poses, one per chute lip.
- **Ticks**: the game advances in ticks. On every tick every parcel moves one
  position down its chute; then, with a probability set by the tempo, a new
  parcel appears at position 1 of a chute whose position 1 is empty.
  Randomness is seeded (`core/rng`) so tests can replay a game exactly.
- **Catch**: a parcel that reaches past position 5 while the courier stands
  at that chute scores +1 and goes into the locker (short beep).
- **Miss**: otherwise the parcel falls and breaks: play pauses ~1 s, the
  broken parcel blinks on that side, and a complaint ("reklamacja") icon
  lights. Three complaints end the shift (game over).
- **Customer** (the hare equivalent): now and then a customer peeks from
  behind the locker for a few seconds. A miss while the customer is visible
  costs half a complaint (shown as a blinking icon); two halves make one.
- **Bonus**: at 200 and 500 points all complaints are cleared.
- **Score** shows 0–999 and wraps to 0 after 999 (the record stores the real
  total).
- **Tempo**: tick interval starts at 800 ms (Game A) / 600 ms (Game B), drops
  by 4 % every 10 points, never below 250 ms. Spawn probability rises with
  the score.
- **Game A**: at most two chutes carry parcels at once until 50 points, then
  all four. **Game B**: all four chutes from the start.
- **Record**: highest total per game (A, B), stored in the browser.

## 2. Screen, case and controls

- **Case**: drawn in HTML/CSS + SVG, no bitmaps. Portrait (phones): LCD across
  the top; below it two large round buttons on the left (LU, LD) and two on
  the right (RU, RD); small rectangular GRA A / GRA B / CZAS buttons in the
  middle; smallest: sound and PL/EN. Landscape / desktop: horizontal handheld,
  round buttons at the sides of the LCD.
- **LCD**: one inline SVG in `index.html` where every drawable thing is a
  segment element with a stable id: courier ×4 poses, parcels 4×5, broken
  parcel left/right, complaint icons ×3 (plus half state), customer, three
  7-segment digits, GRA A / GRA B labels, clock colon. Unlit segments are
  faintly visible ("ghosts"); lit ones near-black on grey-green. All colours
  are CSS tokens; TS never names a colour.
- **CZAS (clock) mode**: when no game runs, the digits show the current time
  (HH:MM) and the courier changes pose now and then. CZAS switches to it.
- **Controls**: buttons act on `pointerdown` (no click delay); tapping an LCD
  quadrant also moves the courier. Keyboard: Q/A = LU/LD, P/L = RU/RD,
  numpad 7/1/9/3 the same; Space/Enter starts Game A, B starts Game B.
- **Pause**: leaving the tab pauses; returning resumes where it stopped.
- **Accessibility**: real `<button>`s with labels; score and complaints
  announced through a polite live region.

## 3. Sound, record, sharing

- **Sound**: square-wave beeps from Web Audio (no audio files): soft tick per
  step, higher beep on a catch, crunch on a break, short tune at game over,
  chirp when the customer appears. Starts after the first gesture; mute is
  remembered. Built on `game-final`'s `src/audio/sfx.ts`.
- **Game over**: the LCD freezes and the score blinks; under the LCD a slip
  reads "Koniec zmiany: 142 paczki · rekord: 210" (EN "End of shift: 142
  parcels · record: 210") with a Share button; a new record is marked.
- **Before a game**: the chosen game's record shows briefly on the digits.
- **Share text** (Web Share → clipboard → selectable textarea, reusing
  `src/ui/share.ts`):

  ```
  paczkom.at · Gra A
  📦 142 paczki · 💥 3 reklamacje
  Nowy rekord!
  https://paczkom.at
  ```

  The record line only on a new record; EN equivalents.
- **Link preview**: one site-wide 1200×630 `og.png` showing the handheld,
  generated by the icon script; no per-score pages.

## 4. Repository changes

- **Base**: current `origin/main` (the air-quality card).
- **Removed**: the whole air-quality product — collector (`scripts/collect*`,
  fixtures, `record-fixtures`, `generate-towns`, towns data), grading/geo/
  history/publish/summary core, card/picker/ranking/route/data UI, per-town
  pages, `@resvg/resvg-js` and vendored TTFs if nothing else uses them, the
  hourly schedule, Actions-cache history, keepalive and live-check workflows,
  GIOŚ/Sensor.Community copy and README sections.
- **Kept**: site shell, `src/storage.ts`, `src/i18n` (new catalogues),
  `src/ui/share.ts`, `src/ui/dom.ts`, icon generator, purity and
  colour-literal tests, trade-mark test, CI.
- **Restored from `game-final`**: `src/core/rng.ts` (+ tests),
  `src/audio/sfx.ts` (+ tests, reworked for the new effects).
- **New**: `src/core/` game rules (state, tick, move, start, catch/miss,
  customer, tempo, A/B) as a pure reducer; `src/ui/lcd.ts` (segments from
  state, digits, clock); `src/ui/controls.ts` (buttons, keys, quadrants);
  `src/main.ts` (loop, pause, sound, record, share); `index.html` case + LCD
  SVG; new icons and `og.png`.
- **Deploy**: back to the simple flow — deploy after green CI on a push to
  `main`, plus manual dispatch; no schedule. Keep the guard that only deploys
  `workflow_run`s from pushes to this repository (`event == 'push'` and
  `head_repository == repository`). Manual dispatch deploys `main`.
- **README**: rewritten for the game.

## Testing

- **Unit (core)**: catch and miss; half complaint while the customer shows;
  game over at three complaints; complaints cleared at 200 and 500; display
  wraps 999 → 0 while the record keeps the total; tempo curve and 250 ms
  floor; Game A two-chute cap until 50, Game B four; same seed → same game.
- **Unit (UI, jsdom)**: the right segments light for a given state; digits;
  clock mode; key/button/quadrant mapping to poses.
- **E2E (fake clock)**: start Game A and catch a parcel by key; a miss lights
  a complaint; game over shows the slip and share fallback; a new record
  survives reload; CZAS shows the time; hidden tab pauses; PL/EN toggle.

## Note on the live site

At the time of writing the live air-quality card is stale (data from
2026-10-02) because every scheduled deploy fails on the green-commit lookup
fixed on `smog-card` but not merged. This change removes the schedule, so
merging it ends those failures; until then the live site keeps showing its
last data with the staleness warning.

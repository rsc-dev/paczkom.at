# paczkom.at — thrown parcels (LCD game, second edition)

Date: 2026-10-10 · Status: direction approved in conversation, awaiting
written-spec review · Replaces the four-chute courier game that is live on
`main` (b744903). The four-chute rules stay in git history.

## Goal

A new LCD handheld game in the look of the owner's art board
(`scripts/art/source/board-1.png`): a fine ink-and-hatching drawing on a
grey-green LCD, black segments over a grey printed scene. A thrower on a
balcony lobs parcels along fixed arcs; the courier runs between fixed
positions below and catches them in a crate, carries full crates to the
parcel locker, and loses a heart for every parcel that hits the ground.

## Decisions taken

| Question | Decision |
| --- | --- |
| Characters | Our own, in the board's style: a courier (catches) and a thrower. No wolf, no hare, no "Nu, pogodi!" |
| Locker sign | Generic. The word "Paczkomat" never appears (existing tests keep it out) |
| Mechanics | New: thrown parcels, a running courier, a drone, a bird, hearts |
| Movement | LCD-style fixed positions, not free movement |
| Drone and bird | The drone drops extra parcels straight down; the bird perches on a flight path and knocks a parcel one position over |
| Locker role | Delivery: the crate holds 3; a full crate is carried to the locker for double points |
| Art source | Cut and vectorised from the owner's board; courier and thrower from a second board the owner will supply |

## 1. Rules

- **Positions**: the courier stands at one of five positions, 1–5 from left
  to right. Positions 1–4 are under the four landing spots; position 5 is
  the locker. A/← and D/→ move one position; on touch, the left and right
  halves of the screen do the same; numpad 1–5 jump straight to a position.
- **Throws**: the thrower stands on a balcony at the top left and lobs
  parcels along four fixed arcs, one per landing spot. Every arc has five
  steps; step 5 is the catch moment above its landing spot. All parcels in
  flight advance one step per tick.
- **Catch**: when a parcel reaches step 5 and the courier stands under it
  with room in his crate, the crate gains a parcel (beep). Otherwise the
  parcel lands and breaks (crash sound, the broken parcel blinks, play
  freezes for about a second, the board is cleared) and the player loses a
  heart.
- **Crate and locker**: the crate holds 3 parcels; its fill shows as 0–3
  small boxes in the crate. Moving onto position 5 empties the crate into
  the locker: 2 points per parcel, with a short delivery chime. A full crate
  cannot catch, so the player chooses between running to the locker and
  staying under the next parcel.
- **Hearts**: three. Losing the third ends the shift. Hearts refill at 100
  and 300 points.
- **Drone** (from level 3): now and then it flies in along the top row,
  stops above one of the four landing spots and drops a parcel that falls
  in three steps (a separate short track per spot).
- **Bird** (from level 2): now and then it perches above one landing spot for
  a few ticks. A thrown parcel heading for that spot is knocked one spot to
  the right (to the left from spot 4) at its step 3 and finishes on the
  neighbouring arc.
- **Spawning**: at most one new parcel per tick, and never one that would
  reach its catch step on the same tick as another parcel, so every parcel
  is catchable in principle.
- **Levels** (by score): 1 from 0 (one parcel in flight at a time, slow);
  2 from 16 (two in flight, bird); 3 from 32 (drone); 4 from 48 (faster);
  5 from 72 (fastest, all hazards more often). Tick interval starts at
  700 ms and drops per level down to a 260 ms floor.
- **Score**: delivered points only; shown 0–999 (wraps); records keep the
  real total. Records per game: Game A (as above) and Game B (starts at
  level 3).

Determinism: one seeded RNG in the game state (`core/rng`), so tests replay
games exactly.

## 2. Screen

- The LCD keeps the existing architecture: one SVG of fixed segments the
  game lights or darkens, ghosts visible when unlit.
- **Print (always visible, mid-grey)**: the balcony and house on the left,
  trees and bushes, the house on the right, the locker at position 5 with a
  generic sign, the ground line. Taken from the board, vectorised.
- **Segments (black)**:
  - thrower: three frames (holding, wind-up, release);
  - courier: five positions × two frames (standing, catching) facing the
    thrown parcels, plus a "delivering" frame at the locker;
  - crate fill: 0–3 boxes in each courier frame;
  - parcels: 4 arcs × 5 steps, drone drops: 4 × 3 steps;
  - broken parcel at each landing spot (blinks);
  - drone at 4 hover positions plus an entry position; bird at 4 perches;
  - hearts ×3, digits ×3 (score), level dots ×5, GRA A / GRA B labels;
  - effects: catch stars, delivery sparkle.
- **Frame**: the board's LCD frame — a bezel with "PACZKOM.AT" printed at
  the top and "ELEKTRONIKA PACZKOM.AT" at the bottom, inside the existing
  case with its buttons. The case buttons become ←, → (two large round
  buttons) and GRA A / GRA B / CZAS.
- The CZAS (clock) mode stays: HH:MM on the digits, the courier idling.

## 3. Art pipeline

- `scripts/art/source/board-1.png` (the owner's board) and, later,
  `board-2.png` (courier and thrower) are committed sources.
- `scripts/art/sprites.ts` lists each sprite's crop box on a board, plus any
  rectangle to blank (the locker's sign, the hare on the balcony roof).
- `scripts/art/build.ts` (`npm run gen:art`, needs ImageMagick) crops each
  sprite and turns it into black ink on transparency: opacity comes from how
  dark each pixel is, so outlines, hatching and stippling survive exactly as
  drawn. Output: `public/sprites/<name>.png`, committed. The game never
  processes art at runtime.
- Decided after a spike: tracing to vectors (potrace) was rejected because
  thresholding merges the hatching into solid blots; the alpha-from-darkness
  bitmaps keep the board's line quality.
- Segments are `<image>` elements inside the LCD SVG, lit and ghosted with the
  same `data-on` / opacity rules as before.
- Until `board-2.png` exists, the courier and thrower are placeholder
  sprites so the game is playable end to end; replacing them is a data change
  (new crop boxes), not a code change.

## 4. Repository changes

- `src/core/game.ts`, `src/core/game.test.ts`: replaced by the thrown-parcel
  rules (same reducer shape: `newGame`, `move`, `step`, `tickInterval`,
  `displayScore`).
- `src/ui/lcd-art.ts`, `src/ui/lcd.ts`: new segment set and lighting rules
  built from the generated sprites.
- `src/ui/controls.ts`: left/right moves, numpad 1–5, start/clock as before.
- `src/main.ts`: same loop, pause, sound, records and sharing; new cues
  (deliver, heart lost).
- `index.html`, `src/theme/*`: LCD frame with the board's printed titles;
  two arrow buttons.
- i18n: copy for hearts, crate, delivery, levels; help text for ← →.
- README rewritten for the new rules.
- The trade-mark test stays; no wolf/hare names in copy.

## Testing

- Unit (core): catch with room in the crate; catch refused with a full crate
  (parcel lost, heart lost); delivery at position 5 scores 2 per parcel and
  empties the crate; heart refills at 100 and 300; game over at zero hearts;
  bird knocks a parcel to the neighbouring spot; drone drops fall in three
  steps; never two parcels at a catch step on the same tick; levels by score;
  tempo floor; same seed → same game.
- Unit (UI): lit segments per state (courier frame and crate fill, parcels on
  arcs, drone, bird, hearts, digits); key mapping.
- E2E: start, catch, deliver, lose all hearts, share; WASD/arrows; clock;
  hidden tab pauses; PL/EN.
- Art: every sprite the segment list needs exists in `public/sprites/`.

## Open items

- `board-2.png` with our own courier and thrower in the board's style.
- Exact crop boxes are measured when the art pipeline is built.

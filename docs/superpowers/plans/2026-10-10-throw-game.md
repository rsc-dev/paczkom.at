# Thrown-Parcels LCD Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-chute game with the thrown-parcels game from the owner's art board: a thrower lobs parcels on fixed arcs, the courier runs between five positions, catches into a 3-parcel crate and delivers to the locker; hearts, a drone and a bird; art cut from `board-1.png`.

**Architecture:** Same shape as today: a pure reducer (`src/core/game.ts`) with seeded RNG; an LCD SVG of fixed segments (`src/ui/lcd-art.ts`) whose segments are now mostly `<image>` sprites cut from the board; `src/ui/lcd.ts` maps state to lit segment ids; `src/main.ts` runs timers, input, sound, records and sharing. Sprites are produced once by `scripts/art/build.ts` (ImageMagick) into `public/sprites/*.png` and committed.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4 + jsdom, Playwright, ImageMagick (`magick`, dev only, for `npm run gen:art`), tsx.

**Spec:** `docs/superpowers/specs/2026-10-10-throw-game-design.md`

**Work in:** `/home/surtr/projects/paczkom.at-lcd`, branch `throw-game` (from `main` b744903).

**Decided while planning:**
- The thrower has two frames (holding, release); a separate wind-up frame adds nothing a player can act on.
- The slip and share text report **points** ("142 pkt"), since the score is delivered points, not parcels.
- W/S and the up/down arrows do nothing in this game; the courier only moves left and right.
- The LCD becomes 5:3 (viewBox 400×240) to fit the board's wide scene.
- The courier has one pose per position until `board-2.png` arrives; catching and delivering frames, catch stars and the delivery sparkle come with that art, not hand-drawn now.
- The drone appears directly above its spot (no entry position); four digits instead of three, because the clock needs HH:MM.

## Global Constraints

- No runtime dependencies; ImageMagick is a dev-only tool for `gen:art`.
- `src/core/**` is pure (no `Math.random`, `Date.now`, DOM, `fetch`); randomness only via `src/core/rng.ts`.
- No colour literals in `src/core/**` or `src/ui/**`.
- No wolf, hare, "Nu, pogodi!"; never the word "Paczkomat" in copy, page or sprites (the locker sign is blanked).
- Positions 1–5; 5 is the locker. Landing spots 0–3 sit under positions 1–4.
- Throw arcs: 5 steps; drone drops: 3 steps; one new flight per tick at most; never two flights reaching their last step on the same tick.
- Crate holds 3; a catch needs room; moving onto 5 delivers 2 points per parcel.
- Hearts 3; a lost parcel costs one; refill at 100 and 300; game over at 0.
- Levels from score 0 / 16 / 32 / 48 / 72; Game B starts at level 3. Tick 700 / 600 / 520 / 430 / 360 ms, then −3 % per 10 points at level 5, floor 260 ms.
- Bird from level 2 (knocks a throw at step index 2 to the neighbouring spot); drone from level 3.
- Keys: A/← and D/→ move one position; Numpad1–5 jump; Space/Enter Game A; KeyB Game B.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Lint rejects `async` without `await`; test stubs use `Promise.resolve(...)`.

## Review Focus

1. **A full crate under a parcel** → the parcel is lost and a heart goes; it is not silently ignored. Test in Task 1.
2. **Delivering an empty crate** (moving onto 5 with 0 parcels) → nothing happens, no points, no sound. Test in Task 1.
3. **Score crossing 100 or 300 by a delivery of several parcels** (e.g. 98 → 104) → hearts refill once. Test in Task 1.
4. **A bird and a drone at the same spot** → the drone drop is not knocked (only throws are). Test in Task 1.
5. **Moving past the edges** (← at 1, → at 5, Numpad5 when already there) → stays put, no repeated delivery. Test in Task 1.

---

### Task 1: The rules

**Files:**
- Rewrite: `src/core/game.ts`, `src/core/game.test.ts`
- Modify: `src/core/record.ts` (import path unchanged; `Mode` still exported from game)

**Interfaces:**
- Produces: `type Mode = 'A' | 'B'`; constants `SPOTS = 4`, `POSITIONS = 5`, `LOCKER = 5`, `THROW_STEPS = 5`, `DROP_STEPS = 3`, `CRATE_SIZE = 3`, `HEARTS = 3`, `BIRD_TICKS = 6`; `interface Flight { kind: 'throw' | 'drop'; spot: number; step: number }`; `interface GameState { mode; rng; pos; crate; hearts; score; flights: readonly Flight[]; bird: { spot: number; ticks: number } | null; thrower: 0 | 1; pause; broken: number | null; over }`; `type GameEvent = 'step' | 'throw' | 'drop' | 'catch' | 'miss' | 'deliver' | 'bonus' | 'bird' | 'over'`; `newGame(mode, seed)`, `move(state, to): { state; events }`, `step(state): { state; events }`, `level(mode, score)`, `tickInterval(mode, score)`, `displayScore(score)`, `lastStep(flight)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/core/game.test.ts
import { describe, expect, it } from 'vitest';
import { CRATE_SIZE, HEARTS, LOCKER, lastStep, level, move, newGame, step, tickInterval } from './game.js';
import type { Flight, GameEvent, GameState } from './game.js';

const at = (over: Partial<GameState>): GameState => ({ ...newGame('A', 7), ...over });
const thrown = (spot: number, s: number): Flight => ({ kind: 'throw', spot, step: s });
const dropped = (spot: number, s: number): Flight => ({ kind: 'drop', spot, step: s });

describe('catching', () => {
  it('catches a parcel at its last step into the crate', () => {
    const { state, events } = step(at({ pos: 2, flights: [thrown(1, 4)] }));
    expect(state.crate).toBe(1);
    expect(events).toContain('catch');
    expect(state.hearts).toBe(HEARTS);
  });

  it('loses a heart, pauses and clears the board when nobody is under the parcel', () => {
    const { state, events } = step(at({ pos: 4, flights: [thrown(1, 4), thrown(2, 1)] }));
    expect(events).toContain('miss');
    expect(state.hearts).toBe(HEARTS - 1);
    expect(state.broken).toBe(1);
    expect(state.pause).toBeGreaterThan(0);
    expect(state.flights).toEqual([]);
  });

  it('loses the parcel when the crate is full', () => {
    const { state, events } = step(at({ pos: 1, crate: CRATE_SIZE, flights: [thrown(0, 4)] }));
    expect(events).toContain('miss');
    expect(state.crate).toBe(CRATE_SIZE);
    expect(state.hearts).toBe(HEARTS - 1);
  });

  it('catches drone drops at their own last step', () => {
    expect(step(at({ pos: 3, flights: [dropped(2, 2)] })).state.crate).toBe(1);
  });

  it('ends the shift when the last heart goes', () => {
    const { state, events } = step(at({ pos: 5, hearts: 1, flights: [thrown(0, 4)] }));
    expect(events).toContain('over');
    expect(state.over).toBe(true);
    expect(state.hearts).toBe(0);
  });
});

describe('moving and delivering', () => {
  it('moves one position at a time and stops at the edges', () => {
    expect(move(at({ pos: 1 }), 0).state.pos).toBe(1);
    expect(move(at({ pos: 4 }), 5).state.pos).toBe(5);
    expect(move(at({ pos: 5 }), 6).state.pos).toBe(5);
  });

  it('delivers the crate at the locker for 2 points a parcel', () => {
    const { state, events } = move(at({ pos: 4, crate: 3, score: 10 }), LOCKER);
    expect(state).toMatchObject({ pos: 5, crate: 0, score: 16 });
    expect(events).toEqual(['deliver']);
  });

  it('does nothing at the locker with an empty crate, or when already there', () => {
    expect(move(at({ pos: 4, crate: 0 }), LOCKER).events).toEqual([]);
    expect(move(at({ pos: 5, crate: 2 }), LOCKER).events).toEqual([]);
  });

  it('refills hearts once when a delivery crosses 100 or 300', () => {
    const { state, events } = move(at({ pos: 4, crate: 3, score: 98, hearts: 1 }), LOCKER);
    expect(state.hearts).toBe(HEARTS);
    expect(events).toEqual(['deliver', 'bonus']);
    expect(move(at({ pos: 4, crate: 1, score: 100, hearts: 1 }), LOCKER).state.hearts).toBe(1);
  });

  it('ignores moves after the shift ends', () => {
    const over = at({ over: true, pos: 2 });
    expect(move(over, 3)).toEqual({ state: over, events: [] });
  });
});

describe('the bird', () => {
  it('knocks a throw passing its perch to the neighbouring spot', () => {
    const { state } = step(at({ pos: 5, bird: { spot: 1, ticks: 4 }, flights: [thrown(1, 1)] }));
    expect(state.flights[0]).toMatchObject({ spot: 2, step: 2 });
    const edge = step(at({ pos: 5, bird: { spot: 3, ticks: 4 }, flights: [thrown(3, 1)] }));
    expect(edge.state.flights[0]?.spot).toBe(2);
  });

  it('leaves drone drops alone', () => {
    const { state } = step(at({ pos: 5, bird: { spot: 1, ticks: 4 }, flights: [dropped(1, 1)] }));
    expect(state.flights[0]?.spot).toBe(1);
  });
});

describe('spawning', () => {
  function play(mode: 'A' | 'B', seed: number, ticks: number, check: (s: GameState, e: GameEvent[]) => void): void {
    let state = newGame(mode, seed);
    for (let i = 0; i < ticks && !state.over; i += 1) {
      // A perfect player: stand under whatever lands next, deliver when the crate is full.
      const landing = state.flights.find((f) => f.step === lastStep(f) - 1);
      if (state.crate === CRATE_SIZE) {
        state = move(state, LOCKER).state;
      } else if (landing !== undefined) {
        state = move(state, landing.spot + 1).state;
      }
      const next = step(state);
      state = next.state;
      check(state, next.events);
    }
  }

  it('never lands two parcels on the same tick and never starts two at once', () => {
    play('B', 3, 600, (s) => {
      const due = s.flights.filter((f) => f.step === lastStep(f));
      expect(due.length).toBeLessThanOrEqual(1);
      expect(s.flights.filter((f) => f.step === 0).length).toBeLessThanOrEqual(1);
    });
  });

  it('keeps level 1 to one parcel in flight', () => {
    play('A', 11, 200, (s) => {
      if (level('A', s.score) === 1) {
        expect(s.flights.length).toBeLessThanOrEqual(1);
      }
    });
  });

  it('sends drones only from level 3, and the bird only from level 2', () => {
    play('A', 5, 300, (s, e) => {
      if (level('A', s.score) < 3) {
        expect(e).not.toContain('drop');
      }
      if (level('A', s.score) < 2) {
        expect(e).not.toContain('bird');
      }
    });
    let drones = 0;
    play('B', 5, 400, (_s, e) => {
      drones += e.filter((x) => x === 'drop').length;
    });
    expect(drones).toBeGreaterThan(0);
  });

  it('replays exactly from the same seed', () => {
    const run = (): GameEvent[][] => {
      let s = newGame('B', 42);
      const log: GameEvent[][] = [];
      for (let i = 0; i < 120; i += 1) {
        const r = step(s);
        s = r.state;
        log.push(r.events);
      }
      return log;
    };
    expect(run()).toEqual(run());
  });
});

describe('levels and tempo', () => {
  it('rises with score; Game B starts at level 3', () => {
    expect([0, 15, 16, 32, 48, 72].map((s) => level('A', s))).toEqual([1, 1, 2, 3, 4, 5]);
    expect(level('B', 0)).toBe(3);
  });

  it('speeds up per level and keeps a 260 ms floor', () => {
    expect([tickInterval('A', 0), tickInterval('A', 16), tickInterval('A', 72)]).toEqual([700, 600, 360]);
    expect(tickInterval('A', 5000)).toBe(260);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/core/game.test.ts`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement**

```ts
// src/core/game.ts
/**
 * The rules: a thrower lobs parcels on four fixed arcs, a drone drops more
 * from level 3, a bird knocks throws aside from level 2. The courier stands
 * at one of five positions (5 is the locker), catches into a crate of three
 * and delivers full crates for points. A pure reducer — the clock, input and
 * sound live in main.ts.
 */
import { next, nextInt } from './rng.js';
import type { RngState } from './rng.js';

export type Mode = 'A' | 'B';
export const SPOTS = 4;
export const POSITIONS = 5;
export const LOCKER = 5;
export const THROW_STEPS = 5;
export const DROP_STEPS = 3;
export const CRATE_SIZE = 3;
export const HEARTS = 3;
export const BIRD_TICKS = 6;
const HEART_REFILLS: readonly number[] = [100, 300];
const LEVEL_FROM: readonly number[] = [0, 16, 32, 48, 72];
const IN_FLIGHT: readonly number[] = [1, 2, 2, 3, 3];
const THROW_CHANCE: readonly number[] = [0.45, 0.5, 0.55, 0.6, 0.65];
const LEVEL_TICK: readonly number[] = [700, 600, 520, 430, 360];
const DRONE_SHARE = 0.25;
const BIRD_CHANCE = 0.05;
const PAUSE_MS = 1000;

export interface Flight {
  readonly kind: 'throw' | 'drop';
  /** Landing spot 0–3, under courier position spot + 1. */
  readonly spot: number;
  readonly step: number;
}

export interface GameState {
  readonly mode: Mode;
  readonly rng: RngState;
  readonly pos: number;
  readonly crate: number;
  readonly hearts: number;
  readonly score: number;
  readonly flights: readonly Flight[];
  readonly bird: { readonly spot: number; readonly ticks: number } | null;
  /** 0 holding, 1 just threw. */
  readonly thrower: 0 | 1;
  readonly pause: number;
  readonly broken: number | null;
  readonly over: boolean;
}

export type GameEvent = 'step' | 'throw' | 'drop' | 'catch' | 'miss' | 'deliver' | 'bonus' | 'bird' | 'over';

export const lastStep = (f: Flight): number => (f.kind === 'throw' ? THROW_STEPS : DROP_STEPS) - 1;
const remaining = (f: Flight): number => lastStep(f) - f.step;

export function level(mode: Mode, score: number): number {
  const byScore = LEVEL_FROM.filter((from) => score >= from).length;
  return mode === 'B' ? Math.max(3, byScore) : byScore;
}

export function tickInterval(mode: Mode, score: number): number {
  const l = level(mode, score);
  const base = LEVEL_TICK[l - 1] ?? 360;
  const extra = l === 5 ? Math.max(0, Math.floor((score - 72) / 10)) : 0;
  return Math.max(260, Math.round(base * 0.97 ** extra));
}

export function displayScore(score: number): number {
  return score % 1000;
}

export function newGame(mode: Mode, seed: number): GameState {
  return {
    mode, rng: seed >>> 0, pos: 3, crate: 0, hearts: HEARTS, score: 0, flights: [], bird: null,
    thrower: 0, pause: 0, broken: null, over: false,
  };
}

export function move(state: GameState, to: number): { state: GameState; events: GameEvent[] } {
  if (state.over) {
    return { state, events: [] };
  }
  const pos = Math.min(POSITIONS, Math.max(1, Math.round(to)));
  if (pos === LOCKER && state.pos !== LOCKER && state.crate > 0) {
    const score = state.score + 2 * state.crate;
    const refill = HEART_REFILLS.some((t) => state.score < t && score >= t);
    return {
      state: { ...state, pos, crate: 0, score, hearts: refill ? HEARTS : state.hearts },
      events: refill ? ['deliver', 'bonus'] : ['deliver'],
    };
  }
  return { state: { ...state, pos }, events: [] };
}

export function step(state: GameState): { state: GameState; events: GameEvent[] } {
  if (state.over) {
    return { state, events: [] };
  }
  if (state.pause > 0) {
    const pause = state.pause - 1;
    return { state: { ...state, pause, broken: pause === 0 ? null : state.broken }, events: [] };
  }

  const events: GameEvent[] = ['step'];
  let { rng, crate, hearts } = state;
  let broken: number | null = null;
  const flying: Flight[] = [];
  for (const f of state.flights) {
    if (f.step < lastStep(f)) {
      flying.push(f);
    } else if (state.pos - 1 === f.spot && crate < CRATE_SIZE) {
      crate += 1;
      events.push('catch');
    } else {
      hearts -= 1;
      broken = f.spot;
      events.push('miss');
    }
  }

  if (hearts <= 0) {
    events.push('over');
    return { state: { ...state, crate, hearts: 0, flights: [], broken, bird: null, over: true }, events };
  }
  if (broken !== null) {
    return {
      state: { ...state, crate, hearts, flights: [], broken, thrower: 0, pause: Math.ceil(PAUSE_MS / tickInterval(state.mode, state.score)) },
      events,
    };
  }

  const bird = state.bird;
  const flights: Flight[] = flying.map((f) => {
    const nextStep = f.step + 1;
    const knocked = f.kind === 'throw' && nextStep === 2 && bird !== null && bird.spot === f.spot;
    const spot = knocked ? (f.spot < SPOTS - 1 ? f.spot + 1 : f.spot - 1) : f.spot;
    return { ...f, spot, step: nextStep };
  });

  const lvl = level(state.mode, state.score);
  let thrower: 0 | 1 = 0;
  let roll: number;
  [roll, rng] = next(rng);
  if (flights.length < (IN_FLIGHT[lvl - 1] ?? 1) && roll < (THROW_CHANCE[lvl - 1] ?? 0.5)) {
    [roll, rng] = next(rng);
    const kind: Flight['kind'] = lvl >= 3 && roll < DRONE_SHARE ? 'drop' : 'throw';
    const newcomer: Flight = { kind, spot: 0, step: 0 };
    // One new flight per tick, and never one that lands on the same tick as another.
    if (!flights.some((f) => remaining(f) === remaining(newcomer))) {
      let spot: number;
      [spot, rng] = nextInt(rng, SPOTS);
      flights.push({ ...newcomer, spot });
      events.push(kind === 'throw' ? 'throw' : 'drop');
      thrower = kind === 'throw' ? 1 : 0;
    }
  }

  let nextBird = bird === null ? null : bird.ticks > 1 ? { ...bird, ticks: bird.ticks - 1 } : null;
  if (bird === null && lvl >= 2) {
    [roll, rng] = next(rng);
    if (roll < BIRD_CHANCE) {
      let spot: number;
      [spot, rng] = nextInt(rng, SPOTS);
      nextBird = { spot, ticks: BIRD_TICKS };
      events.push('bird');
    }
  }

  return { state: { ...state, rng, crate, hearts, flights, bird: nextBird, thrower, broken: null }, events };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/core/game.test.ts src/core/record.test.ts src/core/purity.test.ts && npx eslint src/core`
Expected: PASS, lint clean. Other suites (lcd, controls, main) will not compile until Tasks 3–4; that is expected. If a seeded property test fails only for its seed (e.g. no drone in 400 ticks), try the next seeds and record the change.

- [ ] **Step 5: Commit**

```bash
git add src/core/game.ts src/core/game.test.ts
git commit -m "feat(core): thrown-parcel rules — positions, crate, locker, hearts, drone, bird"
```

---

### Task 2: Sprites from the board

**Files:**
- Create: `scripts/art/sprites.ts`, `scripts/art/build.ts`, `scripts/art/sprites.test.ts`, `public/sprites/*.png` (generated)
- Modify: `package.json` (script `gen:art`), `vitest.config.ts` already includes `scripts/**/*.test.ts`

**Interfaces:**
- Produces: `interface Sprite { name: string; board: string; box: [w, h, x, y]; blank?: [x1, y1, x2, y2][] }`, `SPRITES: readonly Sprite[]`; files `public/sprites/<name>.png` for every sprite name: `parcel-a`, `parcel-b`, `parcel-c`, `parcel-d`, `parcel-e`, `bird`, `bird-perch`, `drone`, `tree`, `bush`, `lamp`, `locker`, `house`, `heart`.

- [ ] **Step 1: The sprite list (boxes measured on board-1, 1536×1024)**

```ts
// scripts/art/sprites.ts
/**
 * Where each sprite sits on the owner's art board: [width, height, x, y] in
 * board pixels, plus rectangles (in the crop's own pixels) to blank out —
 * the locker's sign (no trade mark) and the hare standing on the balcony
 * roof (no borrowed characters).
 */
export interface Sprite {
  readonly name: string;
  readonly board: string;
  readonly box: readonly [number, number, number, number];
  readonly blank?: readonly (readonly [number, number, number, number])[];
}

const B1 = 'scripts/art/source/board-1.png';

export const SPRITES: readonly Sprite[] = [
  { name: 'parcel-a', board: B1, box: [47, 46, 29, 714] },
  { name: 'parcel-b', board: B1, box: [42, 48, 193, 720] },
  { name: 'parcel-c', board: B1, box: [42, 50, 272, 715] },
  { name: 'parcel-d', board: B1, box: [44, 46, 351, 720] },
  { name: 'parcel-e', board: B1, box: [44, 46, 479, 719] },
  { name: 'bird', board: B1, box: [66, 56, 591, 706] },
  { name: 'bird-perch', board: B1, box: [65, 58, 659, 720] },
  { name: 'drone', board: B1, box: [83, 67, 741, 702] },
  { name: 'tree', board: B1, box: [67, 96, 834, 690] },
  { name: 'lamp', board: B1, box: [31, 125, 1086, 661] },
  { name: 'bush', board: B1, box: [94, 106, 1115, 680] },
  { name: 'locker', board: B1, box: [151, 105, 920, 681], blank: [[25, 14, 125, 36]] },
  { name: 'house', board: B1, box: [150, 255, 55, 165], blank: [[60, 0, 150, 24]] },
  { name: 'heart', board: B1, box: [22, 22, 612, 128] },
];
```

- [ ] **Step 2: Write the failing test**

```ts
// scripts/art/sprites.test.ts
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites.js';

describe('sprites', () => {
  it('has unique names and boxes inside the board', () => {
    expect(new Set(SPRITES.map((s) => s.name)).size).toBe(SPRITES.length);
    for (const { name, box } of SPRITES) {
      const [w, h, x, y] = box;
      expect(x + w, name).toBeLessThanOrEqual(1536);
      expect(y + h, name).toBeLessThanOrEqual(1024);
    }
  });

  it('has every sprite built into public/sprites', () => {
    for (const { name } of SPRITES) {
      expect(existsSync(`public/sprites/${name}.png`), name).toBe(true);
    }
  });
});
```

Run: `npx vitest run scripts/art/sprites.test.ts`
Expected: FAIL on "has every sprite built".

- [ ] **Step 3: The build script**

```ts
// scripts/art/build.ts
/**
 * Cuts every sprite out of its board and turns it into black ink on
 * transparency: opacity comes from how dark each pixel is, so outlines,
 * hatching and stippling survive exactly as drawn. Needs ImageMagick.
 *
 *   npm run gen:art
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { SPRITES } from './sprites.js';

mkdirSync('public/sprites', { recursive: true });
for (const sprite of SPRITES) {
  const [w, h, x, y] = sprite.box;
  const blanks = (sprite.blank ?? []).flatMap(([x1, y1, x2, y2]) => [
    '-fill', 'white', '-draw', `rectangle ${String(x1)},${String(y1)} ${String(x2)},${String(y2)}`,
  ]);
  execFileSync('magick', [
    sprite.board,
    '-crop', `${String(w)}x${String(h)}+${String(x)}+${String(y)}`, '+repage',
    '-colorspace', 'gray',
    ...blanks,
    // Light board tones become fully clear; ink stays opaque.
    '-level', '24%,68%',
    '-negate', '-alpha', 'copy', '-fill', 'black', '-colorize', '100',
    `public/sprites/${sprite.name}.png`,
  ]);
  process.stdout.write(`${sprite.name}\n`);
}
```

Add `"gen:art": "tsx scripts/art/build.ts"` to `package.json` scripts.

Run: `npm run gen:art && npx vitest run scripts/art/sprites.test.ts`
Expected: 14 names printed, PASS. Then build a contact sheet and look at it: every sprite black ink, no grey box around it, no sign text on the locker, no hare on the house:

```bash
magick -background '#b7bf9e' public/sprites/*.png -gravity center -extent 160x260 +append /tmp/sprites.png
```

If a sprite still shows a pale box, raise the low `-level` bound for that board (e.g. `30%`) and re-run; if ink breaks up, lower the high bound.

- [ ] **Step 4: Commit**

```bash
git add scripts/art package.json public/sprites
git commit -m "feat(art): cut the board's sprites into ink-on-transparency PNGs"
```

---

### Task 3: The LCD scene

**Files:**
- Rewrite: `src/ui/lcd-art.ts`, `src/ui/lcd-art.test.ts`, `src/ui/lcd.ts`, `src/ui/lcd.test.ts`

**Interfaces:**
- Consumes: Task 1 state; sprite files from Task 2 (`/sprites/<name>.png`).
- Produces: `lcdMarkup(): string` (`<svg id="lcd-svg" viewBox="0 0 400 240">`), `SEGMENT_IDS`; `LcdView` (`game` | `clock` | `record`, as before), `litSegments(view)`, `displayText(view)` (4 chars), `renderLcd(svg, view)`.

Segment ids: thrower `t-0`, `t-1`; throws `p-<spot>-<0..4>`; drone drops `q-<spot>-<0..2>`; drone `drone-<spot>`; bird `bird-<spot>`; broken `b-<spot>`; courier `c-1`…`c-5`; crate fill `k-<pos>-<1..3>`; hearts `h-0`…`h-2`; level `lv-1`…`lv-5`; digits `d<0..3><a..g>`, `colon`; labels `lbl-A`, `lbl-B`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/ui/lcd-art.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SEGMENT_IDS, lcdMarkup } from './lcd-art.js';

describe('lcdMarkup', () => {
  document.body.innerHTML = lcdMarkup();
  const ids = [...document.querySelectorAll('[data-seg]')].map((e) => e.getAttribute('data-seg'));

  it('draws every segment exactly once', () => {
    expect([...ids].sort()).toEqual([...SEGMENT_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the flights, courier positions, crate fill and hearts the game needs', () => {
    expect(SEGMENT_IDS.filter((id) => id.startsWith('p-'))).toHaveLength(20);
    expect(SEGMENT_IDS.filter((id) => id.startsWith('q-'))).toHaveLength(12);
    expect(SEGMENT_IDS.filter((id) => /^c-[1-5]$/.test(id))).toHaveLength(5);
    expect(SEGMENT_IDS.filter((id) => id.startsWith('k-'))).toHaveLength(15);
    for (const id of ['t-0', 't-1', 'h-0', 'h-2', 'drone-3', 'bird-0', 'b-2', 'lv-5', 'colon', 'lbl-B']) {
      expect(SEGMENT_IDS, id).toContain(id);
    }
  });

  it('uses only the board sprites for images', () => {
    const hrefs = [...document.querySelectorAll('image')].map((i) => i.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/sprites\/[a-z-]+\.png$/);
    }
  });
});
```

```ts
// src/ui/lcd.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { newGame } from '../core/game.js';
import type { GameState } from '../core/game.js';
import { displayText, litSegments } from './lcd.js';

const game = (over: Partial<GameState>): GameState => ({ ...newGame('A', 1), ...over });
const lit = (over: Partial<GameState>, blink = true) => litSegments({ kind: 'game', state: game(over), blink });

describe('litSegments', () => {
  it('lights the courier at his position with his crate fill', () => {
    const s = lit({ pos: 2, crate: 2 });
    expect(['c-2', 'k-2-1', 'k-2-2'].every((id) => s.has(id))).toBe(true);
    expect(s.has('k-2-3') || s.has('c-3')).toBe(false);
  });

  it('lights throws, drops and the drone above a dropping spot', () => {
    const s = lit({ flights: [{ kind: 'throw', spot: 1, step: 3 }, { kind: 'drop', spot: 3, step: 0 }] });
    expect(['p-1-3', 'q-3-0', 'drone-3'].every((id) => s.has(id))).toBe(true);
  });

  it('shows hearts, the bird, the thrower frame and the level', () => {
    const s = lit({ hearts: 2, bird: { spot: 0, ticks: 3 }, thrower: 1, score: 40 });
    expect(['h-0', 'h-1', 'bird-0', 't-1', 'lv-3', 'lbl-A'].every((id) => s.has(id))).toBe(true);
    expect(s.has('h-2') || s.has('t-0') || s.has('lv-4')).toBe(false);
  });

  it('blinks the broken parcel during the freeze', () => {
    expect(lit({ pause: 2, broken: 2 }, true).has('b-2')).toBe(true);
    expect(lit({ pause: 2, broken: 2 }, false).has('b-2')).toBe(false);
  });
});

describe('displayText', () => {
  it('shows the score right-aligned, the clock, and blinks after the shift', () => {
    expect(displayText({ kind: 'game', state: game({ score: 42 }), blink: true })).toBe('  42');
    expect(displayText({ kind: 'game', state: game({ score: 1234 }), blink: true })).toBe(' 234');
    expect(displayText({ kind: 'game', state: game({ over: true }), blink: false })).toBe('    ');
    expect(displayText({ kind: 'clock', hours: 9, minutes: 5, pos: 3, blink: true })).toBe(' 905');
    expect(displayText({ kind: 'record', mode: 'B', record: 210 })).toBe(' 210');
  });
});
```

Run: `npx vitest run src/ui/lcd-art.test.ts src/ui/lcd.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement the scene**

```ts
// src/ui/lcd-art.ts
/**
 * The LCD scene, laid out like the owner's art board: a balcony and house on
 * the left where the thrower stands, trees and a lamp along the street, the
 * parcel locker at the right. Scenery is the faint print; everything that
 * moves is a fixed segment the game lights or darkens. Most segments are
 * sprites cut from the board (public/sprites); the digits are drawn.
 * No colours here: CSS paints `.lcd-print`, `[data-seg]` and `[data-seg][data-on]`.
 */
import { DROP_STEPS, POSITIONS, SPOTS, THROW_STEPS } from '../core/game.js';

/** Courier positions 1–5 (centre x); 5 stands at the locker. */
export const POSITION_X: readonly number[] = [128, 180, 232, 284, 352];
const GROUND = 214;
const CATCH_Y = 150;
const HAND: readonly [number, number] = [88, 70];
const n = (v: number): string => v.toFixed(1).replace(/\.0$/, '');

const sprite = (name: string, x: number, y: number, w: number, h: number, extra = ''): string =>
  `<image href="/sprites/${name}.png" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${extra}/>`;
const seg = (id: string, body: string): string => `<g data-seg="${id}">${body}</g>`;

/** A throw's centre at step i (0–4): a parabola from the hand to the catch point. */
function arcPoint(spot: number, i: number): readonly [number, number] {
  const tx = POSITION_X[spot] ?? 0;
  const t = (i + 1) / THROW_STEPS;
  const x = HAND[0] + (tx - HAND[0]) * t;
  const y = HAND[1] + (CATCH_Y - HAND[1]) * t - 46 * 4 * t * (1 - t);
  return [x, y];
}

const PARCEL_FRAMES = ['parcel-b', 'parcel-c', 'parcel-d', 'parcel-e', 'parcel-a'];

const throwSegments = Array.from({ length: SPOTS }, (_, spot) =>
  Array.from({ length: THROW_STEPS }, (_, i) => {
    const [x, y] = arcPoint(spot, i);
    return seg(`p-${String(spot)}-${String(i)}`, sprite(PARCEL_FRAMES[i] ?? 'parcel-a', x - 11, y - 11, 22, 22));
  }).join(''),
).join('');

const dropSegments = Array.from({ length: SPOTS }, (_, spot) =>
  Array.from({ length: DROP_STEPS }, (_, i) => {
    const x = POSITION_X[spot] ?? 0;
    const y = 56 + ((CATCH_Y - 56) * (i + 1)) / DROP_STEPS;
    return seg(`q-${String(spot)}-${String(i)}`, sprite('parcel-a', x - 10, y - 10, 20, 20));
  }).join(''),
).join('');

const drones = Array.from({ length: SPOTS }, (_, spot) =>
  seg(`drone-${String(spot)}`, sprite('drone', (POSITION_X[spot] ?? 0) - 19, 18, 38, 31)),
).join('');

const birds = Array.from({ length: SPOTS }, (_, spot) => {
  const [x, y] = arcPoint(spot, 2);
  return seg(`bird-${String(spot)}`, sprite('bird-perch', x - 13, y - 30, 27, 24));
}).join('');

const broken = Array.from({ length: SPOTS }, (_, spot) =>
  seg(
    `b-${String(spot)}`,
    sprite('parcel-c', (POSITION_X[spot] ?? 0) - 12, GROUND - 16, 24, 18, ' transform-origin="center" ') +
      `<path d="M${n((POSITION_X[spot] ?? 0) - 10)} ${n(GROUND - 22)}l-4 -6M${n(POSITION_X[spot] ?? 0)} ${n(GROUND - 24)}v-7M${n((POSITION_X[spot] ?? 0) + 10)} ${n(GROUND - 22)}l4 -6" class="lcd-stroke"/>`,
  ),
).join('');

/**
 * Placeholder courier and thrower until the owner's second board arrives:
 * simple ink silhouettes holding a crate. Replacing them is a matter of
 * sprite names in COURIER_SPRITE / THROWER_SPRITE.
 */
const COURIER_SPRITE: string | null = null;
const THROWER_SPRITE: readonly (string | null)[] = [null, null];

function courierBody(x: number): string {
  if (COURIER_SPRITE !== null) {
    return sprite(COURIER_SPRITE, x - 24, GROUND - 64, 48, 64);
  }
  return (
    `<circle cx="${n(x + 2)}" cy="${n(GROUND - 52)}" r="8"/>` +
    `<path d="M${n(x - 7)} ${n(GROUND - 56)}a9 9 0 0 1 18 0z"/>` +
    `<path d="M${n(x - 9)} ${n(GROUND - 42)}h20l3 22h-26z"/>` +
    `<path d="M${n(x - 7)} ${n(GROUND - 20)}h7l-1 20h-8zM${n(x + 3)} ${n(GROUND - 20)}h7l2 20h-8z"/>` +
    `<path d="M${n(x - 14)} ${n(CATCH_Y - 2)}h28v4l-3 9h-22l-3 -9z"/>`
  );
}

const crateFill = (pos: number, k: number): string => {
  const x = (POSITION_X[pos - 1] ?? 0) - 12 + (k - 1) * 8;
  return seg(`k-${String(pos)}-${String(k)}`, `<rect x="${n(x)}" y="${n(CATCH_Y - 7)}" width="7" height="6" rx="1"/>`);
};

const couriers = Array.from({ length: POSITIONS }, (_, i) => {
  const pos = i + 1;
  return seg(`c-${String(pos)}`, courierBody(POSITION_X[i] ?? 0)) + [1, 2, 3].map((k) => crateFill(pos, k)).join('');
}).join('');

function throwerBody(frame: 0 | 1): string {
  const s = THROWER_SPRITE[frame] ?? null;
  if (s !== null) {
    return sprite(s, 52, 26, 44, 56);
  }
  const arm = frame === 0 ? 'M72 54l10 -10' : 'M72 54l18 8';
  return (
    '<circle cx="66" cy="40" r="8"/><path d="M57 50h18l2 24h-22z"/>' +
    `<path d="${arm}" class="lcd-stroke lcd-thick"/>` +
    (frame === 0 ? sprite('parcel-a', 76, 30, 14, 14) : '')
  );
}

/* digits: mitred seven-segment numerals, as before */
const DIGIT_X: readonly number[] = [300, 320, 346, 366];
const W = 13;
const H = 13;
const T = 2.8;
const hz = (x: number, y: number): string =>
  `M${n(x + 1.4)} ${n(y)}l${n(T / 2)} ${n(-T / 2)}H${n(x + W - 1.4 - T / 2)}l${n(T / 2)} ${n(T / 2)}l${n(-T / 2)} ${n(T / 2)}H${n(x + 1.4 + T / 2)}Z`;
const vt = (x: number, y: number): string =>
  `M${n(x)} ${n(y + 1.4)}l${n(T / 2)} ${n(T / 2)}V${n(y + H - 1.4 - T / 2)}l${n(-T / 2)} ${n(T / 2)}l${n(-T / 2)} ${n(-T / 2)}V${n(y + 1.4 + T / 2)}Z`;
const DIGIT_SEGMENTS: Readonly<Record<string, (x: number, y: number) => string>> = {
  a: (x, y) => hz(x, y), b: (x, y) => vt(x + W, y), c: (x, y) => vt(x + W, y + H),
  d: (x, y) => hz(x, y + 2 * H), e: (x, y) => vt(x, y + H), f: (x, y) => vt(x, y), g: (x, y) => hz(x, y + H),
};
const digit = (i: number): string =>
  Object.entries(DIGIT_SEGMENTS)
    .map(([name, shape]) => seg(`d${String(i)}${name}`, `<path d="${shape(DIGIT_X[i] ?? 0, 12)}"/>`))
    .join('');
const colon = seg('colon', '<circle cx="341" cy="21" r="1.5"/><circle cx="339.6" cy="32" r="1.5"/>');

const hearts = [0, 1, 2].map((i) => seg(`h-${String(i)}`, sprite('heart', 300 + i * 22, 46, 18, 18))).join('');
const levels = [1, 2, 3, 4, 5].map((l) => seg(`lv-${String(l)}`, `<circle cx="${String(232 + l * 10)}" cy="20" r="3"/>`)).join('');
const labels =
  '<text x="208" y="24" class="lcd-text lcd-label" data-t="lcd.game"></text>' +
  seg('lbl-A', '<text x="208" y="38" class="lcd-text">A</text>') +
  seg('lbl-B', '<text x="222" y="38" class="lcd-text">B</text>');

const PRINT = [
  sprite('house', 0, 60, 84, 143),
  sprite('tree', 96, 150, 40, 57),
  sprite('lamp', 300, 128, 15, 86),
  sprite('bush', 250, 168, 40, 46),
  sprite('locker', 322, 150, 78, 54),
  `<path d="M0 ${String(GROUND)}H400" class="lcd-stroke"/>`,
].join('');

export const SEGMENT_IDS: readonly string[] = [
  't-0', 't-1',
  ...Array.from({ length: SPOTS }, (_, s) => Array.from({ length: THROW_STEPS }, (_, i) => `p-${String(s)}-${String(i)}`)).flat(),
  ...Array.from({ length: SPOTS }, (_, s) => Array.from({ length: DROP_STEPS }, (_, i) => `q-${String(s)}-${String(i)}`)).flat(),
  ...Array.from({ length: SPOTS }, (_, s) => [`drone-${String(s)}`, `bird-${String(s)}`, `b-${String(s)}`]).flat(),
  ...Array.from({ length: POSITIONS }, (_, i) => [`c-${String(i + 1)}`, ...[1, 2, 3].map((k) => `k-${String(i + 1)}-${String(k)}`)]).flat(),
  'h-0', 'h-1', 'h-2', 'lv-1', 'lv-2', 'lv-3', 'lv-4', 'lv-5',
  ...[0, 1, 2, 3].flatMap((d) => Object.keys(DIGIT_SEGMENTS).map((s) => `d${String(d)}${s}`)),
  'colon', 'lbl-A', 'lbl-B',
];

export function lcdMarkup(): string {
  return [
    '<svg id="lcd-svg" viewBox="0 0 400 240" role="img" data-t-label="lcd.label" xmlns="http://www.w3.org/2000/svg">',
    `<g class="lcd-print">${PRINT}</g>`,
    labels, levels, hearts,
    [0, 1, 2, 3].map(digit).join(''), colon,
    seg('t-0', throwerBody(0)), seg('t-1', throwerBody(1)),
    drones, birds, throwSegments, dropSegments, couriers, broken,
    '</svg>',
  ].join('');
}
```

- [ ] **Step 3: Implement the view**

```ts
// src/ui/lcd.ts
import { displayScore, level } from '../core/game.js';
import type { GameState, Mode } from '../core/game.js';
import { setAttr } from './dom.js';

export type LcdView =
  | { readonly kind: 'game'; readonly state: GameState; readonly blink: boolean }
  | { readonly kind: 'clock'; readonly hours: number; readonly minutes: number; readonly pos: number; readonly blink: boolean }
  | { readonly kind: 'record'; readonly mode: Mode; readonly record: number };

const DIGITS: Readonly<Record<string, string>> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ' ': '',
};
const pad4 = (v: number): string => String(v).padStart(4, ' ');

export function displayText(view: LcdView): string {
  switch (view.kind) {
    case 'game':
      return view.state.over && !view.blink ? '    ' : pad4(displayScore(view.state.score));
    case 'record':
      return pad4(displayScore(view.record));
    case 'clock':
      return `${String(view.hours).padStart(2, ' ')}${String(view.minutes).padStart(2, '0')}`;
  }
}

export function litSegments(view: LcdView): Set<string> {
  const lit = new Set<string>();
  [...displayText(view)].forEach((char, i) => {
    for (const s of DIGITS[char] ?? '') {
      lit.add(`d${String(i)}${s}`);
    }
  });
  if (view.kind === 'clock') {
    lit.add(`c-${String(view.pos)}`);
    lit.add('t-0');
    if (view.blink) {
      lit.add('colon');
    }
    return lit;
  }
  if (view.kind === 'record') {
    lit.add(`lbl-${view.mode}`);
    return lit;
  }
  const { state, blink } = view;
  lit.add(`lbl-${state.mode}`);
  lit.add(`lv-${String(level(state.mode, state.score))}`);
  lit.add(`t-${String(state.thrower)}`);
  lit.add(`c-${String(state.pos)}`);
  for (let k = 1; k <= state.crate; k += 1) {
    lit.add(`k-${String(state.pos)}-${String(k)}`);
  }
  for (let h = 0; h < state.hearts; h += 1) {
    lit.add(`h-${String(h)}`);
  }
  for (const f of state.flights) {
    lit.add(`${f.kind === 'throw' ? 'p' : 'q'}-${String(f.spot)}-${String(f.step)}`);
    if (f.kind === 'drop') {
      lit.add(`drone-${String(f.spot)}`);
    }
  }
  if (state.bird !== null) {
    lit.add(`bird-${String(state.bird.spot)}`);
  }
  if (state.broken !== null && blink) {
    lit.add(`b-${String(state.broken)}`);
  }
  return lit;
}

export function renderLcd(svg: Element, view: LcdView): void {
  const lit = litSegments(view);
  for (const element of svg.querySelectorAll('[data-seg]')) {
    setAttr(element, 'data-on', lit.has(element.getAttribute('data-seg') ?? '') ? '' : null);
  }
  setAttr(svg, 'data-display', displayText(view));
}
```

In `src/theme/app.css`: `.lcd { aspect-ratio: 5 / 3; … }`; add `.lcd-stroke { fill: none; stroke: var(--lcd-ink); stroke-width: 1.4; stroke-linecap: round; }`, `.lcd-thick { stroke-width: 5; }`, and `.lcd-print image, .lcd-print .lcd-stroke { opacity: 0.55; }` (the print is fainter than the segments).

Run: `npx vitest run src/ui/lcd-art.test.ts src/ui/lcd.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/lcd-art.ts src/ui/lcd-art.test.ts src/ui/lcd.ts src/ui/lcd.test.ts src/theme/app.css
git commit -m "feat(ui): the thrown-parcels LCD scene built from the board's sprites"
```

---

### Task 4: Controls, loop, page

**Files:**
- Modify: `src/ui/controls.ts`, `src/ui/controls.test.ts`, `src/audio/sfx.ts`, `src/audio/sfx.test.ts`, `src/main.ts`, `src/ui/slip.ts`, `src/ui/slip.test.ts`, `src/i18n/pl.ts`, `src/i18n/en.ts`, `index.html`, `src/theme/app.css`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `type Command = { kind: 'step'; dir: -1 | 1 } | { kind: 'goto'; pos: number } | { kind: 'start'; mode: Mode } | { kind: 'clock' }`; `commandForKey(code)`; `targetPos(current: number, command: Command): number | null`; `bindControls(root, lcd, onCommand)` (left/right half of the LCD → step −1/+1; `[data-move="-1"|"1"]` buttons); `Cue = 'step' | 'throw' | 'catch' | 'miss' | 'deliver' | 'bonus' | 'over'`, `cueFor(event)`; `slipText(points, record, lang)`, `shareText(mode, points, isNew, lang)`.

- [ ] **Step 1: Write the failing tests**

In `src/ui/controls.test.ts`, replace the key-map, target and quadrant tests with:

```ts
describe('commandForKey', () => {
  it.each([
    ['KeyA', { kind: 'step', dir: -1 }], ['ArrowLeft', { kind: 'step', dir: -1 }],
    ['KeyD', { kind: 'step', dir: 1 }], ['ArrowRight', { kind: 'step', dir: 1 }],
    ['Numpad1', { kind: 'goto', pos: 1 }], ['Numpad5', { kind: 'goto', pos: 5 }],
    ['Space', { kind: 'start', mode: 'A' }], ['KeyB', { kind: 'start', mode: 'B' }],
  ])('%s', (code, command) => {
    expect(commandForKey(code)).toEqual(command);
  });

  it('ignores up and down and everything else', () => {
    for (const code of ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'KeyQ']) {
      expect(commandForKey(code), code).toBeNull();
    }
  });
});

describe('targetPos', () => {
  it('steps one position or jumps, and has no target for other commands', () => {
    expect(targetPos(3, { kind: 'step', dir: -1 })).toBe(2);
    expect(targetPos(5, { kind: 'step', dir: 1 })).toBe(6);
    expect(targetPos(3, { kind: 'goto', pos: 5 })).toBe(5);
    expect(targetPos(3, { kind: 'clock' })).toBeNull();
  });
});
```

Update the `bindControls` test fixtures to `<button data-move="1">` (expecting `{ kind: 'step', dir: 1 }`), a keydown `Numpad3` (expecting `{ kind: 'goto', pos: 3 }`), and keep the keyboard/assistive-tech tests, replacing `KeyW` with `KeyD` where they need a game key.

In `src/ui/slip.test.ts`, expect `slipText(142, 210, 'pl')` → `'Koniec zmiany: 142 pkt · rekord: 210'`, `slipText(1, 1, 'en')` → `'End of shift: 1 pt · record: 1'`, and `shareText('A', 1005, true, 'pl')` → `['paczkom.at · Gra A', '📦 1005 pkt', 'Nowy rekord!', 'https://paczkom.at'].join('\n')`.

In `src/audio/sfx.test.ts`, change cue names to the new set and `cueFor` expectations: `cueFor('catch')` → `'catch'`, `cueFor('deliver')` → `'deliver'`, `cueFor('bird')` → `null`, `cueFor('drop')` → `'throw'`.

Run: `npx vitest run src/ui/controls.test.ts src/ui/slip.test.ts src/audio/sfx.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement controls**

In `src/ui/controls.ts`: replace `Command`, `KEYS`, `targetChute` and `quadrantChute` with:

```ts
export type Command =
  | { readonly kind: 'step'; readonly dir: -1 | 1 }
  | { readonly kind: 'goto'; readonly pos: number }
  | { readonly kind: 'start'; readonly mode: Mode }
  | { readonly kind: 'clock' };

/** A/← and D/→ step one position; the numpad's 1–5 jump straight to one. */
const KEYS: Readonly<Record<string, Command>> = {
  KeyA: { kind: 'step', dir: -1 },
  ArrowLeft: { kind: 'step', dir: -1 },
  KeyD: { kind: 'step', dir: 1 },
  ArrowRight: { kind: 'step', dir: 1 },
  Numpad1: { kind: 'goto', pos: 1 },
  Numpad2: { kind: 'goto', pos: 2 },
  Numpad3: { kind: 'goto', pos: 3 },
  Numpad4: { kind: 'goto', pos: 4 },
  Numpad5: { kind: 'goto', pos: 5 },
  Space: { kind: 'start', mode: 'A' },
  Enter: { kind: 'start', mode: 'A' },
  KeyB: { kind: 'start', mode: 'B' },
};

export function targetPos(current: number, command: Command): number | null {
  if (command.kind === 'step') {
    return current + command.dir;
  }
  return command.kind === 'goto' ? command.pos : null;
}
```

In `commandFor`, read `data-move` as `-1 | 1`: `const dir = button.dataset['move']; if (dir === '-1' || dir === '1') return { kind: 'step', dir: dir === '1' ? 1 : -1 };`. In the LCD `pointerdown` handler: `onCommand({ kind: 'step', dir: e.clientX - box.left < box.width / 2 ? -1 : 1 })`. Remove the `Chute` import.

- [ ] **Step 3: Sound, slip, copy**

In `src/audio/sfx.ts`: `export type Cue = 'step' | 'throw' | 'catch' | 'miss' | 'deliver' | 'bonus' | 'over';` and

```ts
export function cueFor(event: GameEvent): Cue | null {
  switch (event) {
    case 'step': case 'catch': case 'miss': case 'deliver': case 'bonus': case 'over': case 'throw':
      return event;
    case 'drop':
      return 'throw';
    case 'bird':
      return null;
  }
}
```

In `VOICES`, rename `customer` → `throw` (keep its two notes, gain 0.06) and add `deliver` (the three-note `bonus` arpeggio an octave lower); keep the others.

`src/ui/slip.ts`:

```ts
export function slipText(points: number, record: number, lang: Lang): string {
  return translate(lang, 'slip.over', { points, record, unit: translate(lang, points === 1 ? 'unit.one' : 'unit.many') });
}

export function shareText(mode: Mode, points: number, isNew: boolean, lang: Lang): string {
  return [
    `paczkom.at · ${translate(lang, 'share.game', { mode })}`,
    `📦 ${String(points)} ${translate(lang, points === 1 ? 'unit.one' : 'unit.many')}`,
    isNew ? translate(lang, 'slip.newRecord') : null,
    SHARE_URL,
  ].filter((line): line is string => line !== null).join('\n');
}
```

Catalogues — remove `btn.lu`, `btn.ld`, `btn.ru`, `btn.rd`, `count.parcels.*`, `live.complaint`; remove `countParcels`/`pluralForm` from `src/i18n/index.ts` and their test; add / change (PL then EN):

```
'btn.left': 'W lewo' / 'Left',
'btn.right': 'W prawo' / 'Right',
'slip.over': 'Koniec zmiany: {points} {unit} · rekord: {record}' / 'End of shift: {points} {unit} · record: {record}',
'unit.one': 'pkt' / 'pt',
'unit.many': 'pkt' / 'pts',
'live.score': 'Punkty: {score}' / 'Points: {score}',
'live.hearts': 'Serca: {count}' / 'Hearts: {count}',
'live.deliver': 'Dostarczone.' / 'Delivered.',
'help.keys': 'Klawisze: A/D lub ←/→ — w lewo i w prawo, 1–5 na klawiaturze numerycznej. Automat jest na prawym końcu. Spacja: gra A, B: gra B.' / 'Keys: A/D or ←/→ — left and right, numpad 1–5. The locker is at the far right. Space: game A, B: game B.',
'meta.tagline': 'Łap rzucane paczki i noś je do automatu. Gra w stylu konsolek LCD.' / 'Catch thrown parcels and carry them to the locker. An LCD-handheld game.',
```

(EN `unit.one` is "pt" for "1 pt"; the slip test expects `End of shift: 1 pt · record: 1`.)

- [ ] **Step 4: Page and loop**

`index.html`: replace the two `.pad` columns' four round buttons with one round button each: `<button class="round" type="button" data-move="-1" data-t-label="btn.left"><span class="round__glyph" aria-hidden="true">←</span></button>` (left pad) and the same with `data-move="1"`, `btn.right`, `→` (right pad). Inside `.handheld__screen`, wrap the LCD: `<p class="lcd-title" aria-hidden="true">PACZKOM.AT</p>` before `#lcd`, `<p class="lcd-title lcd-title--foot" aria-hidden="true">ELEKTRONIKA PACZKOM.AT</p>` after it. Update `<meta name="description">`/`og:description` to the PL `meta.tagline`.

`src/theme/app.css`: `.handheld__screen { background: var(--plate-lcd); … }` is not needed — keep the bezel, add `.lcd-title { margin: 0.2rem 0; text-align: center; font: 700 0.95rem var(--font); letter-spacing: 0.08em; color: var(--lcd-bg); } .lcd-title--foot { font-size: 0.7rem; letter-spacing: 0.18em; }`.

`src/main.ts` — change only what the rules changed:
- imports: `move, newGame, step, tickInterval, LOCKER` from game; `bindControls, targetPos` from controls; drop `CHUTES`, `Chute`.
- `let pose: Chute = 'LD'` → `let idlePos = 3`; the clock view becomes `{ kind: 'clock', hours, minutes, pos: idlePos, blink }`; the pose timer picks `idlePos = (new Date().getSeconds() % 5) + 1`.
- a shared event handler used by both ticks and moves:

```ts
function handle(events: readonly GameEvent[]): void {
  if (game === null) {
    return;
  }
  for (const event of events) {
    const cue = cueFor(event);
    if (cue !== null) {
      sfx.play(cue);
    }
    if (event === 'deliver') {
      setText(live, t('live.score', { score: game.score }));
    } else if (event === 'miss') {
      setText(live, t('live.hearts', { count: game.hearts }));
    }
  }
}
```

  `tick()` calls `handle(result.events)` after assigning `game = result.state`.
- `onCommand`: for moves, `const to = targetPos(game.pos, command); if (to !== null) { const r = move(game, to); game = r.state; handle(r.events); render(); }`.
- `finish()` uses `game.score` as points (unchanged code path).

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass. Open the preview and play a few throws: the parcel arcs land where the courier can stand, the crate fills, A/D and arrows move, Numpad5 delivers.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: thrown-parcels game wired up — controls, sound, slip, page"
```

---

### Task 5: E2E, site tests, README

**Files:**
- Modify: `e2e/fixtures.ts`, `e2e/game.spec.ts`, `src/site.test.ts`, `README.md`

- [ ] **Step 1: E2E**

`e2e/fixtures.ts`: replace `lipKey` with:

```ts
/** The numpad key that puts the courier under the parcel landing next, or null. */
export async function landingKey(page: Page): Promise<string | null> {
  for (let spot = 0; spot < 4; spot += 1) {
    if ((await page.locator(`[data-seg="p-${String(spot)}-3"][data-on], [data-seg="q-${String(spot)}-1"][data-on]`).count()) > 0) {
      return `Numpad${String(spot + 1)}`;
    }
  }
  return null;
}
```

In `e2e/game.spec.ts`: replace the four-chute helpers and tests with these behaviours (keeping the clock, hidden-tab, language and slip-hidden tests): a perfect player catches (`[data-seg^="k-"][data-on]` appears) and Numpad5 delivers (display increases by 2 × crate); doing nothing loses hearts (`h-2` goes dark) and ends the shift with the slip and a share fallback ending in `https://paczkom.at`; the record survives a reload (read the points from `#slip-text` with `/(\d+)\s+pkt/`); A/D and the arrows move the courier (`c-3` → `c-2` → `c-3` → `c-4`) without scrolling. Tick length at level 1 is 700 ms; run the clock in 700 ms steps.

- [ ] **Step 2: Site tests and README**

`src/site.test.ts`: the handheld test checks `data-move="-1"`, `data-move="1"`, `data-start="A"`, `data-start="B"`, `data-clock`; scripts list adds `gen:art`; README test checks `Gra A` and `gen:art`.

`README.md`: rewrite "How to play" for the new rules (positions, crate of three, locker for double points, hearts, drone, bird, levels, keys), add `npm run gen:art` (needs ImageMagick) under Develop, and note that the art comes from the owner's board in `scripts/art/source/`, with the courier and thrower still placeholders.

- [ ] **Step 3: Full gate and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e`
Expected: everything passes.

```bash
git add -A
git commit -m "test: e2e, site tests and README for the thrown-parcels game"
```

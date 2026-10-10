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
/** Per level: the share of new parcels a drone drops, and the chance a bird lands on a free tick. */
const DRONE_SHARE: readonly number[] = [0, 0, 0.25, 0.25, 0.35];
const BIRD_CHANCE: readonly number[] = [0, 0.05, 0.05, 0.05, 0.08];
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

export function hazards(lvl: number): { readonly drone: number; readonly bird: number } {
  return { drone: DRONE_SHARE[lvl - 1] ?? 0, bird: BIRD_CHANCE[lvl - 1] ?? 0 };
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
  // Play is frozen while a broken parcel blinks.
  if (state.over || state.pause > 0) {
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
    const kind: Flight['kind'] = roll < hazards(lvl).drone ? 'drop' : 'throw';
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
  if (bird === null && hazards(lvl).bird > 0) {
    [roll, rng] = next(rng);
    if (roll < hazards(lvl).bird) {
      let spot: number;
      [spot, rng] = nextInt(rng, SPOTS);
      nextBird = { spot, ticks: BIRD_TICKS };
      events.push('bird');
    }
  }

  return { state: { ...state, rng, crate, hearts, flights, bird: nextBird, thrower, broken: null }, events };
}

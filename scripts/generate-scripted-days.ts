/**
 * Regenerates `src/core/fixtures/scripted-days.ts`.
 *
 * The fixtures are the regression net for the whole day loop: a seed, a static
 * action log, and the summary the reducer must still produce. Run this only
 * when the rules deliberately change, and review the diff — a fixture moving is
 * a rule moving.
 *
 *   npm run gen:fixtures
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeLog } from '../src/core/actionLog.js';
import {
  activeCustomer,
  currentParcel,
  initialState,
  reduce,
} from '../src/core/game.js';
import type { Action, DaySummary, State } from '../src/core/game.js';
import { DAILY_PROFILE, SATURDAY, THURSDAY } from '../src/core/profiles.js';
import type { DayProfile } from '../src/core/profiles.js';
import { fits, sizeRank } from '../src/core/wall.js';

const TICK_MS = 250;
const GUARD = 5_000;

interface Take {
  readonly state: State;
  readonly actions: readonly Action[];
}

const apply = (take: Take, action: Action): Take => ({
  state: reduce(take.state, action),
  actions: [...take.actions, action],
});

const tick = (take: Take): Take => apply(take, { type: 'tick', dtMs: TICK_MS });

/**
 * The smallest free door that takes this parcel. Taking the *first* one instead
 * would spend C doors on A parcels and strand the big ones later.
 */
function freeSlotFor(state: State, size: 'A' | 'B' | 'C'): string | null {
  return (
    [...state.slots]
      .filter((slot) => slot.state === 'empty' && !slot.jammed && fits(size, slot.size))
      .sort((a, b) => sizeRank(a.size) - sizeRank(b.size))[0]?.id ?? null
  );
}

function targetSlot(state: State): string | null {
  const active = activeCustomer(state);
  if (active === null) {
    return null;
  }
  if (active.kind === 'sender') {
    // A jammed door will not take an outgoing parcel.
    return state.slots.find(
      (slot) => slot.state === 'empty' && !slot.jammed && fits(active.needsSize, slot.size),
    )?.id ?? null;
  }
  return state.slots.find((slot) => slot.parcelId === active.parcelId)?.id ?? null;
}

function decoySlot(state: State): string | null {
  const active = activeCustomer(state);
  if (active === null) {
    return null;
  }
  const theirs = active.kind === 'pickup' ? active.parcelId : null;
  return state.slots.find((slot) => slot.state === 'full' && slot.parcelId !== theirs)?.id ?? null;
}

function load(take: Take, limit: number): Take {
  let current = take;
  let placed = 0;
  while (current.state.phase === 'LOAD' && placed < limit) {
    const parcel = currentParcel(current.state);
    if (parcel === null) {
      break;
    }
    const slotId = freeSlotFor(current.state, parcel.size);
    if (slotId === null) {
      break;
    }
    current = apply(current, { type: 'tapSlot', slotId });
    placed += 1;
  }
  return current;
}

function sweep(take: Take): Take {
  let current = take;
  for (let guard = 0; guard < GUARD && current.state.phase === 'SWEEP'; guard += 1) {
    const marked = current.state.slots.find((slot) => slot.state === 'marked');
    current = marked === undefined ? tick(current) : apply(current, { type: 'tapSlot', slotId: marked.id });
  }
  return current;
}

const begin = (seed: number, profile: DayProfile): Take =>
  apply({ state: initialState(seed, profile), actions: [] }, { type: 'start' });

/**
 * Everything placed, every customer served as soon as they reach the counter.
 * A jammed door simply costs a second tap, which is what `targetSlot` returning
 * the same door twice produces.
 */
function perfectDay(seed: number, profile: DayProfile): Take {
  let current = load(begin(seed, profile), Infinity);
  for (let guard = 0; guard < GUARD && current.state.phase === 'SERVE'; guard += 1) {
    const slotId = targetSlot(current.state);
    current = slotId === null ? tick(current) : apply(current, { type: 'tapSlot', slotId });
  }
  return sweep(current);
}

/** One wrong door per customer, so every service is earned with a hint. */
function hintedDay(seed: number, profile: DayProfile): Take {
  let current = load(begin(seed, profile), Infinity);
  for (let guard = 0; guard < GUARD && current.state.phase === 'SERVE'; guard += 1) {
    const active = activeCustomer(current.state);
    if (active === null) {
      current = tick(current);
      continue;
    }
    if (active.wrongTaps === 0) {
      const decoy = decoySlot(current.state);
      current = decoy === null ? tick(current) : apply(current, { type: 'tapSlot', slotId: decoy });
      continue;
    }
    const slotId = targetSlot(current.state);
    current = slotId === null ? tick(current) : apply(current, { type: 'tapSlot', slotId });
  }
  return sweep(current);
}

/** Half the van never leaves it and nobody is ever served. */
function walkedDay(seed: number, profile: DayProfile): Take {
  let current = load(begin(seed, profile), Math.floor(profile.pickups / 2));
  for (let guard = 0; guard < GUARD && current.state.phase === 'LOAD'; guard += 1) {
    current = tick(current);
  }
  for (let guard = 0; guard < GUARD && current.state.phase === 'SERVE'; guard += 1) {
    current = tick(current);
  }
  return sweep(current);
}

const takes: { name: string; seed: number; profile: DayProfile; take: Take }[] = [
  { name: 'perfect day', seed: 20260901, profile: DAILY_PROFILE, take: perfectDay(20260901, DAILY_PROFILE) },
  { name: 'hinted day', seed: 20260902, profile: DAILY_PROFILE, take: hintedDay(20260902, DAILY_PROFILE) },
  {
    name: 'walked and refused day',
    seed: 20260903,
    profile: DAILY_PROFILE,
    take: walkedDay(20260903, DAILY_PROFILE),
  },
  // Thursday is the day the jam appears; Saturday has every event at once.
  { name: 'thursday with a jam', seed: 20260904, profile: THURSDAY, take: perfectDay(20260904, THURSDAY) },
  { name: 'saturday with everything', seed: 20260905, profile: SATURDAY, take: perfectDay(20260905, SATURDAY) },
];

function summaryOf(state: State): DaySummary {
  if (state.summary === null) {
    throw new Error(`a scripted day did not reach SUMMARY (stopped in ${state.phase})`);
  }
  return state.summary;
}

const body = takes
  .map(({ name, seed, profile, take }) => {
    const summary = summaryOf(take.state);
    const outcomes = Object.entries(summary.slotOutcomes)
      .map(([slotId, outcome]) => `        ${slotId}: '${outcome}',`)
      .join('\n');
    const actions = encodeLog(take.actions)
      .map((token) => `'${token}'`)
      .join(', ');
    return `  {
    name: '${name}',
    seed: ${String(seed)},
    profile: '${profile.id}',
    actions: [${actions}],
    expected: {
      served: ${String(summary.served)},
      hinted: ${String(summary.hinted)},
      walked: ${String(summary.walked)},
      refused: ${String(summary.refused)},
      unplaced: ${String(summary.unplaced)},
      wrongTaps: ${String(summary.wrongTaps)},
      score: ${String(summary.score)},
      timeMs: ${String(summary.timeMs)},
      slotOutcomes: {
${outcomes}
      },
    },
  },`;
  })
  .join('\n');

const file = `/**
 * Scripted days: the regression net for the whole day loop.
 *
 * GENERATED by \`npm run gen:fixtures\`. Do not edit by hand — regenerate, and
 * treat any change to an expected summary as a deliberate rule change to
 * review.
 */
import type { DaySummary } from '../game.js';

export interface ScriptedDay {
  readonly name: string;
  readonly seed: number;
  /** Which profile to replay it against. */
  readonly profile: string;
  /** Run-length encoded action tokens; expand with \`decodeLog\`. */
  readonly actions: readonly string[];
  readonly expected: DaySummary;
}

export const SCRIPTED_DAYS: readonly ScriptedDay[] = [
${body}
];
`;

const target = fileURLToPath(new URL('../src/core/fixtures/scripted-days.ts', import.meta.url));
writeFileSync(target, file, 'utf8');
process.stdout.write(`wrote ${target}\n`);
for (const { name, take } of takes) {
  const summary = summaryOf(take.state);
  process.stdout.write(
    `  ${name}: ${String(take.actions.length)} actions, score ${String(summary.score)}, ` +
      `served ${String(summary.served)} hinted ${String(summary.hinted)} walked ${String(summary.walked)} ` +
      `refused ${String(summary.refused)} unplaced ${String(summary.unplaced)} wrong ${String(summary.wrongTaps)}\n`,
  );
}

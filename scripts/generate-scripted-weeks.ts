/**
 * Regenerates `src/core/fixtures/scripted-weeks.ts`.
 *
 * A week is six days and a star ledger. These fixtures pin both: the action log
 * for each day, and what the week layer made of the summaries — totals, stars
 * spent, and where the run ended. Run this only when the rules deliberately
 * change, and review the diff.
 *
 *   npm run gen:fixtures
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeLog } from '../src/core/actionLog.js';
import { activeCustomer, currentParcel, initialState, reduce } from '../src/core/game.js';
import type { Action, State } from '../src/core/game.js';
import type { DayProfile } from '../src/core/profiles.js';
import { fits, sizeRank } from '../src/core/wall.js';
import { daySeed, recordDay, startWeek, weekProfile } from '../src/core/week.js';
import type { WeekState } from '../src/core/week.js';

const TICK_MS = 250;
const GUARD = 8_000;

interface Take {
  readonly state: State;
  readonly actions: readonly Action[];
}

const apply = (take: Take, action: Action): Take => ({
  state: reduce(take.state, action),
  actions: [...take.actions, action],
});

const tick = (take: Take): Take => apply(take, { type: 'tick', dtMs: TICK_MS });

function targetSlot(state: State): string | null {
  const active = activeCustomer(state);
  if (active === null) {
    return null;
  }
  if (active.kind === 'sender') {
    return (
      state.slots.find(
        (slot) => slot.state === 'empty' && !slot.jammed && fits(active.needsSize, slot.size),
      )?.id ?? null
    );
  }
  return state.slots.find((slot) => slot.parcelId === active.parcelId)?.id ?? null;
}

/**
 * The smallest free door that takes this parcel. Taking the *first* one instead
 * would spend C doors on A parcels and strand the big ones later.
 */
function smallestFreeSlot(state: State, size: 'A' | 'B' | 'C'): string | null {
  return (
    [...state.slots]
      .filter((slot) => slot.state === 'empty' && !slot.jammed && fits(size, slot.size))
      .sort((a, b) => sizeRank(a.size) - sizeRank(b.size))[0]?.id ?? null
  );
}

/** Loads up to `limit` parcels. */
function load(take: Take, limit: number): Take {
  let current = take;
  let placed = 0;
  while (current.state.phase === 'LOAD' && placed < limit) {
    const parcel = currentParcel(current.state);
    if (parcel === null) {
      break;
    }
    const slotId = smallestFreeSlot(current.state, parcel.size);
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
    current =
      marked === undefined ? tick(current) : apply(current, { type: 'tapSlot', slotId: marked.id });
  }
  return current;
}

/** Everything placed, everybody served the moment they reach the counter. */
function playDay(seed: number, profile: DayProfile, loadLimit = Infinity): Take {
  let current = load(
    apply({ state: initialState(seed, profile), actions: [] }, { type: 'start' }),
    loadLimit,
  );
  for (let guard = 0; guard < GUARD && current.state.phase === 'LOAD'; guard += 1) {
    current = tick(current);
  }
  for (let guard = 0; guard < GUARD && current.state.phase === 'SERVE'; guard += 1) {
    const slotId = targetSlot(current.state);
    current = slotId === null ? tick(current) : apply(current, { type: 'tapSlot', slotId });
  }
  return sweep(current);
}

interface WeekTake {
  readonly name: string;
  readonly seed: number;
  readonly week: WeekState;
  readonly logs: readonly string[][];
}

/**
 * Plays a whole week. `sloppyFrom` is the day index from which the courier
 * starts leaving parcels on the van — which is how the failing fixture spends
 * its stars.
 */
function playWeek(name: string, seed: number, sloppyFrom: number, leaveBehind = 1): WeekTake {
  let week = startWeek(seed);
  const logs: string[][] = [];

  for (let guard = 0; guard < 6 && week.status === 'playing'; guard += 1) {
    const profile = weekProfile(week.dayIndex);
    const loadLimit =
      week.dayIndex >= sloppyFrom ? Math.max(profile.pickups - leaveBehind, 0) : Infinity;
    const take = playDay(daySeed(seed, week.dayIndex), profile, loadLimit);
    const summary = take.state.summary;
    if (summary === null) {
      throw new Error(`day ${String(week.dayIndex)} of ${name} never reached SUMMARY`);
    }
    logs.push(encodeLog(take.actions));
    week = recordDay(week, summary, []);
  }

  return { name, seed, week, logs };
}

const weeks: WeekTake[] = [
  playWeek('a clean week', 4242, Infinity),
  // One parcel left on the van from Wednesday on: a star a day, out on Friday.
  playWeek('a week that runs out of stars on Friday', 777, 2),
];

const body = weeks
  .map(({ name, seed, week, logs }) => {
    const days = week.days
      .map(
        (day) => `      {
        dayIndex: ${String(day.dayIndex)},
        score: ${String(day.score)},
        timeMs: ${String(day.timeMs)},
        stars: ${String(day.stars)},
        starsLost: ${String(day.starsLost)},
        incidents: { unplaced: ${String(day.incidents.unplaced)}, refused: ${String(day.incidents.refused)}, walked: ${String(day.incidents.walked)} },
      },`,
      )
      .join('\n');
    const logLines = logs
      .map((log) => `      [${log.map((token) => `'${token}'`).join(', ')}],`)
      .join('\n');
    return `  {
    name: '${name}',
    seed: ${String(seed)},
    logs: [
${logLines}
    ],
    expected: {
      status: '${week.status}',
      stars: ${String(week.stars)},
      total: ${String(week.days.reduce((sum, day) => sum + day.score, 0))},
      days: [
${days}
      ],
    },
  },`;
  })
  .join('\n');

const file = `/**
 * Scripted weeks: the regression net for the run around the days.
 *
 * GENERATED by \`npm run gen:fixtures\`. Do not edit by hand — regenerate, and
 * treat any change to an expected week as a deliberate rule change to review.
 */
import type { WeekStatus } from '../week.js';

export interface ScriptedWeekDay {
  readonly dayIndex: number;
  readonly score: number;
  readonly timeMs: number;
  readonly stars: number;
  readonly starsLost: number;
  readonly incidents: { readonly unplaced: number; readonly refused: number; readonly walked: number };
}

export interface ScriptedWeek {
  readonly name: string;
  readonly seed: number;
  /** One run-length encoded action log per day played. */
  readonly logs: readonly (readonly string[])[];
  readonly expected: {
    readonly status: WeekStatus;
    readonly stars: number;
    readonly total: number;
    readonly days: readonly ScriptedWeekDay[];
  };
}

export const SCRIPTED_WEEKS: readonly ScriptedWeek[] = [
${body}
];
`;

const target = fileURLToPath(new URL('../src/core/fixtures/scripted-weeks.ts', import.meta.url));
writeFileSync(target, file, 'utf8');
process.stdout.write(`wrote ${target}\n`);
for (const { name, week } of weeks) {
  process.stdout.write(
    `  ${name}: ${week.status}, ${String(week.days.length)} days, ${String(week.stars)} stars, ` +
      `total ${String(week.days.reduce((sum, day) => sum + day.score, 0))}\n`,
  );
}

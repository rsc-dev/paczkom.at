import { townFor } from './geo.js';
import { gradeTown } from './grade.js';
import type { TownHour } from './grade.js';
import { appendHistory, levelYesterday, worstToday } from './history.js';
import type { History } from './history.js';
import type { Level } from './levels.js';
import type { NationalSummary, TownCard, TownIndexEntry } from './publish.js';
import type { CitizenReading, GiosIndex, GiosStation } from './readings.js';
import { buildNational, percentileBetter } from './summary.js';
import type { Town } from './towns.js';

/** Below this many graded towns a run is broken, not a quiet hour. */
export const MIN_TOWNS_WITH_DATA = 50;

export interface CollectInput {
  readonly towns: readonly Town[];
  readonly stations: readonly GiosStation[];
  readonly indexes: readonly GiosIndex[];
  readonly citizen: readonly CitizenReading[];
  readonly history: History;
  readonly nowMs: number;
}

export interface CollectOutput {
  readonly cards: TownCard[];
  readonly national: NationalSummary;
  readonly index: TownIndexEntry[];
  readonly history: History;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k !== null) {
      groups.set(k, [...(groups.get(k) ?? []), item]);
    }
  }
  return groups;
}

export function buildOutputs(input: CollectInput): CollectOutput {
  const { towns, nowMs } = input;
  const updatedAt = new Date(nowMs).toISOString();

  const stationTown = new Map(
    input.stations.map((s) => [s.stationId, townFor(s.lat, s.lon, towns)?.slug ?? null] as const),
  );
  const indexesByTown = groupBy(input.indexes, (i) => stationTown.get(i.stationId) ?? null);
  const citizenByTown = groupBy(input.citizen, (r) => townFor(r.lat, r.lon, towns)?.slug ?? null);

  const hours = new Map<string, TownHour>(
    towns.map((t) => [t.slug, gradeTown(indexesByTown.get(t.slug) ?? [], citizenByTown.get(t.slug) ?? [], nowMs)]),
  );

  const history = appendHistory(input.history, {
    at: nowMs,
    levels: Object.fromEntries(towns.map((t) => [t.slug, hours.get(t.slug)?.level ?? null])),
  });

  const graded: Level[] = [...hours.values()].flatMap((h) => (h.level === null ? [] : [h.level]));

  const cards: TownCard[] = towns.map((town) => {
    const hour = hours.get(town.slug) ?? gradeTown([], [], nowMs);
    return {
      slug: town.slug,
      name: town.name,
      ...hour,
      worstToday: worstToday(history, town.slug, nowMs),
      levelYesterday: levelYesterday(history, town.slug, nowMs),
      percentileBetter: hour.level === null ? null : percentileBetter(hour.level, graded),
      updatedAt,
    };
  });

  return {
    cards,
    national: buildNational(cards, updatedAt),
    index: towns.map(({ slug, name, lat, lon, population }) => ({ slug, name, lat, lon, population })),
    history,
  };
}

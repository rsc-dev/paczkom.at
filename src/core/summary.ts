import { LEVELS } from './levels.js';
import type { Level } from './levels.js';
import type { LevelCounts, NationalSummary, RankedTown, TownCard } from './publish.js';

const RANK_SIZE = 5;

/** Share of towns, in whole percent, whose level is strictly worse. */
export function percentileBetter(level: Level, all: readonly Level[]): number {
  if (all.length === 0) {
    return 0;
  }
  return Math.round((100 * all.filter((other) => other > level).length) / all.length);
}

/** Unknown PM2.5 sorts last in both directions. */
function byPm(direction: 1 | -1) {
  return (a: RankedTown, b: RankedTown): number => {
    if (a.pm25 === null || b.pm25 === null) {
      return a.pm25 === b.pm25 ? 0 : a.pm25 === null ? 1 : -1;
    }
    return direction * (a.pm25 - b.pm25);
  };
}

export function buildNational(cards: readonly TownCard[], updatedAt: string): NationalSummary {
  const ranked: RankedTown[] = cards.flatMap((c) =>
    c.level === null ? [] : [{ slug: c.slug, name: c.name, level: c.level, pm25: c.pm25 }],
  );
  const byName = (a: RankedTown, b: RankedTown): number => a.name.localeCompare(b.name, 'pl');

  const best = [...ranked]
    .sort((a, b) => a.level - b.level || byPm(1)(a, b) || byName(a, b))
    .slice(0, RANK_SIZE);
  const worst = [...ranked]
    .sort((a, b) => b.level - a.level || byPm(-1)(a, b) || byName(a, b))
    .slice(0, RANK_SIZE);

  const levels = ranked.map((t) => t.level).sort((a, b) => a - b);
  const counts = Object.fromEntries(
    LEVELS.map((level) => [String(level), levels.filter((l) => l === level).length]),
  ) as LevelCounts;

  return {
    updatedAt,
    medianLevel: levels.length === 0 ? null : (levels[Math.floor((levels.length - 1) / 2)] ?? null),
    countByLevel: counts,
    best,
    worst,
    withData: ranked.length,
    total: cards.length,
  };
}

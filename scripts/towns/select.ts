import { slugify } from '../../src/core/towns.js';
import type { Town } from '../../src/core/towns.js';

/** One row of a GeoNames country dump, only the columns we use. */
export interface GeoNamesPlace {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly featureClass: string;
  readonly featureCode: string;
  readonly population: number;
}

/** Seats of a gmina and up. Plain PPL also covers city districts (Wola, Mokotów). */
const SEAT_CODES = new Set(['PPLC', 'PPLA', 'PPLA2', 'PPLA3']);
const MIN_POPULATION = 5_000;

export function selectTowns(
  places: readonly GeoNamesPlace[],
  polishNames: ReadonlyMap<string, string>,
  includeIds: ReadonlySet<string>,
): Town[] {
  const chosen = places
    .filter(
      (p) =>
        includeIds.has(p.id) ||
        (p.featureClass === 'P' && SEAT_CODES.has(p.featureCode) && p.population >= MIN_POPULATION),
    )
    .map((p) => ({ name: polishNames.get(p.id) ?? p.name, lat: p.lat, lon: p.lon, population: p.population }))
    .sort((a, b) => b.population - a.population);

  const used = new Map<string, number>();
  const towns = chosen.map((town): Town => {
    const base = slugify(town.name);
    const seen = (used.get(base) ?? 0) + 1;
    used.set(base, seen);
    return { slug: seen === 1 ? base : `${base}-${String(seen)}`, ...town };
  });
  return towns.sort((a, b) => a.slug.localeCompare(b.slug));
}

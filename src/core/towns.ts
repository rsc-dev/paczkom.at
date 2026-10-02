/** A Polish town the card can grade. Generated into `src/data/towns.json`. */
export interface Town {
  readonly slug: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
}

/** Lower case without diacritics. `ł` needs its own rule: NFD leaves it whole. */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function slugify(name: string): string {
  return foldText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Prefix matches first, then substring matches; each group largest town first. */
export function searchTowns<T extends { readonly name: string; readonly population: number }>(
  towns: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const needle = foldText(query.trim());
  if (needle === '') {
    return [];
  }
  const byPopulation = (a: T, b: T): number => b.population - a.population;
  const prefix: T[] = [];
  const contains: T[] = [];
  for (const town of towns) {
    const folded = foldText(town.name);
    if (folded.startsWith(needle)) {
      prefix.push(town);
    } else if (folded.includes(needle)) {
      contains.push(town);
    }
  }
  return [...prefix.sort(byPopulation), ...contains.sort(byPopulation)].slice(0, limit);
}

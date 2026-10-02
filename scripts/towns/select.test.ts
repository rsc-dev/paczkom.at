import { describe, expect, it } from 'vitest';
import { selectTowns } from './select.js';
import type { GeoNamesPlace } from './select.js';

const place = (over: Partial<GeoNamesPlace>): GeoNamesPlace => ({
  id: '1', name: 'X', lat: 50, lon: 20, featureClass: 'P', featureCode: 'PPLA3', population: 10_000, ...over,
});

describe('selectTowns', () => {
  it('keeps administrative seats of 5 000+ and drops districts, hamlets and small places', () => {
    const towns = selectTowns(
      [
        place({ id: '1', name: 'Warsaw', featureCode: 'PPLC', population: 1_700_000 }),
        place({ id: '2', name: 'Wola', featureCode: 'PPL', population: 140_000 }),
        place({ id: '3', name: 'Mokotów', featureCode: 'PPLX', population: 217_000 }),
        place({ id: '4', name: 'Tiny', featureCode: 'PPLA3', population: 4_999 }),
        place({ id: '5', name: 'Luboń', featureCode: 'PPLA3', population: 26_000 }),
        place({ id: '6', name: 'Lake', featureClass: 'H', featureCode: 'PPLA3' }),
      ],
      new Map([['1', 'Warszawa']]),
      new Set(),
    );
    expect(towns.map((t) => t.name)).toEqual(['Luboń', 'Warszawa']);
    expect(towns[1]).toEqual({ slug: 'warszawa', name: 'Warszawa', lat: 50, lon: 20, population: 1_700_000 });
  });

  it('adds places from the include list whatever their feature code', () => {
    const towns = selectTowns([place({ id: '9', name: 'Zielonka', featureCode: 'PPL', population: 17_000 })], new Map(), new Set(['9']));
    expect(towns.map((t) => t.slug)).toEqual(['zielonka']);
  });

  it('suffixes a duplicate slug with the larger town keeping the plain one', () => {
    const towns = selectTowns(
      [
        place({ id: '1', name: 'Nowy Dwór', population: 9_000, lat: 51 }),
        place({ id: '2', name: 'Nowy Dwór', population: 20_000, lat: 52 }),
      ],
      new Map(),
      new Set(),
    );
    expect(towns.map((t) => t.slug)).toEqual(['nowy-dwor', 'nowy-dwor-2']);
    expect(towns.find((t) => t.slug === 'nowy-dwor')?.population).toBe(20_000);
  });
});

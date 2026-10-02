import { describe, expect, it } from 'vitest';
import { foldText, searchTowns, slugify } from './towns.js';

const towns = [
  { name: 'Łódź', population: 670_000 },
  { name: 'Łódź-Widzew', population: 5_000 },
  { name: 'Kraków', population: 800_000 },
  { name: 'Krasnystaw', population: 18_000 },
  { name: 'Bielsko-Biała', population: 170_000 },
  { name: 'Nowy Kraków', population: 6_000 },
];

describe('foldText', () => {
  it('drops case and Polish diacritics, including ł', () => {
    expect(foldText('ŁÓDŹ')).toBe('lodz');
    expect(foldText('Żółć')).toBe('zolc');
    expect(foldText('Bielsko-Biała')).toBe('bielsko-biala');
  });
});

describe('slugify', () => {
  it('makes a URL-safe ASCII slug', () => {
    expect(slugify('Kraków')).toBe('krakow');
    expect(slugify('Bielsko-Biała')).toBe('bielsko-biala');
    expect(slugify('Aleksandrów Łódzki')).toBe('aleksandrow-lodzki');
    expect(slugify('  Św. Katarzyna ')).toBe('sw-katarzyna');
  });
});

describe('searchTowns', () => {
  it('matches with or without diacritics', () => {
    expect(searchTowns(towns, 'lodz').map((t) => t.name)).toEqual(['Łódź', 'Łódź-Widzew']);
    expect(searchTowns(towns, 'ŁÓDŹ')[0]?.name).toBe('Łódź');
  });

  it('puts prefix matches first, larger towns first, then other matches', () => {
    expect(searchTowns(towns, 'kra').map((t) => t.name)).toEqual(['Kraków', 'Krasnystaw', 'Nowy Kraków']);
  });

  it('returns nothing for a blank query and respects the limit', () => {
    expect(searchTowns(towns, '   ')).toEqual([]);
    expect(searchTowns(towns, 'a', 2)).toHaveLength(2);
  });
});

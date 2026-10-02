import { describe, expect, it } from 'vitest';
import { isNationalSummary, isTownCard, isTownIndex } from './publish.js';
import { CARD } from './testing.js';

describe('isTownCard', () => {
  it('accepts a full card and a no-data card', () => {
    expect(isTownCard(CARD)).toBe(true);
    expect(
      isTownCard({ ...CARD, level: null, pm25: null, pm10: null, source: 'none', worstToday: null, levelYesterday: null, percentileBetter: null }),
    ).toBe(true);
  });

  it.each<[string, unknown]>([
    ['level 7', { ...CARD, level: 7 }],
    ['unknown source', { ...CARD, source: 'airly' }],
    ['bad slug', { ...CARD, slug: 'Kraków' }],
    ['string PM', { ...CARD, pm25: '48' }],
    ['bad date', { ...CARD, updatedAt: 'soon' }],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isTownCard(value)).toBe(false);
  });
});

describe('isNationalSummary / isTownIndex', () => {
  it('accept the shapes the collector writes', () => {
    expect(
      isNationalSummary({
        updatedAt: CARD.updatedAt, medianLevel: 2, countByLevel: { 1: 1, 2: 3, 3: 0, 4: 0, 5: 0, 6: 0 },
        best: [{ slug: 'a', name: 'A', level: 1, pm25: 5 }], worst: [], withData: 4, total: 480,
      }),
    ).toBe(true);
    expect(isTownIndex([{ slug: 'a', name: 'A', lat: 50, lon: 20, population: 6000 }])).toBe(true);
    expect(isTownIndex([{ slug: 'a' }])).toBe(false);
  });
});

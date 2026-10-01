import { describe, expect, it } from 'vitest';
import type { TownCard } from './publish.js';
import { buildNational, percentileBetter } from './summary.js';

const card = (slug: string, level: TownCard['level'], pm25: number | null = null): TownCard => ({
  slug, name: slug.toUpperCase(), level, pm25, pm10: null, source: level === null ? 'none' : 'citizen',
  sensorCount: 3, lowConfidence: false, worstToday: null, levelYesterday: null, percentileBetter: null,
  updatedAt: '2026-10-01T15:25:00.000Z',
});

describe('percentileBetter', () => {
  it('is the share of towns with a strictly worse level', () => {
    expect(percentileBetter(2, [1, 2, 3, 4])).toBe(50);
    expect(percentileBetter(6, [6, 6])).toBe(0);
    expect(percentileBetter(1, [1])).toBe(0);
  });
});

describe('buildNational', () => {
  const cards = [
    card('a', 1, 5), card('b', 1, 3), card('c', 2, 20), card('d', 5, 90), card('e', 5, 80),
    card('f', 3, null), card('g', null),
  ];
  const national = buildNational(cards, '2026-10-01T15:25:00.000Z');

  it('counts towns per level and the lower median', () => {
    expect(national.countByLevel).toEqual({ 1: 2, 2: 1, 3: 1, 4: 0, 5: 2, 6: 0 });
    expect(national.medianLevel).toBe(2);
    expect(national.withData).toBe(6);
    expect(national.total).toBe(7);
  });

  it('orders best by level, then PM2.5 (unknown last), then name', () => {
    expect(national.best.map((t) => t.slug)).toEqual(['b', 'a', 'c', 'f', 'e']);
  });

  it('orders worst by level, then PM2.5 descending (unknown last)', () => {
    expect(national.worst.map((t) => t.slug)).toEqual(['d', 'e', 'f', 'c', 'a']);
  });

  it('has no median without data', () => {
    expect(buildNational([card('g', null)], 'x').medianLevel).toBeNull();
  });
});

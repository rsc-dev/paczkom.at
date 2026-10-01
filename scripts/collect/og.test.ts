import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD } from '../../src/core/testing.js';
import { OG_LEVEL_FILL, OG_LEVEL_INK, formatWhen, renderTownOg, titleFontSize } from './og.js';

describe('renderTownOg', () => {
  it('draws a 1200×630 PNG', () => {
    const png = renderTownOg(CARD, '1 paź, 17:00');
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it('draws a no-data card too', () => {
    const png = renderTownOg({ ...CARD, level: null, pm25: null }, '1 paź, 17:00');
    expect(png.readUInt32BE(16)).toBe(1200);
  });
});

describe('level colours', () => {
  it('match the theme tokens the page uses', () => {
    const css = readFileSync('src/theme/tokens.css', 'utf8');
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      expect(css).toContain(`--level-${String(level)}: ${OG_LEVEL_FILL[level]};`);
      expect(css).toContain(`--level-ink-${String(level)}: ${OG_LEVEL_INK[level]};`);
    }
  });
});

describe('formatWhen', () => {
  it('formats Warsaw time in each language', () => {
    const ms = Date.parse('2026-10-01T15:25:00Z');
    expect(formatWhen(ms, 'pl')).toBe('1 paź, 17:25');
    expect(formatWhen(ms, 'en')).toBe('1 Oct, 17:25');
  });
});

describe('titleFontSize', () => {
  it('keeps the default size for a short name', () => {
    expect(titleFontSize('Kraków')).toBe(88);
  });

  it('shrinks below the default for a long (40-character) name', () => {
    expect(titleFontSize('A'.repeat(40))).toBeLessThan(88);
  });
});

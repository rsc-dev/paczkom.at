import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/theme/tokens.css', 'utf8');
const token = (name: string): string => {
  const value = new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(css)?.[1];
  if (value === undefined) {
    throw new Error(`missing --${name}`);
  }
  return value;
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

describe('level colours', () => {
  it.each([1, 2, 3, 4, 5, 6])('level %d text meets WCAG AA (4.5:1)', (level) => {
    expect(contrast(token(`level-${String(level)}`), token(`level-ink-${String(level)}`))).toBeGreaterThanOrEqual(4.5);
  });

  it('gives every level a distinct colour', () => {
    const fills = [1, 2, 3, 4, 5, 6].map((l) => token(`level-${String(l)}`));
    expect(new Set(fills).size).toBe(6);
  });
});

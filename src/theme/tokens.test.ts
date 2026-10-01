import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Token discipline (design D10): a new theme must be a CSS file and nothing
 * else, which only holds if no colour is ever named in TypeScript. This is the
 * test that keeps that true.
 */

const root = process.cwd();

const COLOUR_PATTERNS: [string, RegExp][] = [
  ['hex', /#[0-9a-fA-F]{3,8}\b/],
  ['rgb()', /\brgba?\s*\(/],
  ['hsl()', /\bhsla?\s*\(/],
  ['modern colour functions', /\b(oklch|oklab|lab|lch|color-mix)\s*\(/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('no colour literals outside the theme', () => {
  const files = [...sourceFiles(join(root, 'src', 'core')), ...sourceFiles(join(root, 'src', 'ui'))];

  it('has files to scan', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(COLOUR_PATTERNS)('names no %s colour in src/core or src/ui', (_label, pattern) => {
    const offenders = files
      .map((file) => ({ file, text: readFileSync(file, 'utf8') }))
      .filter(({ text }) => pattern.test(text))
      .map(({ file }) => file.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});

describe('theme files', () => {
  const themeDir = join(root, 'src', 'theme');
  const css = (name: string): string => readFileSync(join(themeDir, name), 'utf8');

  it('declares every token on :root', () => {
    const tokens = css('tokens.css');
    for (const token of [
      '--bg',
      '--ink',
      '--accent',
      '--wall-bg',
      '--door-face',
      '--door-cavity',
      '--panel-bg',
      '--parcel-red',
      '--parcel-violet',
      '--radius-md',
      '--font-sans',
      '--shadow-door',
      '--motion',
      '--unit',
      '--gap',
      '--hit-min',
    ]) {
      expect(tokens, token).toContain(`${token}:`);
    }
  });

  it('collapses motion to nothing under prefers-reduced-motion', () => {
    const tokens = css('tokens.css');
    expect(tokens).toContain('prefers-reduced-motion: reduce');
    const reduced = tokens.slice(tokens.indexOf('prefers-reduced-motion'));
    expect(reduced).toContain('--motion: 0ms');
    expect(reduced).toContain('--motion-fast: 0ms');
  });

  it('bundles the Latin Extended subset so Polish renders in the same face', () => {
    const fonts = css('fonts.css');
    expect(fonts).toContain('inter-latin-ext-400-normal.woff2');
    expect(fonts).toContain('inter-latin-ext-700-normal.woff2');
    // U+0100–017F carries ą ć ę ł ń ś ź ż.
    expect(fonts).toContain('U+0100-02BA');
    expect((fonts.match(/@font-face/g) ?? []).length).toBe(4);
  });
});

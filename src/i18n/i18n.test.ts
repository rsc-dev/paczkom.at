import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LEVELS } from '../core/levels.js';
import { en } from './en.js';
import {
  LANGS,
  detectLang,
  getLang,
  isLang,
  levelName,
  setLang,
  t,
  translate,
} from './index.js';
import { pl } from './pl.js';

afterEach(() => {
  setLang('pl');
});

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();

describe('catalogues', () => {
  it('have identical key sets', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of [...Object.entries(pl), ...Object.entries(en)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(pl) as (keyof typeof pl)[]) {
      expect(placeholders(pl[key]), key).toEqual(placeholders(en[key]));
    }
  });

  /**
   * Dead strings accumulate silently and then get translated, reviewed and
   * shipped for years. A key counts as used when it appears literally, or when
   * some template builds it — `t(`colour.${colour}`)` covers `colour.red`.
   */
  it('has no key that nothing uses', () => {
    const root = process.cwd();
    const catalogues = new Set([join(root, 'src', 'i18n', 'pl.ts'), join(root, 'src', 'i18n', 'en.ts')]);

    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          return sources(path);
        }
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !catalogues.has(path)
          ? [path]
          : [];
      });

    const text = [...sources(join(root, 'src')), join(root, 'index.html')]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    // Prefixes built by template literals, e.g. `size.${size}`.
    const prefixes = [...text.matchAll(/`([a-zA-Z.]+)\.\$\{/g)].map((match) => `${match[1] ?? ''}.`);

    const unused = Object.keys(pl).filter(
      (key) => !text.includes(key) && !prefixes.some((prefix) => key.startsWith(prefix)),
    );
    expect(unused).toEqual([]);
  });
});

describe('brand wording', () => {
  // "Paczkomat" is a registered mark; this site uses no data of theirs.
  const forbidden: RegExp[] = [
    /paczkomat/i,
    /inpost/i,
    /allegro/i,
    /poczta polska/i,
    /orlen/i,
    /żabka/i,
    /fedex/i,
    /\bdhl\b/i,
    /\bdpd\b/i,
    /\bups\b/i,
    /\bgls\b/i,
  ];

  it.each(forbidden.map((pattern) => [pattern.source, pattern] as const))(
    'never mentions %s',
    (_label, pattern) => {
      const offenders = [...Object.entries(pl), ...Object.entries(en)].filter(([, value]) =>
        pattern.test(value),
      );
      expect(offenders).toEqual([]);
    },
  );
});

describe('t', () => {
  it('translates in the current language', () => {
    setLang('pl');
    expect(t('card.share')).toBe('Udostępnij');
    setLang('en');
    expect(t('card.share')).toBe('Share');
  });

  it('interpolates parameters', () => {
    setLang('pl');
    expect(t('card.pm25', { value: '48' })).toContain('48');
    expect(t('ranking.count', { level: 'Dobry', count: 4 })).toBe('Dobry: 4');
  });

  it('leaves an unknown placeholder alone rather than printing undefined', () => {
    setLang('pl');
    expect(t('ranking.count', { level: 'Dobry' })).toBe('Dobry: {count}');
  });

  it('falls back to the key for an unknown message', () => {
    expect(translate('pl', 'nope.not.here' as keyof typeof pl)).toBe('nope.not.here');
  });
});

describe('language selection', () => {
  it('prefers a stored preference', () => {
    expect(detectLang({ stored: 'en', navigatorLanguage: 'pl-PL' })).toBe('en');
    expect(detectLang({ stored: 'pl', navigatorLanguage: 'en-GB' })).toBe('pl');
  });

  it('falls back to the browser language', () => {
    expect(detectLang({ navigatorLanguage: 'pl-PL' })).toBe('pl');
    expect(detectLang({ navigatorLanguage: 'PL' })).toBe('pl');
    expect(detectLang({ navigatorLanguage: 'en-GB' })).toBe('en');
    expect(detectLang({ navigatorLanguage: 'de-DE' })).toBe('en');
  });

  it('falls back to English with nothing to go on', () => {
    expect(detectLang({})).toBe('en');
    expect(detectLang({ stored: 'de', navigatorLanguage: null })).toBe('en');
  });

  it('validates language codes', () => {
    expect(isLang('pl')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(isLang(7)).toBe(false);
    expect(LANGS).toEqual(['pl', 'en']);
  });

  it('switches without touching anything else', () => {
    setLang('en');
    expect(getLang()).toBe('en');
    setLang('pl');
    expect(getLang()).toBe('pl');
  });
});

describe('levelName', () => {
  it('names every level in both languages', () => {
    expect(LEVELS.map((level) => levelName(level, 'pl'))).toEqual([
      'Bardzo dobry', 'Dobry', 'Umiarkowany', 'Dostateczny', 'Zły', 'Bardzo zły',
    ]);
    expect(levelName(4, 'en')).toBe('Sufficient');
  });
});

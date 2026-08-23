import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOURS, STICKERS } from '../core/parcel.js';
import { en } from './en.js';
import {
  LANGS,
  colourName,
  detectLang,
  getLang,
  hintLine,
  isLang,
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

  it('cover every colour, sticker and size token', () => {
    for (const colour of COLOURS) {
      expect(Object.keys(pl)).toContain(`colour.${colour}`);
    }
    for (const sticker of STICKERS) {
      expect(Object.keys(pl)).toContain(`sticker.${sticker}`);
    }
    for (const size of ['A', 'B', 'C']) {
      expect(Object.keys(pl)).toContain(`size.${size}`);
    }
  });
});

describe('brand wording', () => {
  // "Paczkomat" is a registered mark; the game calls the machine an
  // "automat paczkowy" / "parcel locker".
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

  it('names the machine the way the trademark note requires', () => {
    expect(pl['app.tagline']).toContain('automatu paczkowego');
    expect(en['app.tagline']).toContain('parcel locker');
  });
});

describe('t', () => {
  it('translates in the current language', () => {
    setLang('pl');
    expect(t('title.play')).toBe('Dzisiaj');
    setLang('en');
    expect(t('title.play')).toBe('Today');
  });

  it('interpolates parameters', () => {
    setLang('pl');
    expect(t('hint.colour', { colour: 'czerwony' })).toContain('czerwony');
    expect(t('title.streak', { count: 4 })).toBe('Seria: 4');
  });

  it('leaves an unknown placeholder alone rather than printing undefined', () => {
    setLang('pl');
    expect(t('title.streak')).toBe('Seria: {count}');
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

describe('hint lines', () => {
  it('names the colour alone when there is no sticker', () => {
    expect(hintLine('red', 'none', 'pl')).toBe('ten czerwony');
    expect(hintLine('red', 'none', 'en')).toBe('the red one');
  });

  it('names the colour and the sticker together', () => {
    expect(hintLine('blue', 'fragile', 'pl')).toBe('ten niebieski z napisem „Ostrożnie”');
    expect(hintLine('blue', 'fragile', 'en')).toBe('the blue one with the fragile sticker');
  });

  it('reads naturally for every sticker, in both languages', () => {
    expect(hintLine('red', 'arrow', 'pl')).toBe('ten czerwony ze strzałką');
    expect(hintLine('red', 'bang', 'pl')).toBe('ten czerwony z wykrzyknikiem');
    expect(hintLine('red', 'arrow', 'en')).toBe('the red one with the arrow sticker');
    expect(hintLine('red', 'bang', 'en')).toBe('the red one with the exclamation mark');
    for (const sticker of STICKERS) {
      for (const lang of LANGS) {
        const line = hintLine('green', sticker, lang);
        expect(line).not.toContain('{');
        expect(line).not.toContain('hint.');
      }
    }
  });

  it('has a name for every colour in both languages', () => {
    for (const colour of COLOURS) {
      for (const lang of LANGS) {
        expect(colourName(colour, lang)).not.toBe(`colour.${colour}`);
      }
    }
  });

  it('uses the current language by default', () => {
    setLang('en');
    expect(hintLine('green', 'none')).toBe('the green one');
  });
});

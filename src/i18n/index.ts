/**
 * Translation helper (design D9).
 *
 * The catalogues are flat `Record<Key, string>` maps and `t` interpolates
 * `{param}` placeholders. Language is chosen once at boot and can be switched
 * live. State is language-independent, so switching only re-renders.
 */
import type { Level } from '../core/levels.js';
import { en } from './en.js';
import { pl } from './pl.js';
import type { MessageKey } from './pl.js';

export type { MessageKey } from './pl.js';

export const LANGS = ['pl', 'en'] as const;

export type Lang = (typeof LANGS)[number];

export type Params = Readonly<Record<string, string | number>>;

const CATALOGUES: Readonly<Record<Lang, Readonly<Record<MessageKey, string>>>> = { pl, en };

let currentLang: Lang = 'pl';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** For `data-t` attributes in the HTML, which are strings until checked. */
export function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(pl, value);
}

/** The language a PL/EN toggle switches to. */
export function otherLang(lang: Lang = currentLang): Lang {
  return lang === 'pl' ? 'en' : 'pl';
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
}

/** Stored preference wins; otherwise a Polish browser gets Polish. */
export function detectLang(options: {
  readonly stored?: unknown;
  readonly navigatorLanguage?: string | null | undefined;
}): Lang {
  if (isLang(options.stored)) {
    return options.stored;
  }
  return options.navigatorLanguage?.toLowerCase().startsWith('pl') === true ? 'pl' : 'en';
}

function interpolate(template: string, params?: Params): string {
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/** Translate into an explicit language. */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const template = CATALOGUES[lang][key] as string | undefined;
  return interpolate(template ?? key, params);
}

/** Translate into the current language. */
export function t(key: MessageKey, params?: Params): string {
  return translate(currentLang, key, params);
}

export function levelName(level: Level, lang: Lang = currentLang): string {
  return translate(lang, `level.${String(level)}` as MessageKey);
}

/**
 * Translation helper (design D9).
 *
 * The catalogues are flat `Record<Key, string>` maps and `t` interpolates
 * `{param}` placeholders. Language is chosen once at boot and can be switched
 * live; game state is language-independent, so switching only re-renders.
 */
import type { Colour, Sticker } from '../core/parcel.js';
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

export function colourName(colour: Colour, lang: Lang = currentLang): string {
  return translate(lang, `colour.${colour}`);
}

export function stickerName(sticker: Sticker, lang: Lang = currentLang): string {
  return translate(lang, `sticker.${sticker}`);
}

/**
 * The hint line shown at hint level 1, built from the parcel's identity.
 *
 * The sticker half is a whole phrase per sticker rather than a name slotted
 * into one template: Polish needs a different preposition for each sticker.
 */
export function hintLine(colour: Colour, sticker: Sticker, lang: Lang = currentLang): string {
  const colourText = colourName(colour, lang);
  if (sticker === 'none') {
    return translate(lang, 'hint.colour', { colour: colourText });
  }
  return translate(lang, 'hint.colourSticker', {
    colour: colourText,
    sticker: translate(lang, `hint.sticker.${sticker}`),
  });
}

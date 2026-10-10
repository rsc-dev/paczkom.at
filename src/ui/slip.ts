/** The end-of-shift slip and the share text. Labels come from the catalogues. */
import type { Mode } from '../core/game.js';
import { translate } from '../i18n/index.js';
import type { Lang } from '../i18n/index.js';

export const SHARE_URL = 'https://paczkom.at';

/** The score is delivered points: "142 pkt", "1 pt". */
const unit = (n: number, lang: Lang): string => translate(lang, n === 1 ? 'unit.one' : 'unit.many');

export function slipText(score: number, record: number, lang: Lang): string {
  return translate(lang, 'slip.over', { points: score, unit: unit(score, lang), record });
}

export function shareText(mode: Mode, score: number, isNew: boolean, lang: Lang): string {
  return [
    `paczkom.at · ${translate(lang, 'share.game', { mode })}`,
    `📦 ${String(score)} ${unit(score, lang)}`,
    isNew ? translate(lang, 'slip.newRecord') : null,
    SHARE_URL,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

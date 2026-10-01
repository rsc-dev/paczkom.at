/**
 * The 1200×630 link-preview card for one town, drawn as SVG and rasterised by
 * resvg with the vendored Inter TTFs (the woff2 files in public/ are not
 * readable by resvg).
 */
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import type { Level } from '../../src/core/levels.js';
import type { TownCard } from '../../src/core/publish.js';
import { levelName } from '../../src/i18n/index.js';

/** Same values as --level-N / --level-ink-N in src/theme/tokens.css (tested). */
export const OG_LEVEL_FILL: Readonly<Record<Level, string>> = {
  1: '#57b108', 2: '#b0dd10', 3: '#ffd911', 4: '#e58100', 5: '#e50000', 6: '#990000',
};
export const OG_LEVEL_INK: Readonly<Record<Level, string>> = {
  1: '#111111', 2: '#111111', 3: '#111111', 4: '#111111', 5: '#ffffff', 6: '#ffffff',
};
const PAPER = '#f2efe8';
const INK = '#111111';
const NO_DATA = '#b9b2a4';

const FONTS = ['Inter-Bold.ttf', 'Inter-Regular.ttf'].map((f) =>
  fileURLToPath(new URL(`../assets/${f}`, import.meta.url)),
);

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const decimal = (value: number): string => String(value).replace('.', ',');

const CONTENT_WIDTH = 1040;
const TITLE_FONT_SIZE = 88;

/**
 * The actual rendered width of `text` set in Inter Bold at `fontSize`,
 * measured by rendering it in isolation and reading resvg's bounding box — a
 * character-count estimate is unreliable across scripts and letter-casing (an
 * all-caps run is far wider per character than a mixed-case one).
 */
function measuredWidth(text: string, fontSize: number): number {
  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="200">
  <text x="0" y="150" font-family="Inter" font-weight="700" font-size="${String(fontSize)}">${escape(text)}</text>
</svg>`;
  const resvg = new Resvg(probe, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter' } });
  return resvg.getBBox()?.width ?? 0;
}

/**
 * The town-name font size: 88 by default, shrunk so long names (e.g.
 * "Ostrowiec Świętokrzyski") still fit the 1040px content width (x 80..1120)
 * instead of running past the orange block below. TrueType advance widths
 * scale linearly with font size, so one measurement at the default size gives
 * the exact size that fits — no character-count heuristic involved.
 */
export function titleFontSize(name: string): number {
  const width = measuredWidth(name, TITLE_FONT_SIZE);
  return width <= CONTENT_WIDTH ? TITLE_FONT_SIZE : Math.max(1, Math.floor((TITLE_FONT_SIZE * CONTENT_WIDTH) / width));
}

export function formatWhen(ms: number, lang: 'pl' | 'en'): string {
  const locale = lang === 'pl' ? 'pl-PL' : 'en-GB';
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'short' }).format(ms);
  const time = new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
  return `${date.replace('.', '')}, ${time}`;
}

export function renderTownOg(card: TownCard, when: string): Buffer {
  const fill = card.level === null ? NO_DATA : OG_LEVEL_FILL[card.level];
  const ink = card.level === null ? INK : OG_LEVEL_INK[card.level];
  const label = card.level === null ? 'Brak danych' : `${levelName(card.level, 'pl')} (${String(card.level)}/6)`;
  const pm = card.pm25 === null ? '' : `PM2,5: ${decimal(card.pm25)} µg/m³`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <text x="80" y="140" font-family="Inter" font-weight="700" font-size="${String(titleFontSize(card.name))}" fill="${INK}">${escape(card.name)}</text>
  <rect x="80" y="200" width="1040" height="220" rx="24" fill="${fill}"/>
  <text x="120" y="335" font-family="Inter" font-weight="700" font-size="84" fill="${ink}">${escape(label)}</text>
  <text x="80" y="500" font-family="Inter" font-weight="400" font-size="44" fill="${INK}">${escape(pm)}</text>
  <text x="80" y="570" font-family="Inter" font-weight="400" font-size="36" fill="${INK}">${escape(`paczkom.at · ${when}`)}</text>
</svg>`;
  const resvg = new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter' } });
  return resvg.render().asPng();
}

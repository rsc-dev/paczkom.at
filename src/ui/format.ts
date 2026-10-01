/**
 * Locale-aware formatting for the browser UI. `formatWhen` also backs the
 * server-side OG renderer (scripts/collect/og.ts re-exports it) so the two
 * surfaces never drift apart.
 */
import type { Lang } from '../i18n/index.js';

const ZONE = 'Europe/Warsaw';
const locale = (lang: Lang): string => (lang === 'pl' ? 'pl-PL' : 'en-GB');

export function formatTime(ms: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
}

export function formatWhen(ms: number, lang: Lang): string {
  const date = new Intl.DateTimeFormat(locale(lang), { timeZone: ZONE, day: 'numeric', month: 'short' }).format(ms);
  return `${date.replace('.', '')}, ${formatTime(ms, lang)}`;
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 1 }).format(value);
}

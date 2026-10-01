/**
 * The share text for one town's hour. Labels arrive localised from the caller;
 * the emoji and the URL are the same in every language.
 */
import type { Level } from './levels.js';

export const SHARE_BRAND = 'paczkom.at';
export const SHARE_URL = 'https://paczkom.at';

/** Levels 1 and 2 share green; the label tells them apart. */
export const LEVEL_EMOJI: Readonly<Record<Level, string>> = {
  1: '🟢', 2: '🟢', 3: '🟡', 4: '🟠', 5: '🔴', 6: '🟣',
};

export function townUrl(slug: string): string {
  return `${SHARE_URL}/${slug}`;
}

export interface AirShareParams {
  readonly townName: string;
  readonly when: string;
  readonly level: Level;
  readonly levelLabel: string;
  readonly pm25Line: string | null;
  readonly trendLine: string | null;
  readonly percentileLine: string | null;
  readonly slug: string;
}

export function buildAirShareText(p: AirShareParams): string {
  const pmTrend = [p.pm25Line, p.trendLine].filter((part): part is string => part !== null).join(' · ');
  return [
    `${SHARE_BRAND} · ${p.townName} · ${p.when}`,
    `${LEVEL_EMOJI[p.level]} ${p.levelLabel} (${String(p.level)}/6)`,
    pmTrend === '' ? null : pmTrend,
    p.percentileLine,
    townUrl(p.slug),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

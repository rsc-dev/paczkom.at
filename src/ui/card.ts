import type { Level } from '../core/levels.js';
import type { TownCard } from '../core/publish.js';
import { buildAirShareText } from '../core/share.js';
import { levelName, translate } from '../i18n/index.js';
import type { Lang } from '../i18n/index.js';
import { need, setAttr, setHidden, setText } from './dom.js';
import { formatNumber, formatTime, formatWhen } from './format.js';

const STALE_AFTER_MS = 3 * 3_600_000;

export interface CardModel {
  readonly town: string;
  readonly level: Level | null;
  readonly levelLabel: string;
  readonly levelOf: string;
  readonly pm: string | null;
  readonly trend: string | null;
  readonly worst: string | null;
  readonly percentile: string | null;
  readonly source: string;
  readonly noData: boolean;
}

function trendLine(card: TownCard, lang: Lang): string | null {
  if (card.level === null || card.levelYesterday === null) {
    return null;
  }
  const key = card.level > card.levelYesterday ? 'card.trend.worse' : card.level < card.levelYesterday ? 'card.trend.better' : 'card.trend.same';
  return translate(lang, key);
}

function pmLine(card: TownCard, lang: Lang, withPm10: boolean): string | null {
  const parts: string[] = [];
  if (card.pm25 !== null) {
    parts.push(translate(lang, 'card.pm25', { value: formatNumber(card.pm25, lang) }));
  }
  if (withPm10 && card.pm10 !== null) {
    parts.push(translate(lang, 'card.pm10', { value: formatNumber(card.pm10, lang) }));
  }
  return parts.length === 0 ? null : parts.join(' · ');
}

function sourceLine(card: TownCard, lang: Lang): string {
  const parts: string[] = [];
  if (card.source === 'gios') {
    parts.push(translate(lang, 'card.source.gios'));
  } else if (card.source === 'citizen') {
    parts.push(
      card.sensorCount === 1
        ? translate(lang, 'card.source.citizenOne')
        : translate(lang, 'card.source.citizen', { count: card.sensorCount }),
    );
  }
  if (card.lowConfidence) {
    parts.push(translate(lang, 'card.lowConfidence'));
  }
  parts.push(translate(lang, 'card.updated', { time: formatTime(Date.parse(card.updatedAt), lang) }));
  return parts.join(' · ');
}

export function cardModel(card: TownCard, lang: Lang): CardModel {
  const noData = card.level === null;
  return {
    town: card.name,
    level: card.level,
    levelLabel: card.level === null ? translate(lang, 'card.noData') : levelName(card.level, lang),
    levelOf: card.level === null ? '' : translate(lang, 'level.of', { level: card.level }),
    pm: noData ? null : pmLine(card, lang, true),
    trend: trendLine(card, lang),
    worst:
      card.worstToday === null
        ? null
        : translate(lang, 'card.worstToday', { level: levelName(card.worstToday.level, lang), hour: card.worstToday.hour }),
    percentile: card.percentileBetter === null ? null : translate(lang, 'card.percentile', { percent: card.percentileBetter }),
    source: sourceLine(card, lang),
    noData,
  };
}

export interface CardNodes {
  readonly town: HTMLElement;
  readonly level: HTMLElement;
  readonly levelLabel: HTMLElement;
  readonly levelOf: HTMLElement;
  readonly pm: HTMLElement;
  readonly trend: HTMLElement;
  readonly worst: HTMLElement;
  readonly percentile: HTMLElement;
  readonly source: HTMLElement;
  readonly share: HTMLButtonElement;
  readonly makeMine: HTMLButtonElement;
  readonly note: HTMLElement;
  readonly fallback: HTMLTextAreaElement;
}

export function cardNodes(root: ParentNode): CardNodes {
  return {
    town: need(root, '#card-town'),
    level: need(root, '#card-level'),
    levelLabel: need(root, '#card-level-label'),
    levelOf: need(root, '#card-level-of'),
    pm: need(root, '#card-pm'),
    trend: need(root, '#card-trend'),
    worst: need(root, '#card-worst'),
    percentile: need(root, '#card-percentile'),
    source: need(root, '#card-source'),
    share: need(root, '#btn-share'),
    makeMine: need(root, '#btn-make-mine'),
    note: need(root, '#share-note'),
    fallback: need(root, '#share-fallback'),
  };
}

const line = (element: HTMLElement, text: string | null): void => {
  setText(element, text ?? '');
  setHidden(element, text === null);
};

export function renderCard(nodes: CardNodes, model: CardModel): void {
  setText(nodes.town, model.town);
  setAttr(nodes.level, 'data-level', model.level === null ? 'none' : String(model.level));
  setText(nodes.levelLabel, model.levelLabel);
  setText(nodes.levelOf, model.levelOf);
  line(nodes.pm, model.pm);
  line(nodes.trend, model.trend);
  line(nodes.worst, model.worst);
  line(nodes.percentile, model.percentile);
  setText(nodes.source, model.source);
  setHidden(nodes.share, model.noData);
}

export function shareTextFor(card: TownCard, lang: Lang): string | null {
  if (card.level === null) {
    return null;
  }
  return buildAirShareText({
    townName: card.name,
    when: formatWhen(Date.parse(card.updatedAt), lang),
    level: card.level,
    levelLabel: levelName(card.level, lang),
    pm25Line: pmLine(card, lang, false),
    trendLine: trendLine(card, lang),
    percentileLine: card.percentileBetter === null ? null : translate(lang, 'card.percentile', { percent: card.percentileBetter }),
    slug: card.slug,
  });
}

export function isStale(updatedAt: string, nowMs: number): boolean {
  return nowMs - Date.parse(updatedAt) > STALE_AFTER_MS;
}

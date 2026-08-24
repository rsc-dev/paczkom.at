/**
 * The screens either side of a day: title, how-to and the Daily result.
 * All four screens live in the same document; routing is one attribute.
 */
import type { DaySummary } from '../core/game.js';
import { formatTime } from '../core/share.js';
import { isMessageKey, t } from '../i18n/index.js';
import { need, setHidden, setText } from './dom.js';

export type ScreenName =
  | 'title'
  | 'howto'
  | 'game'
  | 'result'
  /** Between two days of a Week. */
  | 'day'
  /** After Saturday. */
  | 'week'
  /** When the stars run out. */
  | 'fail';

const SCREEN_NAMES: readonly ScreenName[] = [
  'title',
  'howto',
  'game',
  'result',
  'day',
  'week',
  'fail',
];

export interface TitleNodes {
  readonly stats: HTMLElement;
  readonly note: HTMLElement;
}

export interface ResultNodes {
  readonly kicker: HTMLElement;
  readonly headline: HTMLElement;
  readonly score: HTMLElement;
  readonly grid: HTMLElement;
  readonly stats: HTMLElement;
  /** Which score stands for the day, when this run was practice. */
  readonly note: HTMLElement;
  /** How the share went. Kept apart from `note` so neither overwrites the other. */
  readonly shareNote: HTMLElement;
  readonly fallback: HTMLTextAreaElement;
}

export interface TitleModel {
  readonly streak: number;
  readonly best: number;
  /** Highest total from a completed Week; 0 before the first one. */
  readonly weekBest: number;
  /** False when the browser refused to store anything. */
  readonly persistent: boolean;
}

export interface ResultModel {
  readonly dailyNumber: number;
  readonly date: string;
  readonly summary: DaySummary;
  readonly grid: readonly string[];
  readonly streak: number;
  readonly best: number;
  readonly isPractice: boolean;
  /** The score that stands for the day, when this run was practice. */
  readonly officialScore: number | null;
}

export function showScreen(app: HTMLElement, name: ScreenName): void {
  if (app.dataset['screen'] !== name) {
    app.dataset['screen'] = name;
  }
}

export function currentScreen(app: HTMLElement): ScreenName {
  const name = app.dataset['screen'];
  return SCREEN_NAMES.find((screen) => screen === name) ?? 'title';
}

/** Fills every element carrying a `data-t` key. Re-run on a language switch. */
export function applyStaticText(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-t]')) {
    const key = element.dataset['t'];
    if (key !== undefined && isMessageKey(key)) {
      setText(element, t(key));
    }
  }
}

export function renderTitle(nodes: TitleNodes, model: TitleModel): void {
  const parts =
    model.streak > 0
      ? [t('title.streak', { count: model.streak }), t('title.best', { score: model.best })]
      : [t('title.noStreak')];
  if (model.weekBest > 0) {
    parts.push(t('title.weekBest', { score: model.weekBest }));
  }
  setText(nodes.stats, parts.join(' · '));
  setText(nodes.note, model.persistent ? '' : t('title.noStorage'));
}

function statLine(labelKey: Parameters<typeof t>[0], value: string): string {
  return `${t(labelKey)}: ${value}`;
}

export function renderResult(nodes: ResultNodes, model: ResultModel): void {
  const { summary } = model;

  setText(nodes.kicker, `${t('share.mode.daily')} #${String(model.dailyNumber)} · ${model.date}`);
  setText(nodes.headline, t(model.isPractice ? 'result.practice' : 'result.official'));
  setText(nodes.score, String(summary.score));
  setText(nodes.grid, model.grid.join('\n'));

  const stats: string[] = [
    statLine('result.time', formatTime(summary.timeMs)),
    statLine('result.streak', String(model.streak)),
    statLine('result.best', String(model.best)),
    t('result.served', { count: summary.served }),
    t('result.hinted', { count: summary.hinted }),
    t('result.walked', { count: summary.walked }),
    t('result.refused', { count: summary.refused }),
    t('result.unplaced', { count: summary.unplaced }),
    t('result.wrongTaps', { count: summary.wrongTaps }),
  ];

  nodes.stats.replaceChildren(
    ...stats.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );

  setText(
    nodes.note,
    model.isPractice && model.officialScore !== null
      ? `${t('result.official')}: ${String(model.officialScore)}`
      : '',
  );
  // A fresh result means whatever the last share said is stale.
  setText(nodes.shareNote, '');
}

export function titleNodes(root: ParentNode): TitleNodes {
  return {
    stats: need<HTMLElement>(root, '#title-stats'),
    note: need<HTMLElement>(root, '#title-note'),
  };
}

export function resultNodes(root: ParentNode): ResultNodes {
  return {
    kicker: need<HTMLElement>(root, '#result-kicker'),
    headline: need<HTMLElement>(root, '#result-headline'),
    score: need<HTMLElement>(root, '#result-score'),
    grid: need<HTMLElement>(root, '#result-grid'),
    stats: need<HTMLElement>(root, '#result-stats'),
    note: need<HTMLElement>(root, '#result-note'),
    shareNote: need<HTMLElement>(root, '#share-note'),
    fallback: need<HTMLTextAreaElement>(root, '#share-fallback'),
  };
}

/** Shows the share text in a selectable box when no API would take it. */
export function showShareFallback(nodes: ResultNodes, text: string): void {
  nodes.fallback.value = text;
  setHidden(nodes.fallback, false);
  nodes.fallback.focus();
  nodes.fallback.select();
}

export function hideShareFallback(nodes: ResultNodes): void {
  setHidden(nodes.fallback, true);
}

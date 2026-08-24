/**
 * The three screens a Week run passes through: the day summary between days,
 * the week summary after Saturday, and the Reklamacja screen when the stars run
 * out. All three read a `WeekState` and nothing else.
 */
import { formatTime } from '../core/share.js';
import { WEEK_LENGTH, dayReached, totalScore } from '../core/week.js';
import type { DayResult, WeekState } from '../core/week.js';
import { WEEK_DAY_KEYS } from '../core/profiles.js';
import { t } from '../i18n/index.js';
import { need, setHidden, setText } from './dom.js';
import type { ScreenName } from './screens.js';
import { renderStars } from './stars.js';

export interface DayScreenNodes {
  readonly kicker: HTMLElement;
  readonly headline: HTMLElement;
  readonly score: HTMLElement;
  readonly stars: HTMLElement;
  readonly lost: HTMLElement;
  readonly stats: HTMLElement;
}

/** Where a share confirmation and its fallback text go on a given screen. */
export interface ShareOutlet {
  readonly shareNote: HTMLElement;
  readonly fallback: HTMLTextAreaElement;
}

export interface WeekScreenNodes extends ShareOutlet {
  readonly kicker: HTMLElement;
  readonly total: HTMLElement;
  readonly stars: HTMLElement;
  readonly best: HTMLElement;
  readonly rows: HTMLElement;
}

export interface FailScreenNodes extends ShareOutlet {
  readonly kicker: HTMLElement;
  readonly total: HTMLElement;
  readonly incidents: HTMLElement;
}

/** `Pn`, `Wt`, … for a day index. */
export function dayLabel(dayIndex: number): string {
  const key = WEEK_DAY_KEYS[dayIndex];
  return key === undefined ? '' : t(`day.${key}`);
}

/** `Poniedziałek`, `Wtorek`, … for a day index. */
export function dayName(dayIndex: number): string {
  const key = WEEK_DAY_KEYS[dayIndex];
  return key === undefined ? '' : t(`day.full.${key}`);
}

function listItems(list: HTMLElement, lines: readonly string[]): void {
  list.replaceChildren(
    ...lines.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

/** What the day just played cost, in the words the player will recognise. */
export function incidentLines(day: DayResult): string[] {
  const lines: string[] = [];
  if (day.incidents.unplaced > 0) {
    lines.push(t('week.incident.unplaced', { count: day.incidents.unplaced }));
  }
  if (day.incidents.refused > 0) {
    lines.push(t('week.incident.refused', { count: day.incidents.refused }));
  }
  if (day.incidents.walked > 0) {
    lines.push(t('week.incident.walked', { count: day.incidents.walked }));
  }
  return lines;
}

export function renderDayScreen(nodes: DayScreenNodes, week: WeekState, day: DayResult): void {
  setText(
    nodes.kicker,
    `${dayName(day.dayIndex)} · ${String(day.dayIndex + 1)}/${String(WEEK_LENGTH)}`,
  );
  setText(nodes.headline, t('week.dayDone'));
  setText(nodes.score, String(day.score));
  // The stars lost today are drawn beside the ones left, so the animation has
  // something to fade out.
  renderStars(nodes.stars, { stars: day.stars, lost: day.starsLost });
  setText(
    nodes.lost,
    day.starsLost > 0 ? t('week.starsLost', { count: day.starsLost }) : t('week.noStarsLost'),
  );
  listItems(nodes.stats, [
    `${t('result.time')}: ${formatTime(day.timeMs)}`,
    `${t('week.total')}: ${String(totalScore(week))}`,
    ...incidentLines(day),
  ]);
}

export interface WeekSummaryModel {
  readonly week: WeekState;
  readonly best: number;
  readonly isBest: boolean;
}

export function renderWeekScreen(nodes: WeekScreenNodes, model: WeekSummaryModel): void {
  const { week } = model;
  setText(nodes.kicker, `${t('week.share.mode')} · ${String(week.days.length)}/${String(WEEK_LENGTH)}`);
  setText(nodes.total, String(totalScore(week)));
  renderStars(nodes.stars, { stars: week.stars });
  setText(
    nodes.best,
    model.isBest ? t('week.newBest') : `${t('week.best')}: ${String(model.best)}`,
  );

  nodes.rows.replaceChildren(
    ...week.days.map((day) => {
      const row = document.createElement('tr');
      const failed = day.stars === 0;
      row.dataset['failed'] = String(failed);

      const label = document.createElement('td');
      label.textContent = dayLabel(day.dayIndex);
      const stars = document.createElement('td');
      renderStars(stars, { stars: day.stars });
      stars.classList.add('stars');
      const score = document.createElement('td');
      score.textContent = String(day.score);

      row.append(label, stars, score);
      return row;
    }),
  );

  clearShareOutlet(nodes);
}

export function renderFailScreen(nodes: FailScreenNodes, week: WeekState): void {
  const last = week.days.at(-1);
  setText(
    nodes.kicker,
    t('fail.dayReached', { day: dayName(Math.max(dayReached(week) - 1, 0)) }),
  );
  setText(nodes.total, String(totalScore(week)));
  listItems(nodes.incidents, last === undefined ? [] : incidentLines(last));
  clearShareOutlet(nodes);
}

/**
 * Which screen's share outlet to write to. A week can be shared from the week
 * summary or from the Reklamacja screen, and the confirmation has to land on
 * the one the player is looking at — the other is hidden, so a note written
 * there is a note nobody ever reads.
 */
export function weekShareOutlet(
  screen: ScreenName,
  week: WeekScreenNodes,
  fail: FailScreenNodes,
): ShareOutlet {
  return screen === 'fail' ? fail : week;
}

/** A freshly rendered screen has nothing to say about a share that has not happened. */
export function clearShareOutlet(outlet: ShareOutlet): void {
  setText(outlet.shareNote, '');
  setHidden(outlet.fallback, true);
}

/** Puts the share text where the player can select it, on whichever screen they are on. */
export function showShareText(outlet: ShareOutlet, text: string): void {
  outlet.fallback.value = text;
  setHidden(outlet.fallback, false);
  outlet.fallback.focus();
  outlet.fallback.select();
}

export function dayScreenNodes(root: ParentNode): DayScreenNodes {
  return {
    kicker: need<HTMLElement>(root, '#day-kicker'),
    headline: need<HTMLElement>(root, '#day-headline'),
    score: need<HTMLElement>(root, '#day-score'),
    stars: need<HTMLElement>(root, '#day-stars'),
    lost: need<HTMLElement>(root, '#day-lost'),
    stats: need<HTMLElement>(root, '#day-stats'),
  };
}

export function weekScreenNodes(root: ParentNode): WeekScreenNodes {
  return {
    kicker: need<HTMLElement>(root, '#week-kicker'),
    total: need<HTMLElement>(root, '#week-total'),
    stars: need<HTMLElement>(root, '#week-stars'),
    best: need<HTMLElement>(root, '#week-best'),
    rows: need<HTMLElement>(root, '#week-rows'),
    shareNote: need<HTMLElement>(root, '#week-share-note'),
    fallback: need<HTMLTextAreaElement>(root, '#week-share-fallback'),
  };
}

export function failScreenNodes(root: ParentNode): FailScreenNodes {
  return {
    kicker: need<HTMLElement>(root, '#fail-kicker'),
    total: need<HTMLElement>(root, '#fail-total'),
    incidents: need<HTMLElement>(root, '#fail-incidents'),
    shareNote: need<HTMLElement>(root, '#fail-share-note'),
    fallback: need<HTMLTextAreaElement>(root, '#fail-share-fallback'),
  };
}

/** The per-day lines the Week share card is built from. */
export function weekShareDays(week: WeekState): {
  label: string;
  score: number;
  stars: number;
  failed: boolean;
}[] {
  return week.days.map((day) => ({
    label: dayLabel(day.dayIndex),
    score: day.score,
    stars: day.stars,
    failed: day.stars === 0,
  }));
}


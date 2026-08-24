// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DaySummary } from '../core/game.js';
import { recordDay, startWeek } from '../core/week.js';
import type { WeekState } from '../core/week.js';
import { setLang } from '../i18n/index.js';
import { renderStars } from './stars.js';
import { mountApp } from './testing.js';
import {
  clearShareOutlet,
  dayLabel,
  dayName,
  dayScreenNodes,
  failScreenNodes,
  incidentLines,
  renderDayScreen,
  renderFailScreen,
  renderWeekScreen,
  showShareText,
  weekScreenNodes,
  weekShareDays,
} from './week-screens.js';

const summary = (overrides: Partial<DaySummary> = {}): DaySummary => ({
  served: 10,
  hinted: 0,
  walked: 0,
  refused: 0,
  unplaced: 0,
  wrongTaps: 0,
  score: 1000,
  timeMs: 90_000,
  slotOutcomes: {},
  ...overrides,
});

const play = (week: WeekState, ...days: Partial<DaySummary>[]): WeekState =>
  days.reduce((state, day) => recordDay(state, summary(day), ['📦']), week);

beforeEach(() => {
  setLang('pl');
  mountApp();
});

afterEach(() => {
  setLang('pl');
});

describe('day names', () => {
  it('are the Polish abbreviations the design asks for', () => {
    expect([0, 1, 2, 3, 4, 5].map(dayLabel)).toEqual(['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']);
  });

  it('have full names for the day-summary heading', () => {
    expect(dayName(0)).toBe('Poniedziałek');
    expect(dayName(5)).toBe('Sobota');
  });

  it('switch language with everything else', () => {
    setLang('en');
    expect([0, 5].map(dayLabel)).toEqual(['Mon', 'Sat']);
    expect(dayName(3)).toBe('Thursday');
  });

  it('are empty for a day that does not exist', () => {
    expect(dayLabel(9)).toBe('');
    expect(dayName(-1)).toBe('');
  });
});

describe('stars', () => {
  it('draws one element per star, filled up to the count', () => {
    const element = document.createElement('span');
    renderStars(element, { stars: 2 });
    expect(element.children).toHaveLength(3);
    expect(element.querySelectorAll('[data-filled="true"]')).toHaveLength(2);
    expect(element.querySelectorAll('[data-filled="false"]')).toHaveLength(1);
  });

  it('marks the ones just lost, immediately above what is left', () => {
    const element = document.createElement('span');
    renderStars(element, { stars: 1, lost: 2 });
    const lost = [...element.children].map((child) => child.getAttribute('data-lost'));
    expect(lost).toEqual([null, 'true', 'true']);
  });

  it('names itself for a screen reader', () => {
    setLang('en');
    const element = document.createElement('span');
    renderStars(element, { stars: 2 });
    expect(element.getAttribute('aria-label')).toBe('Stars: 2 of 3');
    expect(element.getAttribute('role')).toBe('img');
  });

  it('reuses the elements it already made', () => {
    const element = document.createElement('span');
    renderStars(element, { stars: 3 });
    const first = element.firstElementChild;
    renderStars(element, { stars: 1 });
    expect(element.children).toHaveLength(3);
    expect(element.firstElementChild).toBe(first);
  });
});

describe('day summary', () => {
  it('names the day, the score and what it cost', () => {
    const week = play(startWeek(1), { score: 1590, refused: 1 });
    const day = week.days[0];
    if (day === undefined) {
      throw new Error('no day');
    }
    renderDayScreen(dayScreenNodes(document), week, day);

    expect(document.querySelector('#day-kicker')?.textContent).toBe('Poniedziałek · 1/6');
    expect(document.querySelector('#day-score')?.textContent).toBe('1590');
    expect(document.querySelector('#day-lost')?.textContent).toContain('1');
    expect(document.querySelectorAll('#day-stars [data-filled="true"]')).toHaveLength(2);
    expect(document.querySelectorAll('#day-stars [data-lost="true"]')).toHaveLength(1);
    expect(document.querySelector('#day-stats')?.textContent).toContain('1:30');
  });

  it('says so when a day cost nothing', () => {
    const week = play(startWeek(1), { score: 1000 });
    const day = week.days[0];
    if (day === undefined) {
      throw new Error('no day');
    }
    renderDayScreen(dayScreenNodes(document), week, day);
    expect(document.querySelector('#day-lost')?.textContent).toBe('Bez strat');
    expect(document.querySelectorAll('#day-stars [data-lost="true"]')).toHaveLength(0);
  });

  it('lists only the incidents that happened', () => {
    expect(
      incidentLines({
        dayIndex: 0,
        score: 0,
        timeMs: 0,
        stars: 1,
        starsLost: 2,
        incidents: { unplaced: 2, refused: 0, walked: 0 },
        grid: [],
      }),
    ).toHaveLength(1);
  });
});

describe('week summary', () => {
  const finished = (): WeekState => play(startWeek(1), {}, {}, {}, {}, {}, { score: 2000 });

  it('has a row per day with its stars and score', () => {
    renderWeekScreen(weekScreenNodes(document), { week: finished(), best: 0, isBest: true });
    const rows = document.querySelectorAll('#week-rows tr');
    expect(rows).toHaveLength(6);
    expect(rows[0]?.querySelector('td')?.textContent).toBe('Pn');
    expect(rows[5]?.textContent).toContain('2000');
    expect(document.querySelector('#week-total')?.textContent).toBe('7000');
  });

  it('marks a new best, and otherwise names the one to beat', () => {
    const nodes = weekScreenNodes(document);
    renderWeekScreen(nodes, { week: finished(), best: 0, isBest: true });
    expect(document.querySelector('#week-best')?.textContent).toBe('Nowy rekord tygodnia');

    renderWeekScreen(nodes, { week: finished(), best: 9000, isBest: false });
    expect(document.querySelector('#week-best')?.textContent).toContain('9000');
  });

  it('keeps the new-best marker when the language is switched', () => {
    // The language toggle re-renders from the cached outcome, not from storage:
    // by then the best has already been written, so storage can no longer tell
    // us the run beat it.
    const nodes = weekScreenNodes(document);
    const model = { week: finished(), best: 7000, isBest: true };
    renderWeekScreen(nodes, model);
    expect(nodes.best.textContent).toBe('Nowy rekord tygodnia');

    setLang('en');
    renderWeekScreen(nodes, model);
    expect(nodes.best.textContent).toBe('New best week');
    expect(nodes.best.textContent).not.toContain('7000');
  });

  it('clears any stale share confirmation', () => {
    const nodes = weekScreenNodes(document);
    nodes.shareNote.textContent = 'Skopiowano';
    renderWeekScreen(nodes, { week: finished(), best: 0, isBest: false });
    expect(nodes.shareNote.textContent).toBe('');
    expect(nodes.fallback.hidden).toBe(true);
  });

  it('builds the share lines from the days played', () => {
    const week = play(startWeek(1), { score: 100 }, { score: 200, walked: 1 });
    expect(weekShareDays(week)).toEqual([
      { label: 'Pn', score: 100, stars: 3, failed: false },
      { label: 'Wt', score: 200, stars: 2, failed: false },
    ]);
  });

  it('marks the day a failed week ran out on', () => {
    const week = play(startWeek(1), { score: 100 }, { score: 200, walked: 3 });
    expect(weekShareDays(week).at(-1)).toEqual({
      label: 'Wt',
      score: 200,
      stars: 0,
      failed: true,
    });
  });
});

describe('sharing a week', () => {
  it('puts the text and the confirmation on the screen the player is looking at', () => {
    // Both screens have their own outlet; the week summary's is hidden while
    // the Reklamacja screen is up, so a note written there is a note nobody
    // ever reads.
    const week = weekScreenNodes(document);
    const fail = failScreenNodes(document);
    expect(week.shareNote).not.toBe(fail.shareNote);
    expect(week.fallback).not.toBe(fail.fallback);

    showShareText(fail, 'paczkom.at · Tydzień');
    expect(fail.fallback.hidden).toBe(false);
    expect(fail.fallback.value).toBe('paczkom.at · Tydzień');
    expect(fail.fallback.readOnly).toBe(true);
    // The week summary's own box is untouched.
    expect(week.fallback.hidden).toBe(true);
    expect(week.fallback.value).toBe('');
  });

  it('selects the text so it can be copied by hand', () => {
    const fail = failScreenNodes(document);
    showShareText(fail, 'abc');
    expect(document.activeElement).toBe(fail.fallback);
    expect(fail.fallback.selectionStart).toBe(0);
    expect(fail.fallback.selectionEnd).toBe(3);
  });

  it('clears a stale confirmation when a screen is rendered again', () => {
    const fail = failScreenNodes(document);
    showShareText(fail, 'abc');
    fail.shareNote.textContent = 'Skopiowano';

    renderFailScreen(fail, play(startWeek(1), { walked: 3 }));
    expect(fail.shareNote.textContent).toBe('');
    expect(fail.fallback.hidden).toBe(true);
  });

  it('is cleared on both screens independently', () => {
    const week = weekScreenNodes(document);
    const fail = failScreenNodes(document);
    showShareText(week, 'week text');
    clearShareOutlet(fail);
    expect(week.fallback.hidden).toBe(false);
    clearShareOutlet(week);
    expect(week.fallback.hidden).toBe(true);
  });
});

describe('reklamacja', () => {
  it('names the day it ended on and lists what cost the stars', () => {
    const week = play(startWeek(1), { score: 100 }, { score: 200, walked: 2, refused: 1 });
    expect(week.status).toBe('failed');
    renderFailScreen(failScreenNodes(document), week);

    expect(document.querySelector('#fail-kicker')?.textContent).toContain('Wtorek');
    expect(document.querySelector('#fail-total')?.textContent).toBe('300');
    const incidents = document.querySelectorAll('#fail-incidents li');
    expect(incidents).toHaveLength(2);
    expect(document.querySelector('#fail-incidents')?.textContent).toContain('2');
  });
});

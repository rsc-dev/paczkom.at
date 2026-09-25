// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DaySummary } from '../core/game.js';
import { setLang } from '../i18n/index.js';
import {
  applyStaticText,
  currentScreen,
  hideShareFallback,
  renderResult,
  renderTitle,
  resultNodes,
  showScreen,
  showShareFallback,
  titleNodes,
} from './screens.js';
import { mountApp } from './testing.js';

const SUMMARY: DaySummary = {
  served: 18,
  hinted: 4,
  walked: 1,
  refused: 1,
  unplaced: 0,
  wrongTaps: 6,
  score: 2450,
  timeMs: 107_000,
  slotOutcomes: {},
};

let app: HTMLElement;

beforeEach(() => {
  setLang('pl');
  app = mountApp();
});

afterEach(() => {
  setLang('pl');
});

describe('routing', () => {
  it('shows one screen at a time and reports which', () => {
    expect(currentScreen(app)).toBe('title');
    showScreen(app, 'game');
    expect(app.dataset['screen']).toBe('game');
    expect(currentScreen(app)).toBe('game');
    showScreen(app, 'result');
    expect(currentScreen(app)).toBe('result');
  });

  it('treats an unknown value as the title screen', () => {
    app.dataset['screen'] = 'nonsense';
    expect(currentScreen(app)).toBe('title');
  });

  it('keeps every screen in the same document, so nothing navigates', () => {
    for (const id of ['#screen-title', '#screen-howto', '#screen-game', '#screen-result']) {
      expect(document.querySelector(id)).not.toBeNull();
    }
    expect(document.querySelectorAll('a[href]')).toHaveLength(0);
  });
});

describe('applyStaticText', () => {
  it('fills every labelled element in the current language', () => {
    applyStaticText(document);
    expect(document.querySelector('#btn-play')?.textContent).toBe('Dzisiaj');
    expect(document.querySelector('#btn-howto')?.textContent).toBe('Jak grać');

    setLang('en');
    applyStaticText(document);
    expect(document.querySelector('#btn-play')?.textContent).toBe('Today');
    expect(document.querySelector('#btn-howto')?.textContent).toBe('How to play');
  });

  it('leaves elements without a key alone', () => {
    const before = document.querySelector('#title-mark')?.textContent;
    applyStaticText(document);
    expect(document.querySelector('#title-mark')?.textContent).toBe(before);
  });
});

describe('renderTitle', () => {
  it('shows the streak and best once there is one', () => {
    renderTitle(titleNodes(document), { streak: 4, best: 3200, weekBest: 0, persistent: true, savedDay: null });
    const stats = document.querySelector('#title-stats')?.textContent ?? '';
    expect(stats).toContain('4');
    expect(stats).toContain('3200');
    expect(document.querySelector('#title-note')?.textContent).toBe('');
  });

  it('says so before the first game', () => {
    renderTitle(titleNodes(document), { streak: 0, best: 0, weekBest: 0, persistent: true, savedDay: null });
    expect(document.querySelector('#title-stats')?.textContent).toBe('Dziś jeszcze bez gry');
  });

  it('offers to continue a saved week, naming the day about to be played', () => {
    const nodes = titleNodes(document);
    renderTitle(nodes, { streak: 0, best: 0, weekBest: 0, persistent: true, savedDay: 2 });
    expect(nodes.continueWeek.hidden).toBe(false);
    expect(nodes.continueWeek.textContent).toBe('Dokończ tydzień · Środa');
  });

  it('hides the offer once nothing is saved', () => {
    const nodes = titleNodes(document);
    renderTitle(nodes, { streak: 0, best: 0, weekBest: 0, persistent: true, savedDay: 2 });
    renderTitle(nodes, { streak: 0, best: 0, weekBest: 0, persistent: true, savedDay: null });
    expect(nodes.continueWeek.hidden).toBe(true);
  });

  it('warns when the browser will not remember anything', () => {
    renderTitle(titleNodes(document), { streak: 0, best: 0, weekBest: 0, persistent: false, savedDay: null });
    expect(document.querySelector('#title-note')?.textContent).not.toBe('');
  });
});

describe('renderResult', () => {
  const model = {
    dailyNumber: 12,
    date: '2026-09-12',
    summary: SUMMARY,
    grid: ['📦📦🟧', '📦🟥⬜'],
    streak: 3,
    best: 3200,
    isPractice: false,
    officialScore: null,
  };

  it('shows the daily number, date, score, grid and stats', () => {
    renderResult(resultNodes(document), model);
    expect(document.querySelector('#result-kicker')?.textContent).toBe('Dzisiaj #12 · 2026-09-12');
    expect(document.querySelector('#result-score')?.textContent).toBe('2450');
    expect(document.querySelector('#result-grid')?.textContent).toBe('📦📦🟧\n📦🟥⬜');

    const stats = document.querySelector('#result-stats')?.textContent ?? '';
    expect(stats).toContain('1:47');
    expect(stats).toContain('3');
    expect(stats).toContain('3200');
    expect(document.querySelectorAll('#result-stats li').length).toBeGreaterThanOrEqual(9);
  });

  it('labels the first run of the day as the result that stands', () => {
    renderResult(resultNodes(document), model);
    expect(document.querySelector('#result-headline')?.textContent).toBe('Dzisiejszy wynik');
    expect(document.querySelector('#result-note')?.textContent).toBe('');
  });

  it('labels a practice run and still shows the score that stands', () => {
    renderResult(resultNodes(document), { ...model, isPractice: true, officialScore: 1800 });
    expect(document.querySelector('#result-headline')?.textContent).toContain('Trening');
    expect(document.querySelector('#result-score')?.textContent).toBe('2450');
    expect(document.querySelector('#result-note')?.textContent).toContain('1800');
  });

  it('keeps the share confirmation clear of the note about the day&#39;s result', () => {
    const nodes = resultNodes(document);
    renderResult(nodes, { ...model, isPractice: true, officialScore: 1800 });

    // What the share did goes on its own line, so confirming it cannot wipe the
    // line that says which score actually stands.
    nodes.shareNote.textContent = 'Skopiowano do schowka';
    expect(nodes.note.textContent).toContain('1800');
    expect(nodes.shareNote).not.toBe(nodes.note);

    // ... and a fresh result clears the stale confirmation.
    renderResult(nodes, model);
    expect(nodes.shareNote.textContent).toBe('');
  });

  it('replaces the stats rather than appending on a re-render', () => {
    const nodes = resultNodes(document);
    renderResult(nodes, model);
    const first = document.querySelectorAll('#result-stats li').length;
    renderResult(nodes, model);
    expect(document.querySelectorAll('#result-stats li')).toHaveLength(first);
  });
});

describe('share fallback', () => {
  it('is hidden until it is needed, then holds the text', () => {
    const nodes = resultNodes(document);
    expect(nodes.fallback.hidden).toBe(true);

    showShareFallback(nodes, 'paczkom.at · Dzisiaj #12');
    expect(nodes.fallback.hidden).toBe(false);
    expect(nodes.fallback.value).toBe('paczkom.at · Dzisiaj #12');
    expect(nodes.fallback.readOnly).toBe(true);

    hideShareFallback(nodes);
    expect(nodes.fallback.hidden).toBe(true);
  });
});

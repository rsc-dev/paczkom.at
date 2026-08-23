/**
 * Boot, routing and the frame loop.
 *
 * The core owns the rules; this file owns the clock, the DOM and the browser.
 * Every action goes through `dispatch`, which plays the cues the reducer raised
 * and then writes the new state to the view — in that order, synchronously, so
 * a cue is never heard a frame late or twice.
 */
import './theme/fonts.css';
import './theme/tokens.css';
import './theme/signage.css';
import './theme/app.css';

import { createSfx } from './audio/sfx.js';
import {
  LAUNCH_EPOCH,
  computeBest,
  computeStreak,
  dailyNumber,
  dailySeed,
  recordRun,
  utcDateString,
} from './core/daily.js';
import type { DailyRecords } from './core/daily.js';
import { initialState, reduce } from './core/game.js';
import type { Action, State } from './core/game.js';
import { DAILY_PROFILE } from './core/profiles.js';
import { buildGrid, buildShareText } from './core/share.js';
import { STORAGE_KEYS, storage } from './storage.js';
import { detectLang, getLang, otherLang, setLang, t } from './i18n/index.js';
import { need, setText } from './ui/dom.js';
import { bindGameInput, onFirstGesture } from './ui/input.js';
import { createGameView, outcomesOf, renderGame } from './ui/render.js';
import type { GameView } from './ui/render.js';
import { shareText, targetsFrom } from './ui/share.js';
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
} from './ui/screens.js';
import type { ResultModel } from './ui/screens.js';

/** A frame after a backgrounded tab can be minutes long; do not lose the day. */
const MAX_FRAME_MS = 250;

const app = need<HTMLElement>(document, '#app');
const title = titleNodes(document);
const result = resultNodes(document);

const today = utcDateString(new Date());
const seed = dailySeed(today);

let game: State = initialState(seed, DAILY_PROFILE);
let view: GameView;
let frameHandle = 0;
let lastFrame = 0;
let lastResult: ResultModel | null = null;

// ------------------------------------------------------------------ storage

const readRecords = (): DailyRecords => storage.get<DailyRecords>(STORAGE_KEYS.daily) ?? {};

const readBest = (): number =>
  Math.max(storage.get<number>(STORAGE_KEYS.best) ?? 0, computeBest(readRecords()));

const sfx = createSfx({ muted: storage.get<boolean>(STORAGE_KEYS.mute) ?? false });

// -------------------------------------------------------------------- boot

function bootLanguage(): void {
  setLang(detectLang({ stored: storage.get(STORAGE_KEYS.lang), navigatorLanguage: navigator.language }));
  document.documentElement.lang = getLang();
}

function bootTheme(): void {
  const stored = storage.get<string>(STORAGE_KEYS.theme);
  document.documentElement.dataset['theme'] = stored ?? 'signage';
}

// ------------------------------------------------------------------ render

function renderChrome(): void {
  applyStaticText(document);

  // The mute button is a glyph so it stays a 40 px square in a crowded HUD;
  // its name comes from `aria-label`, not from what you can see.
  for (const id of ['#btn-mute', '#btn-mute-game']) {
    const button = need<HTMLElement>(document, id);
    button.setAttribute('aria-label', t(sfx.isMuted() ? 'hud.unmute' : 'hud.mute'));
    button.setAttribute('aria-pressed', String(sfx.isMuted()));
    button.dataset['muted'] = String(sfx.isMuted());
  }

  // The language button shows the language it switches *to*.
  for (const id of ['#btn-lang', '#btn-lang-game']) {
    const button = need<HTMLElement>(document, id);
    setText(button, otherLang().toUpperCase());
    button.setAttribute('aria-label', t('hud.language'));
  }
  renderTitle(title, {
    streak: computeStreak(readRecords(), today),
    best: readBest(),
    persistent: storage.persistent,
  });
  if (lastResult !== null) {
    renderResult(result, lastResult);
  }
}

/** Re-renders whatever is on screen; used after a language switch. */
function renderCurrent(): void {
  renderChrome();
  if (currentScreen(app) === 'game') {
    renderGame(view, game);
  }
}

// ---------------------------------------------------------------- the loop

function dispatch(action: Action): void {
  const next = reduce(game, action);
  for (const cue of next.cues) {
    sfx.play(cue);
  }
  game = next;
  if (currentScreen(app) === 'game') {
    renderGame(view, game);
  }
  if (game.phase === 'SUMMARY') {
    finishDay();
  }
}

function frame(now: number): void {
  const delta = lastFrame === 0 ? 0 : now - lastFrame;
  lastFrame = now;
  frameHandle = requestAnimationFrame(frame);
  if (delta > 0) {
    dispatch({ type: 'tick', dtMs: Math.min(delta, MAX_FRAME_MS) });
  }
}

function startLoop(): void {
  stopLoop();
  lastFrame = 0;
  frameHandle = requestAnimationFrame(frame);
}

function stopLoop(): void {
  if (frameHandle !== 0) {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }
}

// ------------------------------------------------------------- day lifecycle

function startDay(): void {
  game = initialState(seed, DAILY_PROFILE);
  hideShareFallback(result);
  renderGame(view, game);
  showScreen(app, 'game');
  dispatch({ type: 'start' });
  startLoop();
}

function finishDay(): void {
  stopLoop();
  const summary = game.summary;
  if (summary === null) {
    return;
  }

  const grid = buildGrid(game.slots, outcomesOf(game));
  const before = readRecords();
  const officialBefore = before[today]?.result?.score ?? null;
  const { records, isPractice } = recordRun(before, today, {
    score: summary.score,
    timeMs: summary.timeMs,
    grid,
  });
  storage.set(STORAGE_KEYS.daily, records);
  storage.set(STORAGE_KEYS.best, Math.max(storage.get<number>(STORAGE_KEYS.best) ?? 0, computeBest(records)));

  lastResult = {
    dailyNumber: dailyNumber(today, LAUNCH_EPOCH),
    date: today,
    summary,
    grid,
    streak: computeStreak(records, today),
    best: readBest(),
    isPractice,
    officialScore: isPractice ? officialBefore : null,
  };

  renderChrome();
  renderResult(result, lastResult);
  showScreen(app, 'result');
}

// ------------------------------------------------------------------- share

async function onShare(): Promise<void> {
  if (lastResult === null) {
    return;
  }
  const text = buildShareText({
    labels: { mode: t('share.mode.daily'), points: t('share.points') },
    number: lastResult.dailyNumber,
    grid: lastResult.grid,
    score: lastResult.summary.score,
    timeMs: lastResult.summary.timeMs,
  });

  const outcome = await shareText(text, targetsFrom(navigator));
  if (outcome === 'manual') {
    showShareFallback(result, text);
  } else {
    hideShareFallback(result);
  }
  setText(
    result.note,
    t(outcome === 'shared' ? 'share.shared' : outcome === 'copied' ? 'share.copied' : 'share.manual'),
  );
}

// ------------------------------------------------------------------ wiring

function onClick(selector: string, handler: () => void): void {
  need<HTMLElement>(document, selector).addEventListener('click', handler);
}

function toggleLanguage(): void {
  const next = otherLang();
  setLang(next);
  storage.set(STORAGE_KEYS.lang, next);
  document.documentElement.lang = next;
  renderCurrent();
}

function toggleMute(): void {
  sfx.setMuted(!sfx.isMuted());
  storage.set(STORAGE_KEYS.mute, sfx.isMuted());
  renderChrome();
}

function boot(): void {
  bootLanguage();
  bootTheme();

  view = createGameView(document, game);
  bindGameInput(view.stage, view.tray, dispatch);
  onFirstGesture(window, () => {
    sfx.unlock();
  });

  onClick('#btn-play', startDay);
  onClick('#btn-howto', () => {
    showScreen(app, 'howto');
  });
  onClick('#btn-howto-back', () => {
    showScreen(app, 'title');
  });
  onClick('#btn-howto-play', startDay);
  onClick('#btn-again', startDay);
  onClick('#btn-home', () => {
    stopLoop();
    showScreen(app, 'title');
    renderChrome();
  });
  onClick('#btn-share', () => {
    void onShare();
  });
  onClick('#btn-lang', toggleLanguage);
  onClick('#btn-lang-game', toggleLanguage);
  onClick('#btn-mute', toggleMute);
  onClick('#btn-mute-game', toggleMute);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLoop();
    } else if (currentScreen(app) === 'game' && game.phase !== 'SUMMARY') {
      startLoop();
    }
  });

  renderChrome();
  renderGame(view, game);
  showScreen(app, 'title');
}

boot();

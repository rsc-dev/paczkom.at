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
import { initialState, reduce, slotOutcomes } from './core/game.js';
import type { Action, State } from './core/game.js';
import { buildGrid, buildShareText, buildWeekShareText } from './core/share.js';
import { encodeSeed, seedFromText } from './core/week.js';
import {
  continueWeekRun,
  currentStreak,
  finishDailyRun,
  finishWeekDay,
  readBest,
  readWeekBest,
  startDailyRun,
  startWeekRun,
} from './run.js';
import type { DayRun, RunEnvironment, WeekOutcome, WeekRun } from './run.js';
import { STORAGE_KEYS, storage } from './storage.js';
import { detectLang, getLang, otherLang, setLang, t } from './i18n/index.js';
import { need, setHidden, setText } from './ui/dom.js';
import { bindGameInput, onFirstGesture } from './ui/input.js';
import { createGameView, rebuildWall, renderGame } from './ui/render.js';
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
import type { ResultModel, ScreenName } from './ui/screens.js';
import {
  dayScreenNodes,
  failScreenNodes,
  renderDayScreen,
  renderFailScreen,
  renderWeekScreen,
  showShareText,
  weekScreenNodes,
  weekShareDays,
  weekShareOutlet,
} from './ui/week-screens.js';

/** A frame after a backgrounded tab can be minutes long; do not lose the day. */
const MAX_FRAME_MS = 250;

const app = need<HTMLElement>(document, '#app');
const title = titleNodes(document);
const result = resultNodes(document);
const dayScreen = dayScreenNodes(document);
const weekScreen = weekScreenNodes(document);
const failScreen = failScreenNodes(document);

/** The clock and the storage the run logic reads; injected so it is testable. */
const env: RunEnvironment = { now: () => new Date(), storage };

/** Fixed when a day starts, read when it finishes. Null between days. */
let run: DayRun | null = startDailyRun(env);

let game: State = initialState(run.seed, run.profile);
let view: GameView;
let frameHandle = 0;
let lastFrame = 0;
let lastResult: ResultModel | null = null;
/**
 * The last finished Week day: the run it belonged to, and what the week layer
 * made of it. Kept so a language switch can re-render the screen exactly as it
 * was — including "new best", which is not recoverable from storage once the
 * best has been written.
 */
let lastWeekOutcome: WeekOutcome | null = null;

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

  // The mute button is an icon toggle: a name that does not change ("Sound")
  // plus `aria-pressed` for the state, rather than a label that flips under the
  // reader's feet. Pressed means sound is on.
  for (const id of ['#btn-mute', '#btn-mute-game']) {
    const button = need<HTMLElement>(document, id);
    button.setAttribute('aria-label', t('hud.sound'));
    button.setAttribute('aria-pressed', String(!sfx.isMuted()));
    button.dataset['muted'] = String(sfx.isMuted());
  }

  // The language button shows the language it switches *to*, and that visible
  // text is its accessible name; the explanation goes in the tooltip, so the
  // name a screen reader hears is the one a sighted user can read out.
  for (const id of ['#btn-lang', '#btn-lang-game']) {
    const button = need<HTMLElement>(document, id);
    const target = otherLang();
    setText(button, target.toUpperCase());
    button.title = t('lang.switchTo', { lang: t(`lang.${target}`) });
  }
  renderTitle(title, {
    streak: currentStreak(env),
    best: readBest(storage),
    weekBest: readWeekBest(storage),
    persistent: storage.persistent,
  });
  if (lastResult !== null) {
    renderResult(result, lastResult);
  }
}

/** Reputation goes in the HUD during a Week, and nowhere else. */
function hudStars(): { stars: number } | null {
  return run !== null && run.mode === 'week' ? { stars: run.week.stars } : null;
}

/** Re-renders whatever is on screen; used after a language switch. */
function renderCurrent(): void {
  renderChrome();
  const screen = currentScreen(app);
  if (screen === 'game') {
    renderGame(view, game, hudStars());
    return;
  }
  if (lastWeekOutcome === null) {
    return;
  }
  renderWeekEnd(lastWeekOutcome, screen);
}

/** Draws whichever of the three week screens is showing, from one outcome. */
function renderWeekEnd(outcome: WeekOutcome, screen: ScreenName): void {
  if (screen === 'day') {
    renderDayScreen(dayScreen, outcome.week, outcome.day);
  } else if (screen === 'week') {
    renderWeekScreen(weekScreen, {
      week: outcome.week,
      best: outcome.best,
      isBest: outcome.isBest,
    });
  } else if (screen === 'fail') {
    renderFailScreen(failScreen, outcome.week);
  }
}

// ---------------------------------------------------------------- the loop

function dispatch(action: Action): void {
  const previous = game;
  const next = reduce(game, action);
  for (const cue of next.cues) {
    sfx.play(cue);
  }
  game = next;
  if (currentScreen(app) === 'game') {
    renderGame(view, game, hudStars());
  }
  // On the *transition* into SUMMARY, never on being in it: a second call would
  // file the same day twice and turn the real result into a practice run.
  if (previous.phase !== 'SUMMARY' && next.phase === 'SUMMARY') {
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

/** Puts a day on the screen and starts its clock. */
function playRun(next: DayRun): void {
  run = next;
  game = initialState(next.seed, next.profile);
  hideShareFallback(result);
  // A Week day can be a different size from the one before it.
  rebuildWall(view, game);
  renderGame(view, game, hudStars());
  showScreen(app, 'game');
  dispatch({ type: 'start' });
  startLoop();
}

function startDay(): void {
  // The date and the seed are decided here, not at boot: a tab left open past
  // midnight UTC starts today's day, and a day started at 23:59 stays that day.
  playRun(startDailyRun(env));
}

function startWeek(seed: number): void {
  const week = startWeekRun(seed);
  writeWeekSeed(week.week.seed);
  playRun(week);
}

function finishDay(): void {
  stopLoop();
  const summary = game.summary;
  if (summary === null || run === null) {
    return;
  }
  const grid = buildGrid(game.slots, slotOutcomes(game));

  if (run.mode === 'week') {
    finishWeekDayScreen(run, grid);
    return;
  }

  lastResult = finishDailyRun(env, run, summary, grid);
  renderChrome();
  renderResult(result, lastResult);
  showScreen(app, 'result');
}

function finishWeekDayScreen(weekRun: WeekRun, grid: readonly string[]): void {
  const summary = game.summary;
  if (summary === null) {
    return;
  }
  const outcome = finishWeekDay(env, weekRun, summary, grid);
  lastWeekOutcome = outcome;
  run = { ...weekRun, week: outcome.week };
  renderChrome();

  const screen =
    outcome.week.status === 'failed' ? 'fail' : outcome.week.status === 'done' ? 'week' : 'day';
  renderWeekEnd(outcome, screen);
  showScreen(app, screen);
}

function nextWeekDay(): void {
  if (run === null || run.mode !== 'week') {
    return;
  }
  playRun(continueWeekRun(run.week));
}

// ------------------------------------------------------- the seed in the URL

/** `?week=<seed>` from the address bar, or `null` if there is not one. */
function readWeekSeed(): number | null {
  const text = new URLSearchParams(window.location.search).get('week');
  return text === null || text === '' ? null : seedFromText(text);
}

/**
 * Puts the seed in the address bar without navigating, so the URL is shareable
 * from the moment the week starts rather than only at the end of it.
 */
function writeWeekSeed(seed: number | null): void {
  const url = new URL(window.location.href);
  if (seed === null) {
    url.searchParams.delete('week');
  } else {
    url.searchParams.set('week', encodeSeed(seed));
  }
  window.history.replaceState(null, '', url);
}

/** A week nobody has played before. */
function randomWeekSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

// ------------------------------------------------------------------- share

async function onWeekShare(): Promise<void> {
  if (lastWeekOutcome === null) {
    return;
  }
  const outlet = weekShareOutlet(currentScreen(app), weekScreen, failScreen);
  const text = buildWeekShareText({
    modeLabel: t('week.share.mode'),
    days: weekShareDays(lastWeekOutcome.week),
    seed: encodeSeed(lastWeekOutcome.week.seed),
  });

  const outcome = await shareText(text, targetsFrom(navigator));
  if (outcome === 'dismissed') {
    return;
  }
  if (outcome === 'manual') {
    showShareText(outlet, text);
  } else {
    setHidden(outlet.fallback, true);
  }
  setText(
    outlet.shareNote,
    t(outcome === 'shared' ? 'share.shared' : outcome === 'copied' ? 'share.copied' : 'share.manual'),
  );
}

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
  if (outcome === 'dismissed') {
    // The player closed the sheet. Saying anything about it would be noise.
    return;
  }
  if (outcome === 'manual') {
    showShareFallback(result, text);
  } else {
    hideShareFallback(result);
  }
  // Its own line, so confirming a share never wipes the practice run's note
  // about which score actually stands for the day.
  setText(
    result.shareNote,
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

  // ---- week ----
  const goHome = (): void => {
    stopLoop();
    run = null;
    lastWeekOutcome = null;
    writeWeekSeed(null);
    showScreen(app, 'title');
    renderChrome();
  };
  const retryWeek = (): void => {
    if (lastWeekOutcome !== null) {
      startWeek(lastWeekOutcome.week.seed);
    }
  };
  const newWeek = (): void => {
    startWeek(randomWeekSeed());
  };

  onClick('#btn-week', newWeek);
  onClick('#btn-next-day', nextWeekDay);
  onClick('#btn-week-retry', retryWeek);
  onClick('#btn-fail-retry', retryWeek);
  onClick('#btn-week-new', newWeek);
  onClick('#btn-fail-new', newWeek);
  onClick('#btn-week-home', goHome);
  onClick('#btn-fail-home', goHome);
  onClick('#btn-week-share', () => {
    void onWeekShare();
  });
  onClick('#btn-fail-share', () => {
    void onWeekShare();
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

  // A shared link opens straight into that week.
  const shared = readWeekSeed();
  if (shared !== null) {
    startWeek(shared);
  }
}

boot();

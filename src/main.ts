/**
 * The handheld: timers, input, sound, record and sharing. Every rule lives in
 * core/game.ts; this file only decides when to call it.
 */
import './theme/fonts.css';
import './theme/tokens.css';
import './theme/app.css';

import { cueFor, createSfx } from './audio/sfx.js';
import { POSITIONS, move, newGame, step, tickInterval } from './core/game.js';
import type { GameEvent, GameState, Mode } from './core/game.js';
import { recordsFrom, withScore } from './core/record.js';
import type { Records } from './core/record.js';
import { detectLang, getLang, otherLang, setLang, t } from './i18n/index.js';
import { STORAGE_KEYS, storage } from './storage.js';
import { bindControls, targetPos } from './ui/controls.js';
import type { Command } from './ui/controls.js';
import { need, setAttr, setHidden, setText } from './ui/dom.js';
import { lcdMarkup } from './ui/lcd-art.js';
import { renderLcd } from './ui/lcd.js';
import type { LcdView } from './ui/lcd.js';
import { applyStaticText } from './ui/screens.js';
import { shareText, targetsFrom } from './ui/share.js';
import { shareText as buildShareText, slipText } from './ui/slip.js';

const RECORD_SHOW_MS = 1500;
const BLINK_MS = 500;
const POSE_MS = 4000;

const app = need<HTMLElement>(document, '#app');
const lcdHost = need<HTMLElement>(document, '#lcd');
lcdHost.innerHTML = lcdMarkup();
const svg = need<Element>(lcdHost, 'svg');
const slip = need<HTMLElement>(document, '#slip');
const slipTextNode = need<HTMLElement>(document, '#slip-text');
const slipRecord = need<HTMLElement>(document, '#slip-record');
const shareNote = need<HTMLElement>(document, '#share-note');
const shareFallback = need<HTMLTextAreaElement>(document, '#share-fallback');
const live = need<HTMLElement>(document, '#live');
const soundButton = need<HTMLButtonElement>(document, '#btn-sound');
const langButton = need<HTMLButtonElement>(document, '#btn-lang');

type Phase = 'clock' | 'record' | 'playing' | 'over';

let phase: Phase = 'clock';
let game: GameState | null = null;
let records: Records = recordsFrom(storage.get(STORAGE_KEYS.records));
let lastResult: { mode: Mode; score: number; isNew: boolean } | null = null;
let blink = true;
let idlePos = 3;
let tickTimer: number | undefined;
let recordTimer: number | undefined;

setLang(detectLang({ stored: storage.get(STORAGE_KEYS.lang), navigatorLanguage: navigator.language }));
const sfx = createSfx({ muted: storage.get(STORAGE_KEYS.mute) === true });

function view(): LcdView {
  if ((phase === 'playing' || phase === 'over') && game !== null) {
    return { kind: 'game', state: game, blink };
  }
  if (phase === 'record' && game !== null) {
    return { kind: 'record', mode: game.mode, record: records[game.mode] };
  }
  const now = new Date();
  return { kind: 'clock', hours: now.getHours(), minutes: now.getMinutes(), pos: idlePos, blink };
}

function render(): void {
  app.dataset['state'] = phase;
  renderLcd(svg, view());
}

function paintStatic(): void {
  document.documentElement.lang = getLang();
  applyStaticText(document);
  setText(langButton, t('lang.toggle'));
  setAttr(soundButton, 'aria-pressed', sfx.isMuted() ? 'false' : 'true');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.tagline'));
  if (lastResult !== null) {
    setText(slipTextNode, slipText(lastResult.score, records[lastResult.mode], getLang()));
  }
}

function stopTimers(): void {
  window.clearTimeout(tickTimer);
  window.clearTimeout(recordTimer);
  tickTimer = undefined;
  recordTimer = undefined;
}

function scheduleTick(): void {
  if (game === null || phase !== 'playing' || document.hidden) {
    return;
  }
  tickTimer = window.setTimeout(tick, tickInterval(game.mode, game.score));
}

/** Sound and the screen-reader line for what just happened. */
function announce(events: readonly GameEvent[]): void {
  if (game === null) {
    return;
  }
  for (const event of events) {
    const cue = cueFor(event);
    if (cue !== null) {
      sfx.play(cue);
    }
    if (event === 'deliver') {
      setText(live, t('live.score', { score: game.score }));
    } else if (event === 'miss') {
      setText(live, t('live.hearts', { count: game.hearts }));
    }
  }
}

function tick(): void {
  if (game === null) {
    return;
  }
  const result = step(game);
  game = result.state;
  announce(result.events);
  if (game.over) {
    finish();
  } else {
    scheduleTick();
  }
  render();
}

function finish(): void {
  if (game === null) {
    return;
  }
  phase = 'over';
  const { records: next, isNew } = withScore(records, game.mode, game.score);
  records = next;
  storage.set(STORAGE_KEYS.records, records);
  lastResult = { mode: game.mode, score: game.score, isNew };
  setText(slipTextNode, slipText(game.score, records[game.mode], getLang()));
  setHidden(slipRecord, !isNew);
  setText(shareNote, '');
  setHidden(shareFallback, true);
  setHidden(slip, false);
  setText(live, t('live.over'));
}

function start(mode: Mode): void {
  stopTimers();
  game = newGame(mode, Date.now() >>> 0);
  lastResult = null;
  setHidden(slip, true);
  phase = 'record';
  render();
  recordTimer = window.setTimeout(() => {
    phase = 'playing';
    render();
    scheduleTick();
  }, RECORD_SHOW_MS);
}

function showClock(): void {
  stopTimers();
  game = null;
  lastResult = null;
  setHidden(slip, true);
  phase = 'clock';
  render();
}

function onCommand(command: Command): void {
  sfx.unlock();
  if (command.kind === 'start') {
    start(command.mode);
  } else if (command.kind === 'clock') {
    showClock();
  } else if (game !== null && (phase === 'playing' || phase === 'record')) {
    const to = targetPos(game.pos, command);
    if (to !== null) {
      const result = move(game, to);
      game = result.state;
      announce(result.events);
      render();
    }
  }
}

async function share(): Promise<void> {
  if (lastResult === null) {
    return;
  }
  const text = buildShareText(lastResult.mode, lastResult.score, lastResult.isNew, getLang());
  const outcome = await shareText(text, targetsFrom(navigator));
  const notes = { shared: 'slip.shared', copied: 'slip.copied', manual: 'slip.manual', dismissed: null } as const;
  const key = notes[outcome];
  setText(shareNote, key === null ? '' : t(key));
  if (outcome === 'manual') {
    shareFallback.value = text;
    setHidden(shareFallback, false);
    shareFallback.select();
  }
}

bindControls(app, svg, onCommand);
need<HTMLButtonElement>(document, '#btn-share').addEventListener('click', () => void share());
soundButton.addEventListener('click', () => {
  sfx.setMuted(!sfx.isMuted());
  storage.set(STORAGE_KEYS.mute, sfx.isMuted());
  paintStatic();
});
langButton.addEventListener('click', () => {
  setLang(otherLang());
  storage.set(STORAGE_KEYS.lang, getLang());
  paintStatic();
});

// Leaving the tab freezes the shift; coming back resumes it where it stopped.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearTimeout(tickTimer);
    tickTimer = undefined;
  } else {
    scheduleTick();
  }
});

window.setInterval(() => {
  blink = !blink;
  render();
}, BLINK_MS);
window.setInterval(() => {
  if (phase === 'clock') {
    idlePos = (new Date().getSeconds() % POSITIONS) + 1;
  }
}, POSE_MS);

paintStatic();
render();

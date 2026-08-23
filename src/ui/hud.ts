/**
 * The HUD strip: which phase we are in, the clock, how much is left to do and
 * the running score. SERVE is shown as an in-fiction working day rather than a
 * countdown, because a locker does not have a stopwatch on it.
 */
import { formatTime } from '../core/share.js';
import type { State } from '../core/game.js';
import { loadDurationMs } from '../core/profiles.js';
import { t } from '../i18n/index.js';
import { percent, setText, setVar } from './dom.js';

export interface HudNodes {
  readonly phase: HTMLElement;
  readonly clock: HTMLElement;
  readonly meter: HTMLElement;
  readonly count: HTMLElement;
  readonly score: HTMLElement;
}

const PHASE_KEY = {
  LOAD: 'hud.phase.load',
  SERVE: 'hud.phase.serve',
  SWEEP: 'hud.phase.sweep',
  SUMMARY: 'hud.phase.sweep',
} as const;

/** SERVE mapped onto the profile's working day, e.g. 08:00 → 20:00. */
export function serveClock(state: State): string {
  const { dayStartHour, dayEndHour, serveMs } = state.profile;
  const span = (dayEndHour - dayStartHour) * 60;
  const progress = serveMs <= 0 ? 1 : Math.min(state.phaseElapsedMs / serveMs, 1);
  const minutes = dayStartHour * 60 + Math.floor(progress * span);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** What the clock reads in each phase. */
export function clockLabel(state: State): string {
  if (state.phase === 'LOAD') {
    return formatTime(Math.max(0, loadDurationMs(state.profile) - state.phaseElapsedMs));
  }
  if (state.phase === 'SERVE') {
    return serveClock(state);
  }
  return formatTime(state.elapsed.sweep);
}

/** How full the phase meter is: 1 at the start of a timed phase, 0 at its end. */
export function meterFill(state: State): number {
  if (state.phase === 'LOAD') {
    return 1 - state.phaseElapsedMs / loadDurationMs(state.profile);
  }
  if (state.phase === 'SERVE') {
    return 1 - state.phaseElapsedMs / state.profile.serveMs;
  }
  return 0;
}

/** The "how much is left" reading, which means something different per phase. */
export function countLabel(state: State): string {
  if (state.phase === 'LOAD') {
    return t('hud.parcelsLeft', { count: state.loadQueue.length });
  }
  if (state.phase === 'SERVE') {
    return t('hud.queue', { count: state.customers.length });
  }
  return t('screen.sweepRemaining', {
    count: state.slots.filter((slot) => slot.state === 'marked').length,
  });
}

export function renderHud(nodes: HudNodes, state: State): void {
  setText(nodes.phase, t(PHASE_KEY[state.phase]));
  setText(nodes.clock, clockLabel(state));
  setVar(nodes.meter, '--fill', percent(meterFill(state)));
  setText(nodes.count, countLabel(state));
  setText(nodes.score, `${String(state.score)} ${t('share.points')}`);
}

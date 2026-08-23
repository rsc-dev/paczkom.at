import { afterEach, describe, expect, it } from 'vitest';
import { initialState, reduce } from '../core/game.js';
import type { State } from '../core/game.js';
import { DAILY_PROFILE } from '../core/profiles.js';
import { setLang } from '../i18n/index.js';
import { clockLabel, countLabel, meterFill, serveClock } from './hud.js';

const started = (): State => reduce(initialState(5, DAILY_PROFILE), { type: 'start' });

const at = (state: State, phaseElapsedMs: number): State => ({ ...state, phaseElapsedMs });

afterEach(() => {
  setLang('pl');
});

describe('serveClock', () => {
  it('runs the profile working day from open to close', () => {
    const serving: State = { ...started(), phase: 'SERVE' };
    expect(serveClock(at(serving, 0))).toBe('08:00');
    expect(serveClock(at(serving, DAILY_PROFILE.serveMs / 2))).toBe('14:00');
    expect(serveClock(at(serving, DAILY_PROFILE.serveMs))).toBe('20:00');
  });

  it('pads to two digits either side', () => {
    const serving: State = { ...started(), phase: 'SERVE' };
    expect(serveClock(at(serving, 1))).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('clockLabel', () => {
  it('counts LOAD down', () => {
    const state = started();
    expect(clockLabel(state)).toBe('0:25');
    expect(clockLabel(at(state, 12_000))).toBe('0:13');
    expect(clockLabel(at(state, DAILY_PROFILE.loadMs))).toBe('0:00');
  });

  it('shows the working day during SERVE', () => {
    expect(clockLabel({ ...started(), phase: 'SERVE', phaseElapsedMs: 0 })).toBe('08:00');
  });

  it('shows elapsed time during SWEEP', () => {
    const state: State = {
      ...started(),
      phase: 'SWEEP',
      elapsed: { load: 1_000, serve: 2_000, sweep: 65_000 },
    };
    expect(clockLabel(state)).toBe('1:05');
  });
});

describe('meterFill', () => {
  it('drains from full to empty over a timed phase', () => {
    const state = started();
    expect(meterFill(state)).toBe(1);
    expect(meterFill(at(state, DAILY_PROFILE.loadMs / 2))).toBeCloseTo(0.5);
    expect(meterFill(at(state, DAILY_PROFILE.loadMs))).toBe(0);
    expect(meterFill({ ...state, phase: 'SWEEP' })).toBe(0);
  });
});

describe('countLabel', () => {
  it('counts what is left to do in each phase, in the current language', () => {
    const state = started();
    setLang('pl');
    expect(countLabel(state)).toBe(`Paczki: ${String(DAILY_PROFILE.pickups)}`);
    setLang('en');
    expect(countLabel(state)).toBe(`Parcels: ${String(DAILY_PROFILE.pickups)}`);
    expect(countLabel({ ...state, phase: 'SERVE' })).toBe('Queue: 0');
    expect(countLabel({ ...state, phase: 'SWEEP' })).toBe('Left: 0');
  });
});

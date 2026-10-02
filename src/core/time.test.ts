import { describe, expect, it } from 'vitest';
import { warsawDay, warsawHour, warsawLocalToMs } from './time.js';

describe('Warsaw calendar', () => {
  it('puts 23:30 UTC in the next Warsaw day in summer and winter', () => {
    expect(warsawDay(Date.parse('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
    expect(warsawDay(Date.parse('2026-12-01T23:30:00Z'))).toBe('2026-12-02');
    expect(warsawDay(Date.parse('2026-12-01T22:30:00Z'))).toBe('2026-12-01');
  });

  it('formats the hour as HH:00', () => {
    expect(warsawHour(Date.parse('2026-10-01T15:42:00Z'))).toBe('17:00');
  });
});

describe('warsawLocalToMs', () => {
  it('converts summer and winter local times', () => {
    expect(warsawLocalToMs('2026-10-01 17:20:21')).toBe(Date.parse('2026-10-01T15:20:21Z'));
    expect(warsawLocalToMs('2026-12-01 17:00:00')).toBe(Date.parse('2026-12-01T16:00:00Z'));
  });

  it('survives the repeated hour when clocks go back', () => {
    const ms = warsawLocalToMs('2026-10-25 02:30:00');
    expect(ms).not.toBeNull();
    // Either reading of the ambiguous hour is acceptable; nothing further off.
    expect([Date.parse('2026-10-25T00:30:00Z'), Date.parse('2026-10-25T01:30:00Z')]).toContain(ms);
  });

  it('is null for garbage', () => {
    expect(warsawLocalToMs('yesterday')).toBeNull();
    expect(warsawLocalToMs('')).toBeNull();
  });
});

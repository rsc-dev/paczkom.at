import { describe, expect, it } from 'vitest';
import { PENALTY, applyPoints, servicePoints } from './score.js';

describe('servicePoints', () => {
  it('awards 200 for an instant service', () => {
    expect(servicePoints(0, 20_000)).toBe(200);
  });

  it('awards 100 at the patience limit', () => {
    expect(servicePoints(20_000, 20_000)).toBe(100);
  });

  it('interpolates linearly in between', () => {
    expect(servicePoints(10_000, 20_000)).toBe(150);
    expect(servicePoints(5_000, 20_000)).toBe(175);
  });

  it('never drops below 100 even past the limit', () => {
    expect(servicePoints(60_000, 20_000)).toBe(100);
  });

  it('never exceeds 200 for a negative wait', () => {
    expect(servicePoints(-5_000, 20_000)).toBe(200);
  });

  it('degrades gracefully for a zero patience profile', () => {
    expect(servicePoints(0, 0)).toBe(100);
  });
});

describe('applyPoints', () => {
  it('adds points', () => {
    expect(applyPoints(100, 200)).toBe(300);
  });

  it('floors the running score at zero', () => {
    expect(applyPoints(20, -PENALTY.wrongTap)).toBe(0);
    expect(applyPoints(0, -PENALTY.refusedSender)).toBe(0);
  });
});

describe('PENALTY', () => {
  it('matches the design table', () => {
    expect(PENALTY).toEqual({
      wrongTap: 25,
      refusedSender: 100,
      walkedPickup: 50,
      unplacedParcel: 50,
    });
  });
});

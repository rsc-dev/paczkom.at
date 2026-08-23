import { describe, expect, it } from 'vitest';
import {
  LAUNCH_EPOCH,
  addDays,
  computeBest,
  computeStreak,
  dailyNumber,
  dailySeed,
  recordRun,
  utcDateString,
} from './daily.js';
import type { DailyRecords, DailyResult } from './daily.js';
import { fnv1a } from './rng.js';

const result = (score: number): DailyResult => ({ score, timeMs: 90_000, grid: ['📦'] });

const recordsFor = (dates: readonly string[]): DailyRecords =>
  Object.fromEntries(dates.map((date, index) => [date, { result: result(100 + index), practices: 0 }]));

describe('utcDateString', () => {
  it('formats a date as YYYY-MM-DD in UTC', () => {
    expect(utcDateString(new Date(Date.UTC(2026, 8, 14, 23, 59)))).toBe('2026-09-14');
    expect(utcDateString(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01');
  });

  it('uses UTC rather than the local day', () => {
    expect(utcDateString(new Date(Date.UTC(2026, 8, 15, 0, 30)))).toBe('2026-09-15');
  });
});

describe('dailySeed', () => {
  it('is the FNV-1a hash of the UTC date and is stable', () => {
    expect(dailySeed('2026-09-14')).toBe(dailySeed('2026-09-14'));
    expect(dailySeed('2026-09-14')).toBe(fnv1a('2026-09-14'));
  });

  it('differs between days', () => {
    expect(dailySeed('2026-09-14')).not.toBe(dailySeed('2026-09-15'));
  });

  it('rejects a malformed date', () => {
    expect(() => dailySeed('14-09-2026')).toThrow();
    expect(() => dailySeed('2026-13-01')).toThrow();
  });
});

describe('addDays', () => {
  it('moves forwards and backwards across month and year ends', () => {
    expect(addDays('2026-09-14', 1)).toBe('2026-09-15');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('dailyNumber', () => {
  it('is 1 on the epoch', () => {
    expect(dailyNumber(LAUNCH_EPOCH)).toBe(1);
  });

  it('counts days since the epoch', () => {
    expect(dailyNumber(addDays(LAUNCH_EPOCH, 11))).toBe(12);
  });

  it('accepts an explicit epoch', () => {
    expect(dailyNumber('2026-09-05', '2026-09-01')).toBe(5);
  });

  it('never goes below 1 before the epoch', () => {
    expect(dailyNumber(addDays(LAUNCH_EPOCH, -3))).toBe(1);
  });
});

describe('recordRun', () => {
  it('stores the first completed run of a date as its result', () => {
    const { records, isPractice } = recordRun({}, '2026-09-14', result(1200));
    expect(isPractice).toBe(false);
    expect(records['2026-09-14']?.result?.score).toBe(1200);
    expect(records['2026-09-14']?.practices).toBe(0);
  });

  it('treats later runs as practice without touching the result', () => {
    const first = recordRun({}, '2026-09-14', result(1200)).records;
    const second = recordRun(first, '2026-09-14', result(9999));
    expect(second.isPractice).toBe(true);
    expect(second.records['2026-09-14']?.result?.score).toBe(1200);
    expect(second.records['2026-09-14']?.practices).toBe(1);
    const third = recordRun(second.records, '2026-09-14', result(1));
    expect(third.records['2026-09-14']?.practices).toBe(2);
    expect(third.records['2026-09-14']?.result?.score).toBe(1200);
  });

  it('leaves other dates alone', () => {
    const before = recordsFor(['2026-09-13']);
    const after = recordRun(before, '2026-09-14', result(500)).records;
    expect(after['2026-09-13']).toEqual(before['2026-09-13']);
  });
});

describe('computeStreak', () => {
  it('counts the run of consecutive dates ending today', () => {
    const records = recordsFor(['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
    expect(computeStreak(records, '2026-09-14')).toBe(4);
  });

  it('still counts a streak that ends yesterday', () => {
    const records = recordsFor(['2026-09-12', '2026-09-13']);
    expect(computeStreak(records, '2026-09-14')).toBe(2);
  });

  it('is 1 when the previous result is older than yesterday', () => {
    const records = recordRun(recordsFor(['2026-09-11']), '2026-09-14', result(10)).records;
    expect(computeStreak(records, '2026-09-14')).toBe(1);
  });

  it('is 0 with no results at all', () => {
    expect(computeStreak({}, '2026-09-14')).toBe(0);
  });

  it('is 0 when the last result is older than yesterday and today is unplayed', () => {
    expect(computeStreak(recordsFor(['2026-09-11']), '2026-09-14')).toBe(0);
  });

  it('ignores dates that only have practice runs', () => {
    const records: DailyRecords = { '2026-09-14': { practices: 3 } };
    expect(computeStreak(records, '2026-09-14')).toBe(0);
  });
});

describe('computeBest', () => {
  it('is the highest stored result score', () => {
    const records = recordsFor(['2026-09-11', '2026-09-12', '2026-09-13']);
    expect(computeBest(records)).toBe(102);
  });

  it('is 0 when nothing has been completed', () => {
    expect(computeBest({})).toBe(0);
    expect(computeBest({ '2026-09-14': { practices: 2 } })).toBe(0);
  });
});

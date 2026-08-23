import { describe, expect, it } from 'vitest';
import { decodeAction, decodeLog, encodeAction, encodeLog } from './actionLog.js';
import type { Action } from './game.js';

const SAMPLE: Action[] = [
  { type: 'start' },
  { type: 'tick', dtMs: 250 },
  { type: 'tick', dtMs: 250 },
  { type: 'tick', dtMs: 250 },
  { type: 'tapSlot', slotId: 'c1r4' },
  { type: 'selectCustomer', customerId: 'k7' },
  { type: 'continue' },
];

describe('encodeAction / decodeAction', () => {
  it.each(SAMPLE)('round-trips %j', (action) => {
    expect(decodeAction(encodeAction(action))).toEqual(action);
  });

  it('rejects a malformed token', () => {
    expect(() => decodeAction('nope')).toThrow();
    expect(() => decodeAction('tabc')).toThrow();
  });
});

describe('encodeLog / decodeLog', () => {
  it('collapses runs of identical actions', () => {
    expect(encodeLog(SAMPLE)).toEqual(['start', 't250*3', 's:c1r4', 'k:k7', 'continue']);
  });

  it('round-trips a whole log', () => {
    expect(decodeLog(encodeLog(SAMPLE))).toEqual(SAMPLE);
  });

  it('handles an empty log', () => {
    expect(encodeLog([])).toEqual([]);
    expect(decodeLog([])).toEqual([]);
  });

  it('rejects a malformed repeat count', () => {
    expect(() => decodeLog(['t250*0'])).toThrow();
    expect(() => decodeLog(['t250*x'])).toThrow();
  });
});

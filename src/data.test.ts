import { describe, expect, it } from 'vitest';
import { fetchJson } from './data.js';

const isNumberList = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number');
const respond = (body: unknown, ok = true): typeof fetch =>
  () => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe('fetchJson', () => {
  it('returns data that passes the guard', async () => {
    expect(await fetchJson('/x', isNumberList, respond([1, 2]))).toEqual([1, 2]);
  });

  it('returns null on HTTP errors, bad shapes and network failures', async () => {
    expect(await fetchJson('/x', isNumberList, respond([1], false))).toBeNull();
    expect(await fetchJson('/x', isNumberList, respond(['a']))).toBeNull();
    const broken = (() => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await fetchJson('/x', isNumberList, broken)).toBeNull();
  });
});

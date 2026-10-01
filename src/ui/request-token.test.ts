import { describe, expect, it } from 'vitest';
import { createRequestToken } from './request-token.js';

describe('createRequestToken', () => {
  it('is current only for the most recently issued token', () => {
    const requests = createRequestToken();
    const first = requests.next();
    expect(requests.isCurrent(first)).toBe(true);
    const second = requests.next();
    expect(requests.isCurrent(first)).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);
  });

  it('keeps later tokens current even if an earlier one resolves after it', () => {
    const requests = createRequestToken();
    const first = requests.next();
    const second = requests.next();
    // Out-of-order resolution: `first`'s response arrives after `second`'s.
    expect(requests.isCurrent(second)).toBe(true);
    expect(requests.isCurrent(first)).toBe(false);
  });
});

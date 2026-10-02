/**
 * A monotonic token for dropping stale async responses. Call `next()` when a
 * request starts; when it resolves, `isCurrent(token)` is true only if no
 * newer request has started in the meantime — so a slow response never
 * overwrites what a faster, later one already painted.
 */
export interface RequestToken {
  next(): number;
  isCurrent(token: number): boolean;
}

export function createRequestToken(): RequestToken {
  let latest = 0;
  return {
    next: () => ++latest,
    isCurrent: (token) => token === latest,
  };
}

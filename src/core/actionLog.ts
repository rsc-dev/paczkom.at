/**
 * A compact text encoding for action logs.
 *
 * A day is reproducible from `seed + action log`, so the logs are worth storing
 * as fixtures. Run-length encoding keeps the long stretches of identical ticks
 * from drowning out the interesting taps.
 */
import type { Action } from './game.js';

const REPEAT = '*';

export function encodeAction(action: Action): string {
  switch (action.type) {
    case 'start':
      return 'start';
    case 'continue':
      return 'continue';
    case 'tick':
      return `t${String(action.dtMs)}`;
    case 'tapSlot':
      return `s:${action.slotId}`;
    case 'selectCustomer':
      return `k:${action.customerId}`;
    default:
      throw new Error('cannot encode an unknown action');
  }
}

export function decodeAction(token: string): Action {
  if (token === 'start') {
    return { type: 'start' };
  }
  if (token === 'continue') {
    return { type: 'continue' };
  }
  if (token.startsWith('t')) {
    const dtMs = Number(token.slice(1));
    if (!Number.isFinite(dtMs)) {
      throw new Error(`malformed tick token "${token}"`);
    }
    return { type: 'tick', dtMs };
  }
  if (token.startsWith('s:')) {
    return { type: 'tapSlot', slotId: token.slice(2) };
  }
  if (token.startsWith('k:')) {
    return { type: 'selectCustomer', customerId: token.slice(2) };
  }
  throw new Error(`malformed action token "${token}"`);
}

/** Actions as tokens, with runs of identical tokens collapsed to `token*n`. */
export function encodeLog(actions: readonly Action[]): string[] {
  const tokens: string[] = [];
  let run: { token: string; count: number } | null = null;
  const flush = (): void => {
    if (run !== null) {
      tokens.push(run.count > 1 ? `${run.token}${REPEAT}${String(run.count)}` : run.token);
      run = null;
    }
  };
  for (const action of actions) {
    const token = encodeAction(action);
    if (run !== null && run.token === token) {
      run = { token, count: run.count + 1 };
      continue;
    }
    flush();
    run = { token, count: 1 };
  }
  flush();
  return tokens;
}

export function decodeLog(tokens: readonly string[]): Action[] {
  return tokens.flatMap((token) => {
    const at = token.lastIndexOf(REPEAT);
    if (at < 0) {
      return [decodeAction(token)];
    }
    const count = Number(token.slice(at + 1));
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`malformed repeat token "${token}"`);
    }
    const action = decodeAction(token.slice(0, at));
    return Array.from({ length: count }, () => action);
  });
}

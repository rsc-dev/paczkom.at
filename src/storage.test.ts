import { describe, expect, it } from 'vitest';
import { STORAGE_PREFIX, createStorage } from './storage.js';
import type { StorageBackend } from './storage.js';

function memoryBackend(seed: Record<string, string> = {}): StorageBackend & {
  readonly data: Map<string, string>;
} {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const throwingBackend = (): StorageBackend => ({
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
});

describe('createStorage', () => {
  it('round-trips JSON values under the versioned prefix', () => {
    const backend = memoryBackend();
    const storage = createStorage(backend);
    storage.set('lang', 'en');
    storage.set('mute', true);
    storage.set('prefs', { '2026-09-14': { visits: 1 } });

    expect(storage.get<string>('lang')).toBe('en');
    expect(storage.get<boolean>('mute')).toBe(true);
    expect(storage.get<Record<string, unknown>>('prefs')).toEqual({
      '2026-09-14': { visits: 1 },
    });
    expect([...backend.data.keys()]).toEqual([
      `${STORAGE_PREFIX}lang`,
      `${STORAGE_PREFIX}mute`,
      `${STORAGE_PREFIX}prefs`,
    ]);
  });

  it('survives a page reload, which is just a second wrapper over the same backend', () => {
    const backend = memoryBackend();
    createStorage(backend).set('lang', 'en');
    expect(createStorage(backend).get<string>('lang')).toBe('en');
  });

  it('returns undefined for a missing key', () => {
    expect(createStorage(memoryBackend()).get('nope')).toBeUndefined();
  });

  it('treats a corrupt value as absent', () => {
    const storage = createStorage(memoryBackend({ [`${STORAGE_PREFIX}prefs`]: '{not json' }));
    expect(storage.get('prefs')).toBeUndefined();
  });

  it('removes a key', () => {
    const backend = memoryBackend();
    const storage = createStorage(backend);
    storage.set('lang', 'pl');
    storage.remove('lang');
    expect(storage.get('lang')).toBeUndefined();
    expect(backend.data.size).toBe(0);
  });

  it('reports whether it is persistent', () => {
    expect(createStorage(memoryBackend()).persistent).toBe(true);
    expect(createStorage(null).persistent).toBe(false);
  });
});

describe('storage fallback', () => {
  it('keeps working in memory when the backend throws', () => {
    const storage = createStorage(throwingBackend());
    expect(() => {
      storage.set('lang', 'en');
    }).not.toThrow();
    expect(storage.get<string>('lang')).toBe('en');
    expect(storage.persistent).toBe(false);
  });

  it('falls back mid-session when writes start to throw', () => {
    let failing = false;
    const backend = memoryBackend();
    const flaky: StorageBackend = {
      getItem: (key) => backend.getItem(key),
      setItem: (key, value) => {
        if (failing) {
          throw new Error('QuotaExceededError');
        }
        backend.setItem(key, value);
      },
      removeItem: (key) => {
        backend.removeItem(key);
      },
    };
    const storage = createStorage(flaky);
    storage.set('lang', 'pl');
    failing = true;
    storage.set('mute', true);

    expect(storage.persistent).toBe(false);
    expect(storage.get<boolean>('mute')).toBe(true);
    expect(storage.get<string>('lang')).toBe('pl');
  });

  it('works with no backend at all', () => {
    const storage = createStorage(null);
    storage.set('best', 1200);
    expect(storage.get<number>('best')).toBe(1200);
  });
});

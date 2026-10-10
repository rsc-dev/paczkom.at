/**
 * Persistence (design D12).
 *
 * `localStorage` is best-effort: private-mode browsers throw on access, on
 * write, or both. Every value written this session is also kept in memory, so
 * a browser that refuses to store anything still works — it just forgets the
 * town when the tab closes.
 */

export const STORAGE_PREFIX = 'pk:v1:';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Storage {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  /** False once the backend has refused a read or a write. */
  readonly persistent: boolean;
}

/** `localStorage` if the browser will hand it over, otherwise nothing. */
export function defaultBackend(): StorageBackend | null {
  try {
    const candidate = globalThis.localStorage as StorageBackend | undefined;
    return candidate ?? null;
  } catch {
    return null;
  }
}

export function createStorage(backend: StorageBackend | null = defaultBackend()): Storage {
  const memory = new Map<string, string>();
  let healthy = backend !== null;

  const namespaced = (key: string): string => `${STORAGE_PREFIX}${key}`;

  const readRaw = (key: string): string | null => {
    const cached = memory.get(namespaced(key));
    if (cached !== undefined) {
      return cached;
    }
    if (backend === null) {
      return null;
    }
    try {
      return backend.getItem(namespaced(key));
    } catch {
      healthy = false;
      return null;
    }
  };

  return {
    get<T>(key: string): T | undefined {
      const raw = readRaw(key);
      if (raw === null) {
        return undefined;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        // A value we cannot parse is a value we never stored.
        return undefined;
      }
    },

    set(key: string, value: unknown): void {
      let encoded: string;
      try {
        encoded = JSON.stringify(value);
      } catch {
        return;
      }
      memory.set(namespaced(key), encoded);
      if (backend === null) {
        return;
      }
      try {
        backend.setItem(namespaced(key), encoded);
      } catch {
        healthy = false;
      }
    },

    remove(key: string): void {
      memory.delete(namespaced(key));
      if (backend === null) {
        return;
      }
      try {
        backend.removeItem(namespaced(key));
      } catch {
        healthy = false;
      }
    },

    get persistent(): boolean {
      return healthy;
    },
  };
}

/** The instance the app uses. */
export const storage: Storage = createStorage();

/** Keys the site persists: language, sound and the records per game. */
export const STORAGE_KEYS = {
  lang: 'lang',
  mute: 'mute',
  records: 'records',
} as const;

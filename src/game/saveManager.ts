/** Persistent run meta for Mallow (localStorage). Does not touch combat feel or moves. */

export const SAVE_KEY = "mallow-ashen-vow-v1";
export const SAVE_SCHEMA = 1 as const;

export type SaveData = {
  /** Schema version for future migrations. */
  v: typeof SAVE_SCHEMA;
  deaths: number;
  /** Forged HP cap; clamped 100–180 on load. */
  hpMax: number;
  bestMs: number | null;
  clears: number;
};

export type SaveStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const HP_MIN = 100;
const HP_MAX = 180;

export function defaultSave(): SaveData {
  return {
    v: SAVE_SCHEMA,
    deaths: 0,
    hpMax: HP_MIN,
    bestMs: null,
    clears: 0,
  };
}

export function clampHpMax(n: number): number {
  if (!Number.isFinite(n)) return HP_MIN;
  return Math.min(HP_MAX, Math.max(HP_MIN, Math.round(n)));
}

/** Normalize raw JSON (legacy without `v` still accepted). */
export function parseSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base = defaultSave();
  if (typeof o.deaths === "number" && Number.isFinite(o.deaths) && o.deaths >= 0) {
    base.deaths = Math.floor(o.deaths);
  }
  if (typeof o.hpMax === "number") {
    base.hpMax = clampHpMax(o.hpMax);
  }
  if (typeof o.bestMs === "number" && Number.isFinite(o.bestMs) && o.bestMs > 0) {
    base.bestMs = o.bestMs;
  } else if (o.bestMs === null) {
    base.bestMs = null;
  }
  if (typeof o.clears === "number" && Number.isFinite(o.clears) && o.clears >= 0) {
    base.clears = Math.floor(o.clears);
  }
  base.v = SAVE_SCHEMA;
  return base;
}

function browserStore(): SaveStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export type SaveManager = {
  load: () => SaveData;
  write: (data: SaveData) => boolean;
  clear: () => void;
  /** Merge patch onto current loaded snapshot and persist. */
  patch: (partial: Partial<Omit<SaveData, "v">>) => SaveData;
  snapshot: () => SaveData;
};

export type SaveManagerOptions = {
  store?: SaveStore | null;
  key?: string;
};

export function createSaveManager(opts: SaveManagerOptions = {}): SaveManager {
  const store = opts.store === undefined ? browserStore() : opts.store;
  const key = opts.key ?? SAVE_KEY;
  let cached = defaultSave();

  function load(): SaveData {
    if (!store) {
      cached = defaultSave();
      return { ...cached };
    }
    try {
      const raw = store.getItem(key);
      if (!raw) {
        cached = defaultSave();
        return { ...cached };
      }
      const parsed = parseSave(JSON.parse(raw));
      cached = parsed ?? defaultSave();
      return { ...cached };
    } catch {
      cached = defaultSave();
      return { ...cached };
    }
  }

  function write(data: SaveData): boolean {
    const next: SaveData = {
      v: SAVE_SCHEMA,
      deaths: Math.max(0, Math.floor(data.deaths)),
      hpMax: clampHpMax(data.hpMax),
      bestMs: data.bestMs != null && data.bestMs > 0 ? data.bestMs : null,
      clears: Math.max(0, Math.floor(data.clears)),
    };
    cached = next;
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function clear(): void {
    cached = defaultSave();
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      /* private mode */
    }
  }

  function patch(partial: Partial<Omit<SaveData, "v">>): SaveData {
    const next = { ...cached, ...partial, v: SAVE_SCHEMA as typeof SAVE_SCHEMA };
    write(next);
    return { ...cached };
  }

  function snapshot(): SaveData {
    return { ...cached };
  }

  load();
  return { load, write, clear, patch, snapshot };
}

/** Thin typed bus for combat feel FX — emit only; does not change feel numbers. */

export type CombatFeelKind =
  | "hit"
  | "heavy"
  | "stance-break"
  | "stamina"
  | "hurt"
  | "block";

export type CombatFeelEvent = {
  kind: CombatFeelKind;
  /** performance.now() when emitted */
  t: number;
  amount?: number;
  foeId?: number;
  foeKind?: string;
  heavy?: boolean;
};

export type CombatFeelListener = (ev: CombatFeelEvent) => void;

export type CombatFeelCounts = Record<CombatFeelKind, number>;

export function emptyFeelCounts(): CombatFeelCounts {
  return {
    hit: 0,
    heavy: 0,
    "stance-break": 0,
    stamina: 0,
    hurt: 0,
    block: 0,
  };
}

export function tallyFeel(events: readonly CombatFeelEvent[]): CombatFeelCounts {
  const c = emptyFeelCounts();
  for (const e of events) c[e.kind] += 1;
  return c;
}

const RECENT_CAP = 256;

export type CombatFeelBus = {
  emit: (partial: Omit<CombatFeelEvent, "t"> & { t?: number }) => CombatFeelEvent;
  on: (fn: CombatFeelListener) => () => void;
  off: (fn: CombatFeelListener) => void;
  clear: () => void;
  recent: () => CombatFeelEvent[];
  counts: () => CombatFeelCounts;
};

export function createCombatFeelBus(): CombatFeelBus {
  const listeners = new Set<CombatFeelListener>();
  const buffer: CombatFeelEvent[] = [];

  function emit(partial: Omit<CombatFeelEvent, "t"> & { t?: number }): CombatFeelEvent {
    const ev: CombatFeelEvent = {
      ...partial,
      t: partial.t ?? performance.now(),
    };
    buffer.push(ev);
    if (buffer.length > RECENT_CAP) buffer.splice(0, buffer.length - RECENT_CAP);
    for (const fn of listeners) {
      try {
        fn(ev);
      } catch {
        /* harness listeners must not break combat */
      }
    }
    return ev;
  }

  return {
    emit,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    off(fn) {
      listeners.delete(fn);
    },
    clear() {
      buffer.length = 0;
    },
    recent() {
      return buffer.slice();
    },
    counts() {
      return tallyFeel(buffer);
    },
  };
}

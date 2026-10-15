import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SAVE_KEY,
  SAVE_SCHEMA,
  clampHpMax,
  createSaveManager,
  defaultSave,
  parseSave,
  type SaveStore,
} from "./saveManager.ts";

function memoryStore(seed?: Record<string, string>): SaveStore & { data: Record<string, string> } {
  const data = { ...(seed ?? {}) };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe("parseSave", () => {
  it("accepts legacy payloads without v", () => {
    const s = parseSave({ deaths: 3, hpMax: 124, bestMs: 90000, clears: 1 });
    assert.ok(s);
    assert.equal(s!.v, SAVE_SCHEMA);
    assert.equal(s!.deaths, 3);
    assert.equal(s!.hpMax, 124);
    assert.equal(s!.bestMs, 90000);
    assert.equal(s!.clears, 1);
  });

  it("clamps hpMax and floors counts", () => {
    const s = parseSave({ deaths: 2.9, hpMax: 999, clears: -1 });
    assert.ok(s);
    assert.equal(s!.deaths, 2);
    assert.equal(s!.hpMax, 180);
    assert.equal(s!.clears, 0);
  });

  it("rejects junk", () => {
    assert.equal(parseSave(null), null);
    assert.equal(parseSave("x"), null);
  });
});

describe("clampHpMax", () => {
  it("bounds 100–180", () => {
    assert.equal(clampHpMax(50), 100);
    assert.equal(clampHpMax(112.4), 112);
    assert.equal(clampHpMax(200), 180);
  });
});

describe("createSaveManager", () => {
  it("loads defaults when empty", () => {
    const store = memoryStore();
    const sm = createSaveManager({ store });
    assert.deepEqual(sm.snapshot(), defaultSave());
  });

  it("round-trips write/load", () => {
    const store = memoryStore();
    const sm = createSaveManager({ store });
    sm.write({ v: SAVE_SCHEMA, deaths: 5, hpMax: 136, bestMs: 42000, clears: 2 });
    const again = createSaveManager({ store });
    assert.equal(again.snapshot().deaths, 5);
    assert.equal(again.snapshot().hpMax, 136);
    assert.equal(again.snapshot().bestMs, 42000);
    assert.equal(again.snapshot().clears, 2);
    assert.ok(store.data[SAVE_KEY]);
  });

  it("patch merges and persists", () => {
    const store = memoryStore();
    const sm = createSaveManager({ store });
    sm.patch({ deaths: 1 });
    sm.patch({ clears: 2, hpMax: 148 });
    assert.equal(sm.snapshot().deaths, 1);
    assert.equal(sm.snapshot().clears, 2);
    assert.equal(sm.snapshot().hpMax, 148);
  });

  it("clear removes key", () => {
    const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ deaths: 9, hpMax: 100 }) });
    const sm = createSaveManager({ store });
    assert.equal(sm.snapshot().deaths, 9);
    sm.clear();
    assert.deepEqual(sm.snapshot(), defaultSave());
    assert.equal(store.data[SAVE_KEY], undefined);
  });

  it("survives private-mode store that throws", () => {
    const store: SaveStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const sm = createSaveManager({ store });
    assert.deepEqual(sm.snapshot(), defaultSave());
    assert.equal(sm.write(defaultSave()), false);
  });
});

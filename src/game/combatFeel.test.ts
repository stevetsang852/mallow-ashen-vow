import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCombatFeelBus,
  emptyFeelCounts,
  tallyFeel,
} from "./combatFeel.ts";
import {
  createHarnessSession,
  decideAutoThink,
} from "./autoHarness.ts";

describe("combatFeel bus", () => {
  it("emits typed events and tallies kinds", () => {
    const bus = createCombatFeelBus();
    const seen: string[] = [];
    bus.on((ev) => seen.push(ev.kind));
    bus.emit({ kind: "hit", amount: 18, foeId: 1 });
    bus.emit({ kind: "heavy", amount: 36, foeId: 1, heavy: true });
    bus.emit({ kind: "block", amount: 24, foeId: 2 });
    bus.emit({ kind: "deflect", amount: 24, foeId: 2 });
    bus.emit({ kind: "stance-break", foeId: 1 });
    bus.emit({ kind: "stamina", amount: 12 });
    bus.emit({ kind: "hurt", amount: 28 });
    assert.deepEqual(seen, [
      "hit",
      "heavy",
      "block",
      "deflect",
      "stance-break",
      "stamina",
      "hurt",
    ]);
    const c = bus.counts();
    assert.equal(c.hit, 1);
    assert.equal(c.heavy, 1);
    assert.equal(c.block, 1);
    assert.equal(c.deflect, 1);
    assert.equal(c["stance-break"], 1);
    assert.equal(c.stamina, 1);
    assert.equal(c.hurt, 1);
    assert.deepEqual(tallyFeel(bus.recent()), c);
  });

  it("does not change emptyFeelCounts baseline", () => {
    assert.deepEqual(emptyFeelCounts(), {
      hit: 0,
      heavy: 0,
      "stance-break": 0,
      stamina: 0,
      hurt: 0,
      block: 0,
      deflect: 0,
    });
  });
});

describe("decideAutoThink", () => {
  it("starts from title and rematches after win/loss", () => {
    assert.equal(
      decideAutoThink(
        {
          phase: "title",
          menuOpen: false,
          autoCd: 0,
          camYaw: 0,
          lockId: null,
          gateOpen: false,
          player: { x: 0, z: 0, hp: 100, flasks: 4, act: "free" },
          foes: [],
        },
        0.016,
      ).type,
      "begin",
    );
    assert.equal(
      decideAutoThink(
        {
          phase: "dead",
          menuOpen: false,
          autoCd: 0,
          camYaw: 0,
          lockId: null,
          gateOpen: true,
          player: { x: 0, z: 0, hp: 0, flasks: 0, act: "free" },
          foes: [],
        },
        0.016,
      ).type,
      "rise",
    );
    assert.equal(
      decideAutoThink(
        {
          phase: "win",
          menuOpen: false,
          autoCd: 0,
          camYaw: 0,
          lockId: null,
          gateOpen: true,
          player: { x: 0, z: 0, hp: 50, flasks: 1, act: "free" },
          foes: [],
        },
        0.016,
      ).type,
      "again",
    );
  });

  it("punishes recover with a light attack", () => {
    const action = decideAutoThink(
      {
        phase: "play",
        menuOpen: false,
        autoCd: 0,
        camYaw: 0,
        lockId: null,
        gateOpen: false,
        player: { x: 0, z: 0, hp: 80, flasks: 2, act: "free" },
        foes: [
          {
            id: 3,
            x: 0,
            z: -1.5,
            kind: "hollow",
            state: "recover",
            stagger: 0,
          },
        ],
      },
      0.016,
    );
    assert.equal(action.type, "attack");
    if (action.type === "attack") assert.equal(action.heavy, false);
  });
});

describe("harness session", () => {
  it("records win/loss and feel per run", () => {
    const h = createHarnessSession();
    h.setEnabled(true);
    h.noteFeel({ kind: "hit", t: 1, amount: 18 });
    h.noteFeel({ kind: "hurt", t: 2, amount: 20 });
    h.onPhase("dead");
    h.noteFeel({ kind: "heavy", t: 3, amount: 36 });
    h.onPhase("win");
    const s = h.summary();
    assert.equal(s.wins, 1);
    assert.equal(s.losses, 1);
    assert.equal(s.runs, 2);
    assert.equal(s.feelTotals.hit, 1);
    assert.equal(s.feelTotals.hurt, 1);
    assert.equal(s.feelTotals.heavy, 1);
  });
});

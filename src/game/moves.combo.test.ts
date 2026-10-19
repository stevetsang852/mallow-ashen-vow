import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIGHT_COMBO_DMGS,
  LIGHT_COMBO_MAX,
  MOVE,
  afterLightHitEnd,
  beginLightComboHit,
  breakLightCombo,
  canStartLightCombo,
  createLightComboState,
  finishLightComboHit,
  lightComboDamage,
  nextLightHitIndex,
  tickLightCombo,
} from "./moves.ts";

describe("lightComboDamage", () => {
  it("steps 20 → 25 → 35 and clamps", () => {
    assert.deepEqual([...LIGHT_COMBO_DMGS], [20, 25, 35]);
    assert.equal(LIGHT_COMBO_MAX, 3);
    assert.equal(lightComboDamage(0), 20);
    assert.equal(lightComboDamage(1), 25);
    assert.equal(lightComboDamage(2), 35);
    assert.equal(lightComboDamage(-1), 20);
    assert.equal(lightComboDamage(99), 35);
    assert.equal(MOVE.lightDmg, LIGHT_COMBO_DMGS[0]);
  });
});

describe("nextLightHitIndex / afterLightHitEnd", () => {
  it("starts at 0 outside window", () => {
    assert.equal(nextLightHitIndex(0, false), 0);
    assert.equal(nextLightHitIndex(2, false), 0);
    assert.equal(nextLightHitIndex(1, true), 1);
    assert.equal(nextLightHitIndex(2, true), 2);
    assert.equal(nextLightHitIndex(3, true), 0);
  });

  it("opens window after hit 1/2 and recover after hit 3", () => {
    const a = afterLightHitEnd(0);
    assert.equal(a.kind, "window");
    assert.equal(a.completedHits, 1);
    assert.equal(a.duration, MOVE.lightComboWindow);
    assert.equal(a.duration, 0.8);

    const b = afterLightHitEnd(1);
    assert.equal(b.kind, "window");
    assert.equal(b.completedHits, 2);

    const c = afterLightHitEnd(2);
    assert.equal(c.kind, "recover");
    assert.equal(c.completedHits, 0);
    assert.equal(c.duration, MOVE.lightComboRecover);
  });
});

describe("light combo state machine", () => {
  it("chains three hits then recovers", () => {
    let s = createLightComboState();
    assert.equal(canStartLightCombo(s), true);

    let hit = beginLightComboHit(s);
    assert.equal(hit.hitIndex, 0);
    assert.equal(lightComboDamage(hit.hitIndex), 20);
    s = finishLightComboHit(hit.state);
    assert.equal(s.phase, "window");
    assert.equal(s.completedHits, 1);
    assert.ok(s.timer > 0.79);

    hit = beginLightComboHit(s);
    assert.equal(hit.hitIndex, 1);
    assert.equal(lightComboDamage(hit.hitIndex), 25);
    s = finishLightComboHit(hit.state);
    assert.equal(s.phase, "window");
    assert.equal(s.completedHits, 2);

    hit = beginLightComboHit(s);
    assert.equal(hit.hitIndex, 2);
    assert.equal(lightComboDamage(hit.hitIndex), 35);
    s = finishLightComboHit(hit.state);
    assert.equal(s.phase, "recover");
    assert.equal(canStartLightCombo(s), false);

    s = tickLightCombo(s, MOVE.lightComboRecover + 0.01);
    assert.equal(s.phase, "idle");
    assert.equal(canStartLightCombo(s), true);
  });

  it("window expiry triggers short recovery", () => {
    let s = createLightComboState();
    const hit = beginLightComboHit(s);
    s = finishLightComboHit(hit.state);
    assert.equal(s.phase, "window");

    s = tickLightCombo(s, 0.4);
    assert.equal(s.phase, "window");
    assert.ok(s.timer < 0.41);

    s = tickLightCombo(s, 0.5);
    assert.equal(s.phase, "recover");
    assert.equal(s.completedHits, 0);
    assert.equal(canStartLightCombo(s), false);
    assert.ok(Math.abs(s.timer - MOVE.lightComboRecover) < 1e-9);

    s = tickLightCombo(s, MOVE.lightComboRecover);
    assert.equal(s.phase, "idle");
  });

  it("break clears chain; restart is hit 0", () => {
    let s = createLightComboState();
    s = finishLightComboHit(beginLightComboHit(s).state);
    assert.equal(s.phase, "window");
    s = breakLightCombo(s);
    assert.equal(s.phase, "idle");
    assert.equal(beginLightComboHit(s).hitIndex, 0);
  });

  it("cannot start light during recover", () => {
    let s = createLightComboState();
    // finish three hits
    for (let i = 0; i < 3; i++) {
      const hit = beginLightComboHit(s);
      s = finishLightComboHit(hit.state);
    }
    assert.equal(s.phase, "recover");
    assert.equal(canStartLightCombo(s), false);
  });
});

describe("light swing timings (0.8.29 recover trim)", () => {
  it("keeps open/shut; lightEnd is 0.46", () => {
    assert.equal(MOVE.lightOpen, 0.12);
    assert.equal(MOVE.lightShut, 0.3);
    assert.equal(MOVE.lightEnd, 0.46);
    assert.ok(MOVE.lightEnd > MOVE.lightShut);
    assert.ok(MOVE.lightShut > MOVE.lightOpen);
  });
});

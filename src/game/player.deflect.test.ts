import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFLECT,
  inDeflectWindow,
  resolveGuardHit,
} from "./player.ts";
import {
  FOE_SWING_HIT_AT,
  applyDeflectBounce,
  inFoeDeflectThreat,
  timeUntilFoeHit,
} from "./foes.ts";

describe("DEFLECT constants", () => {
  it("uses a 0.2s press-guard window", () => {
    assert.equal(DEFLECT.window, 0.2);
    assert.ok(DEFLECT.staCost < 16);
    assert.ok(DEFLECT.stagger > 0);
    assert.ok(DEFLECT.knockback > 0);
  });
});

describe("inDeflectWindow", () => {
  it("accepts blockAge at start and at window edge", () => {
    assert.equal(inDeflectWindow(0), true);
    assert.equal(inDeflectWindow(0.1), true);
    assert.equal(inDeflectWindow(0.2), true);
    assert.equal(inDeflectWindow(0.2000001), false);
    assert.equal(inDeflectWindow(0.35), false);
    assert.equal(inDeflectWindow(-0.01), false);
  });
});

describe("resolveGuardHit", () => {
  const base = {
    blocking: true,
    facingDot: 0.8,
    stamina: 50,
  };

  it("deflects when blockAge is inside the 0.2s window", () => {
    assert.equal(resolveGuardHit({ ...base, blockAge: 0 }), "deflect");
    assert.equal(resolveGuardHit({ ...base, blockAge: 0.15 }), "deflect");
    assert.equal(resolveGuardHit({ ...base, blockAge: 0.2 }), "deflect");
  });

  it("falls through to normal block past the window", () => {
    assert.equal(resolveGuardHit({ ...base, blockAge: 0.21 }), "block");
    assert.equal(resolveGuardHit({ ...base, blockAge: 1.0 }), "block");
  });

  it("whiffs when not blocking, low stamina, or wrong facing", () => {
    assert.equal(resolveGuardHit({ ...base, blocking: false, blockAge: 0.05 }), "whiff");
    assert.equal(resolveGuardHit({ ...base, blockAge: 0.05, stamina: 10 }), "whiff");
    assert.equal(resolveGuardHit({ ...base, blockAge: 0.05, facingDot: 0.05 }), "whiff");
    assert.equal(resolveGuardHit({ ...base, blockAge: 0.05, facingDot: -0.5 }), "whiff");
  });
});

describe("timeUntilFoeHit / inFoeDeflectThreat", () => {
  it("counts telegraph remaining plus swing hit delay", () => {
    // windup 1.0s, at t=0.85 → 0.15 left + 0.04 = 0.19 ≤ 0.2
    assert.ok(Math.abs((timeUntilFoeHit("telegraph", 0.85, 1.0, false) ?? -1) - 0.19) < 1e-9);
    assert.equal(inFoeDeflectThreat("telegraph", 0.85, 1.0, false), true);
    // early telegraph: 0.9 left + 0.04 = 0.94 > 0.2
    assert.equal(inFoeDeflectThreat("telegraph", 0.1, 1.0, false), false);
  });

  it("counts early swing frames before connect", () => {
    assert.equal(FOE_SWING_HIT_AT, 0.04);
    assert.ok(Math.abs((timeUntilFoeHit("swing", 0, 0.24, false) ?? -1) - 0.04) < 1e-9);
    assert.equal(inFoeDeflectThreat("swing", 0.02, 0.24, false), true);
    assert.equal(timeUntilFoeHit("swing", 0.1, 0.24, true), null);
    assert.equal(inFoeDeflectThreat("idle", 0, 0, false), false);
  });
});

describe("applyDeflectBounce", () => {
  it("knocks foe away, chips HP, and applies brief stagger", () => {
    const f = {
      x: 0,
      z: -2,
      hp: 50,
      poise: 0,
      state: "swing" as const,
      t: 0.1,
      stagger: 0,
      swung: false,
      span: 0.24,
      cd: 0,
    };
    applyDeflectBounce(f, 0, 0);
    assert.ok(f.z < -2, "knocked further away on -Z");
    assert.equal(f.hp, 50 - DEFLECT.chip);
    assert.equal(f.state, "hurt");
    assert.equal(f.stagger, DEFLECT.stagger);
    assert.equal(f.swung, true);
    assert.equal(f.t, 0);
  });
});

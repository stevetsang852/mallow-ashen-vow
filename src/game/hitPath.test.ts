import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HIT_SPARK_MUL } from "./particles.ts";
import { TORCH_DEMON_DAMAGE_MUL } from "./items.ts";
import {
  BREAK_POISE_DEFAULT_HIT,
  BREAK_POISE_HP_CHIP,
  CONNECT_FEEDBACK,
  POSTURE_ON_HIT,
  STANCE_BREAK_DMG_MUL,
  STANCE_BREAK_FEEDBACK,
  SWING_DOT_MIN,
  SWING_REACH_BASE,
  connectSwingFeedback,
  inSwingArc,
  isArmoredDuringSwing,
  postureOnHit,
  resolveBreakPoise,
  resolveSwingHitOnFoe,
  strikeCameraImpulse,
  swingReach,
} from "./hitPath.ts";

describe("hitPath feel lock (0.8.13)", () => {
  it("locks posture / reach / connect / stance-break numbers", () => {
    assert.equal(POSTURE_ON_HIT.light, 12);
    assert.equal(POSTURE_ON_HIT.heavy, 34);
    assert.equal(SWING_REACH_BASE.light, 1.8);
    assert.equal(SWING_REACH_BASE.heavy, 2.15);
    assert.equal(SWING_DOT_MIN.light, 0.16);
    assert.equal(SWING_DOT_MIN.heavy, 0.28);
    assert.equal(STANCE_BREAK_DMG_MUL, 1.5);
    assert.equal(BREAK_POISE_HP_CHIP, 16);
    assert.equal(BREAK_POISE_DEFAULT_HIT, 22);
    assert.equal(CONNECT_FEEDBACK.light.shake, 0.28);
    assert.equal(CONNECT_FEEDBACK.light.hitstop, 0.07);
    assert.equal(CONNECT_FEEDBACK.heavy.shake, 0.56);
    assert.equal(CONNECT_FEEDBACK.heavy.hitstop, 0.15);
    assert.equal(STANCE_BREAK_FEEDBACK.hitstop, 0.18);
    assert.equal(STANCE_BREAK_FEEDBACK.shake, 0.62);
    assert.equal(HIT_SPARK_MUL.light, 1);
    assert.equal(HIT_SPARK_MUL.heavy, 1.6);
    assert.equal(HIT_SPARK_MUL["stance-break"], 2.2);
  });
});

describe("inSwingArc / swingReach", () => {
  it("matches prior reach pad and dot gates", () => {
    assert.equal(swingReach(false, 0.5), 1.8 + 0.5 * 0.45);
    assert.equal(swingReach(true, 0.5), 2.15 + 0.5 * 0.45);
    assert.equal(
      inSwingArc({ heavy: false, dist: 1.5, dot: 0.2, foeRadius: 0.4 }),
      true,
    );
    assert.equal(
      inSwingArc({ heavy: false, dist: 1.5, dot: 0.1, foeRadius: 0.4 }),
      false,
    );
    assert.equal(
      inSwingArc({ heavy: true, dist: 2.0, dot: 0.3, foeRadius: 0.4 }),
      true,
    );
  });
});

describe("isArmoredDuringSwing", () => {
  it("preserves telegraph armour rules", () => {
    assert.equal(isArmoredDuringSwing({ foeState: "swing", foeKind: "hollow", heavy: true }), true);
    assert.equal(isArmoredDuringSwing({ foeState: "roar", foeKind: "demon", heavy: false }), true);
    assert.equal(isArmoredDuringSwing({ foeState: "telegraph", foeKind: "hollow", heavy: false }), true);
    assert.equal(isArmoredDuringSwing({ foeState: "telegraph", foeKind: "hollow", heavy: true }), false);
    assert.equal(isArmoredDuringSwing({ foeState: "telegraph", foeKind: "duke", heavy: true }), true);
    assert.equal(isArmoredDuringSwing({ foeState: "chase", foeKind: "hollow", heavy: true }), false);
  });
});

describe("resolveSwingHitOnFoe", () => {
  const baseFoe = {
    id: 1,
    kind: "hollow",
    state: "chase",
    poise: 0,
    poiseMax: 40,
    hp: 100,
    r: 0.45,
  };

  it("applies light hit without break", () => {
    const r = resolveSwingHitOnFoe({
      heavy: false,
      baseDmg: 20,
      torchHeld: false,
      foe: { ...baseFoe, poise: 0, poiseMax: 40 },
      dist: 1.2,
      dot: 0.5,
    });
    assert.equal(r.hit, true);
    if (!r.hit) return;
    assert.equal(r.posture, 12);
    assert.equal(r.broken, false);
    assert.equal(r.hitDmg, 20);
    assert.equal(r.appliedHpDamage, 20);
    assert.equal(r.nextHp, 80);
    assert.equal(r.nextPoise, 12);
    assert.equal(r.nextState, "hurt");
    assert.equal(r.sparkMul, HIT_SPARK_MUL.light);
    assert.equal(r.sparkKind, "steel");
    assert.equal(r.feelKind, "hit");
  });

  it("breaks poise with 1.5× damage and stance-break spark", () => {
    const r = resolveSwingHitOnFoe({
      heavy: true,
      baseDmg: 46,
      torchHeld: false,
      foe: { ...baseFoe, poise: 10, poiseMax: 40 },
      dist: 1.2,
      dot: 0.5,
    });
    assert.equal(r.hit, true);
    if (!r.hit) return;
    assert.equal(r.posture, 34);
    assert.equal(r.broken, true);
    assert.equal(r.appliedHpDamage, Math.round(46 * 1.5));
    assert.equal(r.nextPoise, 0);
    assert.equal(r.nextState, "hurt");
    assert.equal(r.nextStagger, 1.05);
    assert.equal(r.sparkMul, HIT_SPARK_MUL["stance-break"]);
    assert.equal(r.sparkKind, "pink");
    assert.equal(r.toastStanceBreak, true);
  });

  it("keeps armored telegraph state on light hit", () => {
    const r = resolveSwingHitOnFoe({
      heavy: false,
      baseDmg: 20,
      torchHeld: false,
      foe: { ...baseFoe, state: "telegraph", poise: 0, poiseMax: 100 },
      dist: 1.2,
      dot: 0.5,
    });
    assert.equal(r.hit, true);
    if (!r.hit) return;
    assert.equal(r.broken, false);
    assert.equal(r.nextState, "telegraph");
  });

  it("applies torch demon bonus without changing base table", () => {
    const r = resolveSwingHitOnFoe({
      heavy: false,
      baseDmg: 20,
      torchHeld: true,
      foe: { ...baseFoe, kind: "demon", poise: 0, poiseMax: 100 },
      dist: 1.2,
      dot: 0.5,
    });
    assert.equal(r.hit, true);
    if (!r.hit) return;
    assert.equal(r.hitDmg, Math.round(20 * TORCH_DEMON_DAMAGE_MUL));
  });

  it("misses outside arc", () => {
    const r = resolveSwingHitOnFoe({
      heavy: false,
      baseDmg: 20,
      torchHeld: false,
      foe: baseFoe,
      dist: 5,
      dot: 0.9,
    });
    assert.equal(r.hit, false);
  });
});

describe("connectSwingFeedback / strikeCameraImpulse / resolveBreakPoise", () => {
  it("connect feedback matches locked table", () => {
    assert.deepEqual(connectSwingFeedback(false), CONNECT_FEEDBACK.light);
    assert.deepEqual(connectSwingFeedback(true), CONNECT_FEEDBACK.heavy);
  });

  it("strikeCameraImpulse locks blocked vs open magnitudes", () => {
    const open = strikeCameraImpulse(28, false);
    assert.equal(open.power, 1);
    assert.equal(open.camPush, 1.15 + 0.9);
    assert.equal(open.shake, 0.46 + 0.22);
    assert.equal(open.hitstop, 0.09 + 0.04);
    const blocked = strikeCameraImpulse(28, true);
    assert.equal(blocked.camPush, (1.15 + 0.9) * 0.4);
    assert.equal(blocked.shake, 0.24);
    assert.equal(blocked.hitstop, 0.05);
  });

  it("resolveBreakPoise chips HP only when poise full", () => {
    assert.equal(resolveBreakPoise({ poise: 10, poiseMax: 40, state: "chase", hp: 80 }), null);
    const br = resolveBreakPoise({ poise: 40, poiseMax: 40, state: "chase", hp: 80 }, 34);
    assert.ok(br);
    assert.equal(br!.nextHp, 64);
    assert.equal(br!.chipHp, 16);
    assert.equal(br!.poiseHit, 34);
    assert.equal(br!.sparkMul, HIT_SPARK_MUL["stance-break"]);
    assert.equal(postureOnHit(true), 34);
    assert.equal(postureOnHit(false), 12);
  });
});

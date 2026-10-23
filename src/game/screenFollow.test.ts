import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOVE } from "./moves.ts";
import {
  PLANE_HIT_OPEN,
  PLANE_HIT_SHUT,
  clampScreenCamera,
  decayShake,
  planeAttackCue,
  planeCueFill,
  planeHitActive,
  planeWorldSize,
  shakeOffset,
  stepScreenCamera,
} from "./screenFollow.ts";

const VIEW_W = 800;
const VIEW_H = 600;
const WORLD_W = 4000;
const WORLD_H = 3000;

describe("planeWorldSize", () => {
  it("keeps a playfield larger than the view", () => {
    const small = planeWorldSize(800, 600);
    assert.equal(small.w, 2200);
    assert.equal(small.h, 1600);
    assert.ok(small.w > 800 && small.h > 600);
    const wide = planeWorldSize(1920, 1080);
    assert.equal(wide.w, 3840);
    assert.equal(wide.h, 2160);
  });
});

describe("stepScreenCamera", () => {
  it("eases toward the player and does not snap in one frame", () => {
    const next = stepScreenCamera(
      { x: 0, y: 0 },
      1000,
      900,
      VIEW_W,
      VIEW_H,
      WORLD_W,
      WORLD_H,
      1 / 60,
    );
    const goalX = 1000 - VIEW_W / 2;
    const goalY = 900 - VIEW_H / 2;
    assert.ok(next.x > 0 && next.x < goalX);
    assert.ok(next.y > 0 && next.y < goalY);
  });

  it("settles on the player without oscillating", () => {
    let cam = { x: 0, y: 0 };
    const px = 1800;
    const py = 1400;
    let prev = Infinity;
    for (let i = 0; i < 240; i++) {
      cam = stepScreenCamera(cam, px, py, VIEW_W, VIEW_H, WORLD_W, WORLD_H, 1 / 60);
      const err = Math.hypot(cam.x + VIEW_W / 2 - px, cam.y + VIEW_H / 2 - py);
      assert.ok(err <= prev + 1e-6);
      prev = err;
    }
    assert.ok(prev < 0.5);
  });

  it("keeps a steady lag on a moving target (no sign flip)", () => {
    let cam = { x: 400, y: 200 };
    let px = 1200;
    const py = 900;
    let prevLag = 0;
    let flips = 0;
    for (let i = 0; i < 180; i++) {
      px += 140 / 60;
      cam = stepScreenCamera(cam, px, py, VIEW_W, VIEW_H, WORLD_W, WORLD_H, 1 / 60);
      const lag = cam.x + VIEW_W / 2 - px;
      if (prevLag !== 0 && Math.sign(lag) !== Math.sign(prevLag)) flips += 1;
      prevLag = lag;
    }
    assert.equal(flips, 0);
    assert.ok(prevLag < 0);
  });

  it("clamps at the world edge instead of showing past it", () => {
    const cam = stepScreenCamera({ x: 0, y: 0 }, 40, 40, VIEW_W, VIEW_H, 2200, 1600, 1);
    assert.equal(cam.x, 0);
    assert.equal(cam.y, 0);
    const far = clampScreenCamera(9999, 9999, VIEW_W, VIEW_H, 2200, 1600);
    assert.equal(far.x, 2200 - VIEW_W);
    assert.equal(far.y, 1600 - VIEW_H);
  });

  it("centers the world when the view is larger than the playfield", () => {
    const cam = clampScreenCamera(0, 0, 3000, 2000, 2200, 1600);
    assert.equal(cam.x, (2200 - 3000) / 2);
    assert.equal(cam.y, (1600 - 2000) / 2);
  });
});

describe("shake", () => {
  it("decays and stays non-negative", () => {
    const next = decayShake(6, 1 / 60);
    assert.ok(next < 6 && next > 0);
    assert.equal(decayShake(0, 1 / 60), 0);
    assert.equal(decayShake(-2, 1 / 60), 0);
  });

  it("is zero with no impulse and bounded with one", () => {
    assert.deepEqual(shakeOffset(1, 0), { x: 0, y: 0 });
    const off = shakeOffset(0.2, 6);
    assert.ok(Math.abs(off.x) <= 6);
    assert.ok(Math.abs(off.y) <= 6);
  });
});

describe("plane attack cues", () => {
  it("matches the existing hit span and actionEnd", () => {
    assert.equal(planeHitActive("attack", PLANE_HIT_OPEN), false);
    assert.equal(planeHitActive("attack", 0.2), true);
    assert.equal(planeHitActive("attack", PLANE_HIT_SHUT), false);
    assert.equal(planeHitActive("free", 0.2), false);

    assert.equal(planeAttackCue("attack", PLANE_HIT_OPEN, false), "windup");
    assert.equal(planeAttackCue("attack", 0.2, false), "active");
    assert.equal(planeAttackCue("attack", PLANE_HIT_SHUT, false), "recover");
    assert.equal(planeAttackCue("attack", MOVE.lightEnd - 0.001, false), "recover");
    assert.equal(planeAttackCue("attack", MOVE.lightEnd, false), "idle");
    assert.equal(planeAttackCue("attack", MOVE.heavyEnd - 0.001, true), "recover");
    assert.equal(planeAttackCue("attack", MOVE.heavyEnd, true), "idle");
    assert.equal(planeAttackCue("dodge", 0.2, false), "idle");
  });

  it("keeps the cue in lockstep with planeHitActive", () => {
    for (const heavy of [false, true]) {
      for (let t = 0; t < 1; t += 0.01) {
        const active = planeHitActive("attack", t);
        assert.equal(planeAttackCue("attack", t, heavy) === "active", active);
      }
    }
  });

  it("fills wind-up and empties recover", () => {
    assert.equal(planeCueFill(0, false, "windup"), 0);
    assert.equal(planeCueFill(PLANE_HIT_OPEN, false, "windup"), 1);
    assert.equal(planeCueFill(PLANE_HIT_SHUT, false, "recover"), 1);
    assert.ok(planeCueFill(MOVE.lightEnd, false, "recover") === 0);
    assert.equal(planeCueFill(0.2, false, "idle"), 0);
  });
});

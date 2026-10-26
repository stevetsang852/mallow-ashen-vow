import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLIP_IDS, CUE_SCALES } from "./clips";
import {
  beatAt,
  clipPlan,
  cueAt,
  locate,
  sampleCamera,
  sampleGrade,
  samplePose,
  sampleStage,
  SHOT,
  STORY_SHOTS,
  uAt,
  wrap01,
} from "./shot";

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function yawOf(cam: { pos: { x: number; z: number }; look: { x: number; z: number } }) {
  return Math.atan2(cam.pos.x - cam.look.x, cam.pos.z - cam.look.z);
}

describe("previs storyboard A–G", () => {
  it("plays every shot inside the storyboard window", () => {
    assert.equal(STORY_SHOTS.map((shot) => shot.id).join(""), "ABCDEFG");
    const byId = Object.fromEntries(STORY_SHOTS.map((shot) => [shot.id, shot.seconds]));
    assert.ok(byId.A >= 2 && byId.A <= 2.5);
    assert.equal(byId.B, 0.4);
    assert.equal(byId.C, 1.5);
    assert.equal(byId.D, 1.2);
    assert.equal(byId.E, 2.5);
    assert.ok(byId.F >= 1.8 && byId.F <= 2.2);
    assert.equal(byId.G, 3);
    assert.equal(
      SHOT.seconds,
      STORY_SHOTS.reduce((sum, shot) => sum + shot.seconds, 0),
    );
    assert.deepEqual(locate(0).id, "A");
    assert.equal(locate(uAt("G", 2.5)).id, "G");
    assert.equal(wrap01(1), 0);
    assert.equal(locate(1).id, "A");
  });

  it("wakes behind Mallow, pulls in to lock, lifts off the ash, and orbits the win", () => {
    const wake = sampleCamera(uAt("A", 0.4));
    const stood = samplePose(uAt("A", 0.4));
    assert.ok(wake.pos.z < 0);
    assert.ok(wake.look.z > wake.pos.z);
    assert.ok(stood.z > 1);
    assert.ok(samplePose(uAt("A", 0)).crouch > samplePose(uAt("A", 2)).crouch);

    const lock0 = sampleCamera(uAt("B", 0));
    const lock1 = sampleCamera(uAt("B", 0.39));
    assert.ok(lock1.pos.z > lock0.pos.z + 2);
    assert.ok(lock1.fov < lock0.fov);

    const ash0 = sampleCamera(uAt("D", 0));
    const ash1 = sampleCamera(uAt("D", 1.15));
    assert.ok(ash1.pos.y > ash0.pos.y + 0.8);

    const arch0 = sampleCamera(uAt("E", 0.1));
    const arch1 = sampleCamera(uAt("E", 2.4));
    assert.ok(arch1.look.y > arch0.look.y + 0.6);

    const orbit0 = yawOf(sampleCamera(uAt("G", 0)));
    const orbit1 = yawOf(sampleCamera(uAt("G", 2.99)));
    const degrees = Math.abs(orbit1 - orbit0) * (180 / Math.PI);
    assert.ok(degrees > 14 && degrees < 16, `orbit ${degrees}`);

    const cool = sampleGrade(uAt("G", 2.9));
    const warm = sampleGrade(uAt("A", 0.2));
    assert.ok(warm.warm > cool.warm + 0.5);
  });

  it("reads orange, then pink, then a larger heavy telegraph", () => {
    const light = cueAt(uAt("C", 0.2));
    const heavy = cueAt(uAt("C", 0.85));
    const pink = cueAt(uAt("C", 0.5));
    assert.equal(light.kind, "orange");
    assert.equal(light.anchor, "mallow");
    assert.equal(light.scale, CUE_SCALES.light);
    assert.equal(heavy.kind, "orange");
    assert.equal(heavy.scale, CUE_SCALES.heavy);
    assert.ok(heavy.scale > light.scale);
    assert.equal(pink.kind, "pink");
    assert.match(beatAt(uAt("C", 0.2)), /C · .*橙圈/);
    assert.match(beatAt(uAt("C", 0.5)), /粉圈/);
    assert.equal(clipPlan(uAt("C", 0.2))[0]?.id, "mallow_atk_light");
    assert.equal(clipPlan(uAt("C", 0.8))[0]?.id, "mallow_atk_heavy");
  });

  it("shows the white i-frame on the charge, then the pink open chest", () => {
    const lean = cueAt(uAt("F", 0.2));
    const iframe = uAt("F", 0.5);
    const white = cueAt(iframe);
    const open = cueAt(uAt("F", 1.7));
    assert.equal(lean.kind, "orange");
    assert.equal(lean.anchor, "duke");
    assert.ok(lean.scale > CUE_SCALES.heavy);
    assert.equal(white.kind, "white");
    assert.equal(white.anchor, "mallow");
    assert.equal(open.kind, "pink");
    assert.equal(open.anchor, "duke");

    const cam = sampleCamera(iframe);
    const pose = samplePose(iframe);
    const near = Math.min(cam.pos.z, cam.look.z);
    const far = Math.max(cam.pos.z, cam.look.z);
    assert.ok(pose.z > near && pose.z < far, `mallow z ${pose.z} outside ${near}..${far}`);

    const track0 = sampleCamera(uAt("F", 0.2));
    const track1 = sampleCamera(uAt("F", 1.2));
    assert.ok(track0.pos.z > track1.pos.z + 1);
    const hold0 = sampleCamera(uAt("F", 1.64));
    const hold1 = sampleCamera(uAt("F", 1.95));
    assert.ok(dist(hold0.pos, hold1.pos) < 0.35);

    const plan = clipPlan(iframe);
    assert.ok(plan.some((play) => play.id === "duke_charge"));
    assert.ok(plan.some((play) => play.id === "mallow_roll"));
  });

  it("pops the pink diamond, drops the cloth, and leaves ash", () => {
    assert.equal(cueAt(uAt("B", 0.2)).kind, "diamond");
    assert.equal(cueAt(uAt("B", 0.2)).anchor, "shell");
    assert.ok(sampleStage(uAt("A", 0)).shellLean.z > sampleStage(uAt("A", 2)).shellLean.z);
    assert.ok(sampleStage(uAt("E", 0.1)).cloth < 0.2);
    assert.ok(sampleStage(uAt("E", 2.2)).cloth > 0.8);
    assert.ok(sampleStage(uAt("E", 2.2)).dukeWake > 0.8);
    assert.equal(sampleStage(uAt("C", 0.4)).shellAlive, 1);
    assert.ok(sampleStage(uAt("D", 1.1)).shellAlive < 0.2);
    assert.ok(sampleStage(uAt("D", 1.1)).ashRing > 0.8);
    assert.ok(samplePose(uAt("G", 2.8)).sheath > 0.8);
  });

  it("keeps the storyboard clip ids available to the mixer", () => {
    assert.deepEqual(
      [...CLIP_IDS],
      [
        "mallow_idle_ready",
        "mallow_atk_light",
        "mallow_atk_heavy",
        "mallow_block_hold",
        "mallow_deflect",
        "mallow_roll",
        "shell_atk_horiz",
        "duke_charge",
        "duke_stance_break",
        "red_intrude",
      ],
    );
  });
});

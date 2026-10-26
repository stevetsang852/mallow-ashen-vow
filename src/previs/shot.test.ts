import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beatAt, CAMERA_KEYS, POSE_KEYS, sampleCamera, samplePose, SHOT } from "./shot";

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe("previs shot", () => {
  it("stays inside a short looping beat", () => {
    assert.ok(SHOT.seconds >= 5 && SHOT.seconds <= 8);
  });

  it("closes the camera and the pose so the loop matches", () => {
    const cam0 = CAMERA_KEYS[0];
    const cam1 = CAMERA_KEYS[CAMERA_KEYS.length - 1];
    assert.equal(cam0.t, 0);
    assert.equal(cam1.t, 1);
    assert.ok(dist(cam0.pos, cam1.pos) < 1e-6);
    assert.ok(dist(cam0.look, cam1.look) < 1e-6);

    const pose0 = POSE_KEYS[0];
    const pose1 = POSE_KEYS[POSE_KEYS.length - 1];
    assert.equal(pose0.t, 0);
    assert.equal(pose1.t, 1);
    assert.equal(pose0.z, pose1.z);
    assert.equal(pose0.swordX, pose1.swordX);
    assert.equal(pose0.stride, pose1.stride);

    assert.ok(dist(sampleCamera(0).pos, sampleCamera(1).pos) < 1e-6);
    assert.ok(Math.abs(samplePose(0).z - samplePose(0.999).z) < 0.2);
    assert.ok(dist(sampleCamera(0).pos, sampleCamera(0.999).pos) < 0.45);
  });

  it("moves the camera and the character, and raises the sword", () => {
    const start = sampleCamera(0);
    const push = sampleCamera(0.64);
    assert.ok(dist(start.pos, push.pos) > 4);
    assert.ok(samplePose(0.38).z - samplePose(0).z > 2);
    assert.ok(samplePose(0).swordX - samplePose(0.68).swordX > 0.6);
    assert.equal(beatAt(0.02), "火芯 · 待機");
    assert.equal(beatAt(0.3), "走向剪影");
    assert.equal(beatAt(0.6), "舉劍 · 停格");
  });
});

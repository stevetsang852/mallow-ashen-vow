import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createParticles,
  EMBER_COLOR,
  EMBER_COUNT,
  EMBER_SIZE,
  EMBER_UPDATE_COUNT,
  HIT_SPARK_MUL,
  MOTES,
  MOTE_OPACITY,
  MOTE_SIZE,
  SPARK_BASE_COUNT,
  SPARK_BASE_SIZE,
  SPARKS,
} from "./particles.ts";
import { FIRE } from "./moves.ts";

describe("particles", () => {
  it("keeps hit hierarchy multipliers and pool size (feel lock)", () => {
    assert.equal(HIT_SPARK_MUL.light, 1);
    assert.equal(HIT_SPARK_MUL.heavy, 1.6);
    assert.equal(HIT_SPARK_MUL["stance-break"], 2.2);
    assert.equal(SPARK_BASE_SIZE, 0.11);
    assert.equal(SPARK_BASE_COUNT, 12);
    assert.equal(SPARKS, 96);
  });

  it("locks ambient ember/mote counts and look constants", () => {
    assert.equal(EMBER_COUNT, 28);
    assert.equal(EMBER_UPDATE_COUNT, 18);
    assert.equal(MOTES, 96);
    assert.equal(EMBER_COLOR, 0xe85d04);
    assert.equal(EMBER_SIZE, 0.065);
    assert.equal(MOTE_SIZE, 0.07);
    assert.equal(MOTE_OPACITY, 0.55);
  });

  it("burst + update advances positions without changing multipliers", () => {
    const p = createParticles();
    const pos = (p.points.geometry.getAttribute("position") as { array: Float32Array }).array;
    p.burst(1, 1.1, 2, 1, 0, 0, "steel", HIT_SPARK_MUL.light);
    const y0 = pos[1]!;
    assert.ok(y0 > -20, "spawned spark should leave the parked y");
    p.update();
    const y1 = pos[1]!;
    assert.notEqual(y1, y0);
    p.ringDust(0, 0);
    p.update();
    p.dispose();
  });

  it("heavy hierarchy grows material size vs base", () => {
    const p = createParticles();
    const mat = p.points.material as unknown as { size: number };
    assert.equal(mat.size, SPARK_BASE_SIZE);
    p.burst(0, 1, 0, 1, 0, 0, "steel", HIT_SPARK_MUL.heavy);
    assert.ok(mat.size >= SPARK_BASE_SIZE * HIT_SPARK_MUL.heavy - 1e-9);
    p.dispose();
  });

  it("updateAmbient places embers near FIRE and drifts motes", () => {
    const p = createParticles();
    const emberPos = (p.embers.geometry.getAttribute("position") as { array: Float32Array }).array;
    const motePos = (p.motes.geometry.getAttribute("position") as { array: Float32Array }).array;
    const mote0 = [motePos[0]!, motePos[1]!, motePos[2]!];

    p.updateAmbient(1.25);
    // First EMBER_UPDATE_COUNT slots animated; stay near bonfire xz
    assert.ok(Math.abs(emberPos[0]! - FIRE.x) < 0.5);
    assert.ok(Math.abs(emberPos[2]! - FIRE.z) < 0.5);
    assert.ok(emberPos[1]! >= 0.2 && emberPos[1]! <= 1.5);

    p.updateAmbient(2.5);
    assert.notDeepEqual([motePos[0]!, motePos[1]!, motePos[2]!], mote0);

    const emberMat = p.embers.material as unknown as { size: number; color: { getHex: () => number } };
    const moteMat = p.motes.material as unknown as { size: number; opacity: number };
    assert.equal(emberMat.size, EMBER_SIZE);
    assert.equal(emberMat.color.getHex(), EMBER_COLOR);
    assert.equal(moteMat.size, MOTE_SIZE);
    assert.equal(moteMat.opacity, MOTE_OPACITY);
    p.dispose();
  });
});

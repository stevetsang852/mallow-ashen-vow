import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createParticles,
  HIT_SPARK_MUL,
  SPARK_BASE_COUNT,
  SPARK_BASE_SIZE,
  SPARKS,
} from "./particles.ts";

describe("particles", () => {
  it("keeps hit hierarchy multipliers and pool size (feel lock)", () => {
    assert.equal(HIT_SPARK_MUL.light, 1);
    assert.equal(HIT_SPARK_MUL.heavy, 1.6);
    assert.equal(HIT_SPARK_MUL["stance-break"], 2.2);
    assert.equal(SPARK_BASE_SIZE, 0.11);
    assert.equal(SPARK_BASE_COUNT, 12);
    assert.equal(SPARKS, 96);
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
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canvasYawToDir,
  hollowDirForYaw,
  mallowDirForYaw,
  type CanvasDir,
} from "./createGame2D.ts";

const ALL: ReadonlySet<CanvasDir> = new Set(["n", "e", "s", "w"]);

describe("canvasYawToDir (screen atan2)", () => {
  it("maps cardinals: 0 east, +π/2 south, π west, −π/2 north", () => {
    assert.equal(canvasYawToDir(0), "e");
    assert.equal(canvasYawToDir(Math.PI / 2), "s");
    assert.equal(canvasYawToDir(Math.PI), "w");
    assert.equal(canvasYawToDir(-Math.PI / 2), "n");
    assert.equal(canvasYawToDir((3 * Math.PI) / 2), "n");
  });

  it("wraps full turns and non-finite yaw", () => {
    assert.equal(canvasYawToDir(Math.PI * 2), "e");
    assert.equal(canvasYawToDir(-Math.PI), "w");
    assert.equal(canvasYawToDir(Number.NaN), "s");
  });
});

describe("hollowDirForYaw", () => {
  it("returns the facing dir only when that PNG is ready", () => {
    assert.equal(hollowDirForYaw(ALL, 0), "e");
    assert.equal(hollowDirForYaw(ALL, Math.PI / 2), "s");
    assert.equal(hollowDirForYaw(new Set(["s"]), Math.PI / 2), "s");
  });

  it("misses to null so the silhouette fallback stays", () => {
    assert.equal(hollowDirForYaw(new Set(), 0), null);
    assert.equal(hollowDirForYaw(new Set(["s"]), 0), null);
  });
});

describe("mallowDirForYaw", () => {
  it("prefers the facing frame, else south, else null", () => {
    assert.equal(mallowDirForYaw(ALL, 0), "e");
    assert.equal(mallowDirForYaw(new Set(["s"]), 0), "s");
    assert.equal(mallowDirForYaw(new Set(["s"]), -Math.PI / 2), "s");
    assert.equal(mallowDirForYaw(new Set(), -Math.PI / 2), null);
  });
});

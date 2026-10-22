import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import {
  MALLOW_PLACEHOLDER_4DIR,
  SPRITE_DIRS_4,
  SPRITE_PUBLIC_ROOT,
  applySpriteNearest,
  directionColumn,
  frameUv,
  loadSpriteSheet,
  smokeSpriteSheetLoader,
  spritePublicPath,
} from "./spriteSheet.ts";

describe("spritePublicPath", () => {
  it("resolves under /sprites", () => {
    assert.equal(spritePublicPath("mallow-placeholder-4dir.png"), `${SPRITE_PUBLIC_ROOT}/mallow-placeholder-4dir.png`);
    assert.equal(spritePublicPath("/sprites/foo.png"), `${SPRITE_PUBLIC_ROOT}/foo.png`);
    assert.equal(spritePublicPath("sprites/bar.png"), `${SPRITE_PUBLIC_ROOT}/bar.png`);
  });
});

describe("MALLOW_PLACEHOLDER_4DIR", () => {
  it("is a 4-dir sheet pointing at public placeholder", () => {
    assert.equal(MALLOW_PLACEHOLDER_4DIR.columns, 4);
    assert.equal(MALLOW_PLACEHOLDER_4DIR.rows, 1);
    assert.deepEqual([...MALLOW_PLACEHOLDER_4DIR.directions!], [...SPRITE_DIRS_4]);
    assert.equal(MALLOW_PLACEHOLDER_4DIR.url, "/sprites/mallow-placeholder-4dir.png");
  });
});

describe("frameUv / directionColumn", () => {
  it("maps S to column 0 with full-height repeat", () => {
    const col = directionColumn(MALLOW_PLACEHOLDER_4DIR, "S");
    assert.equal(col, 0);
    const uv = frameUv(col, 0, 4, 1);
    assert.equal(uv.offset.x, 0);
    assert.equal(uv.offset.y, 0);
    assert.equal(uv.repeat.x, 0.25);
    assert.equal(uv.repeat.y, 1);
  });

  it("maps E to last column", () => {
    const col = directionColumn(MALLOW_PLACEHOLDER_4DIR, "E");
    assert.equal(col, 3);
    const uv = frameUv(col, 0, 4, 1);
    assert.equal(uv.offset.x, 0.75);
  });

  it("rejects out-of-range cells", () => {
    assert.throws(() => frameUv(4, 0, 4, 1));
    assert.throws(() => directionColumn(MALLOW_PLACEHOLDER_4DIR, "NW"));
  });
});

describe("loadSpriteSheet / applySpriteNearest", () => {
  it("applies nearest filters via injectable loader", async () => {
    const raw = new THREE.Texture();
    raw.magFilter = THREE.LinearFilter;
    const { texture, desc } = await loadSpriteSheet(MALLOW_PLACEHOLDER_4DIR, {
      loadTexture: async (url) => {
        assert.equal(url, MALLOW_PLACEHOLDER_4DIR.url);
        return raw;
      },
    });
    assert.equal(desc.id, "mallow-placeholder-4dir");
    assert.equal(texture.magFilter, THREE.NearestFilter);
    assert.equal(texture.minFilter, THREE.NearestFilter);
    assert.equal(texture.generateMipmaps, false);
  });

  it("applySpriteNearest mutates in place", () => {
    const t = new THREE.Texture();
    applySpriteNearest(t);
    assert.equal(t.magFilter, THREE.NearestFilter);
  });
});

describe("smokeSpriteSheetLoader", () => {
  it("passes harness smoke without DOM Image", async () => {
    const r = await smokeSpriteSheetLoader();
    assert.equal(r.ok, true);
    assert.equal(r.url, "/sprites/mallow-placeholder-4dir.png");
    assert.equal(r.uvS.repeat.x, 0.25);
  });
});

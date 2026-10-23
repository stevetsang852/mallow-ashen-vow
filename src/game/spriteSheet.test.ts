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
import {
  DIR_KEYS,
  lerpFacingYaw,
  loadMallowDirTextures,
  yawToDir,
  yawToDirSticky,
  yawToPlayerSpriteSectorSticky,
} from "./mallowSprite.ts";

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

describe("Graphics 1.0.3 mallow dir consumer (via FS nearest)", () => {
  it("yawToDir maps cardinals", () => {
    assert.equal(yawToDir(0), "s");
    assert.equal(yawToDir(Math.PI / 2), "e");
    assert.equal(yawToDir(Math.PI), "n");
    assert.equal(yawToDir((3 * Math.PI) / 2), "w");
  });

  it("loadMallowDirTextures applies FS nearest via injectable loader", async () => {
    const seen: string[] = [];
    const maps = await loadMallowDirTextures("/sprites/mallow", {
      loadTexture: async (url) => {
        seen.push(url);
        const t = new THREE.Texture();
        t.magFilter = THREE.LinearFilter;
        return t;
      },
    });
    assert.deepEqual(seen, DIR_KEYS.map((d) => `/sprites/mallow/${d}.png`));
    for (const d of DIR_KEYS) {
      assert.equal(maps[d].magFilter, THREE.NearestFilter);
      assert.equal(maps[d].generateMipmaps, false);
    }
  });
});

describe("1.1.4 sprite facing smooth", () => {
  it("lerpFacingYaw rate-limits toward target", () => {
    const mid = lerpFacingYaw(0, Math.PI / 2, 1, 0.2);
    assert.ok(mid > 0 && mid < Math.PI / 2);
    const done = lerpFacingYaw(0, Math.PI / 2, 100, 1);
    assert.ok(Math.abs(done - Math.PI / 2) < 1e-9);
  });

  it("yawToDirSticky holds near sector edge then flips", () => {
    const edge = Math.PI / 4; // s|e boundary for yawToDir
    assert.equal(yawToDirSticky(edge - 0.01, "s"), "s");
    assert.equal(yawToDirSticky(edge + 0.01, "s"), "s"); // still inside π/4+hyst
    assert.equal(yawToDirSticky(edge + Math.PI / 8 + 0.05, "s"), "e");
  });

  it("yawToPlayerSpriteSectorSticky preserves [s,w,n,e] sectors", () => {
    // sector 0 center = 0; stay until past π/4 + hyst
    assert.equal(yawToPlayerSpriteSectorSticky(0.1, 0), 0);
    assert.equal(yawToPlayerSpriteSectorSticky(Math.PI / 4 + Math.PI / 8 + 0.05, 0), 1);
  });
});

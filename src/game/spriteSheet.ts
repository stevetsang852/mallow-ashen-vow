/**
 * Sprite sheet loader stub (1.0.2) + hollow/灰殼 sheet key (1.1.5) for 2.5D / HD-2D era.
 * Graphics consumes this for Sir Mallow / enemy billboards; do not touch moves / AI / meshes here.
 */
import * as THREE from "three";

export const SPRITE_PUBLIC_ROOT = "/sprites";

/** Cardinal order for 4-dir placeholder sheets (left→right columns). */
export const SPRITE_DIRS_4 = ["S", "W", "N", "E"] as const;
export type SpriteDir4 = (typeof SPRITE_DIRS_4)[number];

export type SpriteSheetDesc = {
  id: string;
  /** Public URL under Vite `public/` (e.g. `/sprites/foo.png`). */
  url: string;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  /** Optional direction labels left→right (row 0) or row-major. */
  directions?: readonly string[];
};

export type SpriteSheetLoadResult = {
  texture: THREE.Texture;
  desc: SpriteSheetDesc;
};

/** Sir Mallow 4-dir placeholder — bands are color stubs until Graphics 1.0.3 art lands. */
export const MALLOW_PLACEHOLDER_4DIR: SpriteSheetDesc = {
  id: "mallow-placeholder-4dir",
  url: `${SPRITE_PUBLIC_ROOT}/mallow-placeholder-4dir.png`,
  columns: 4,
  rows: 1,
  frameWidth: 8,
  frameHeight: 32,
  directions: SPRITE_DIRS_4,
};

/**
 * 灰殼 Hollow 4-dir placeholder under `public/sprites/hollow/` (1.1.5).
 * Ash/soot bands until Graphics replaces; ART.md path: hollow/ or hollow-4dir.
 */
export const HOLLOW_PLACEHOLDER_4DIR: SpriteSheetDesc = {
  id: "hollow-placeholder-4dir",
  url: `${SPRITE_PUBLIC_ROOT}/hollow/hollow-placeholder-4dir.png`,
  columns: 4,
  rows: 1,
  frameWidth: 8,
  frameHeight: 32,
  directions: SPRITE_DIRS_4,
};

/** Dir-frame base for hollow (mirrors `/sprites/mallow`). */
export const HOLLOW_SPRITE_BASE = `${SPRITE_PUBLIC_ROOT}/hollow`;

/**
 * Canonical sheet keys for harness / Graphics lookup.
 * Aliases: `灰殼` → hollow. Do not invent duke/demon keys here (later waves).
 */
export type SpriteSheetKey = "mallow" | "hollow" | "灰殼";

const SHEET_BY_KEY: Record<SpriteSheetKey, SpriteSheetDesc> = {
  mallow: MALLOW_PLACEHOLDER_4DIR,
  hollow: HOLLOW_PLACEHOLDER_4DIR,
  灰殼: HOLLOW_PLACEHOLDER_4DIR,
};

/** Resolve a sheet key (incl. 灰殼 alias) to its placeholder desc. */
export function getSpriteSheetDesc(key: string): SpriteSheetDesc {
  const desc = SHEET_BY_KEY[key as SpriteSheetKey];
  if (!desc) {
    throw new Error(`getSpriteSheetDesc: unknown sheet key "${key}"`);
  }
  return desc;
}

export function isSpriteSheetKey(key: string): key is SpriteSheetKey {
  return key in SHEET_BY_KEY;
}

/** Resolve a filename under `public/sprites/` to a public URL. */
export function spritePublicPath(filename: string): string {
  const name = filename.replace(/^\/+/, "").replace(/^sprites\//, "");
  return `${SPRITE_PUBLIC_ROOT}/${name}`;
}

/** UV rect for one cell (Three.js: origin bottom-left). Returns {offset, repeat}. */
export function frameUv(
  column: number,
  row: number,
  columns: number,
  rows: number,
): { offset: { x: number; y: number }; repeat: { x: number; y: number } } {
  if (columns < 1 || rows < 1) {
    throw new Error("frameUv: columns and rows must be >= 1");
  }
  if (column < 0 || column >= columns || row < 0 || row >= rows) {
    throw new Error(`frameUv: cell (${column},${row}) out of ${columns}x${rows}`);
  }
  const rw = 1 / columns;
  const rh = 1 / rows;
  // row 0 = top of sheet → high V in image space; Three offset is bottom-left
  const yFromBottom = rows - 1 - row;
  return {
    offset: { x: column * rw, y: yFromBottom * rh },
    repeat: { x: rw, y: rh },
  };
}

/** Index of a named direction on a sheet (default: row 0, column = index). */
export function directionColumn(desc: SpriteSheetDesc, dir: string): number {
  const dirs = desc.directions;
  if (!dirs || dirs.length === 0) {
    throw new Error(`directionColumn: sheet ${desc.id} has no directions`);
  }
  const i = dirs.indexOf(dir);
  if (i < 0) {
    throw new Error(`directionColumn: "${dir}" not in ${desc.id}`);
  }
  return i;
}

/** Apply pixel-art sampling defaults for 2.5D sheets. */
export function applySpriteNearest(texture: THREE.Texture): THREE.Texture {
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export type LoadTextureFn = (url: string) => Promise<THREE.Texture>;

function defaultLoadTexture(url: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => resolve(tex),
      undefined,
      (err) => reject(err ?? new Error(`TextureLoader failed: ${url}`)),
    );
  });
}

/**
 * Load a sprite sheet texture (injectable for harness / unit tests).
 * Does not create Scene Sprites — Graphics wires billboards on top of this.
 */
export async function loadSpriteSheet(
  desc: SpriteSheetDesc,
  opts?: { loadTexture?: LoadTextureFn },
): Promise<SpriteSheetLoadResult> {
  const load = opts?.loadTexture ?? defaultLoadTexture;
  const texture = applySpriteNearest(await load(desc.url));
  return { texture, desc };
}

/** Load by sheet key (`mallow` | `hollow` | `灰殼`). */
export async function loadSpriteSheetByKey(
  key: string,
  opts?: { loadTexture?: LoadTextureFn },
): Promise<SpriteSheetLoadResult> {
  return loadSpriteSheet(getSpriteSheetDesc(key), opts);
}

export type SpriteSheetSmokeResult = {
  ok: true;
  url: string;
  uvS: ReturnType<typeof frameUv>;
  /** Present when hollow/灰殼 key was also smoked (1.1.5). */
  hollow?: { url: string; key: string; uvS: ReturnType<typeof frameUv> };
};

/** Harness / CI smoke: path + UV + injectable load without DOM Image. */
export async function smokeSpriteSheetLoader(
  loadTexture: LoadTextureFn = async () => applySpriteNearest(new THREE.Texture()),
): Promise<SpriteSheetSmokeResult> {
  const url = spritePublicPath("mallow-placeholder-4dir.png");
  if (url !== MALLOW_PLACEHOLDER_4DIR.url) {
    throw new Error(`smoke: path mismatch ${url}`);
  }
  const { texture, desc } = await loadSpriteSheet(MALLOW_PLACEHOLDER_4DIR, { loadTexture });
  if (desc.id !== "mallow-placeholder-4dir") throw new Error("smoke: bad desc id");
  if (texture.magFilter !== THREE.NearestFilter) throw new Error("smoke: magFilter");
  const col = directionColumn(desc, "S");
  const uvS = frameUv(col, 0, desc.columns, desc.rows);

  // 1.1.5: hollow / 灰殼 sheet key + public/sprites/hollow/ placeholder
  const hollowDesc = getSpriteSheetDesc("灰殼");
  if (hollowDesc !== HOLLOW_PLACEHOLDER_4DIR) {
    throw new Error("smoke: 灰殼 alias must resolve to HOLLOW_PLACEHOLDER_4DIR");
  }
  const hollowUrl = spritePublicPath("hollow/hollow-placeholder-4dir.png");
  if (hollowUrl !== HOLLOW_PLACEHOLDER_4DIR.url) {
    throw new Error(`smoke: hollow path mismatch ${hollowUrl}`);
  }
  const hollowLoad = await loadSpriteSheetByKey("hollow", { loadTexture });
  if (hollowLoad.desc.id !== "hollow-placeholder-4dir") throw new Error("smoke: bad hollow id");
  if (hollowLoad.texture.magFilter !== THREE.NearestFilter) throw new Error("smoke: hollow magFilter");
  const hollowCol = directionColumn(hollowLoad.desc, "S");
  const hollowUv = frameUv(hollowCol, 0, hollowLoad.desc.columns, hollowLoad.desc.rows);

  return {
    ok: true,
    url,
    uvS,
    hollow: { url: hollowUrl, key: "hollow", uvS: hollowUv },
  };
}

/**
 * Sprite sheet loader stub (1.0.2) for 2.5D / HD-2D era.
 * Graphics consumes this for Sir Mallow billboards; do not touch moves / AI / meshes here.
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

/** Harness / CI smoke: path + UV + injectable load without DOM Image. */
export async function smokeSpriteSheetLoader(
  loadTexture: LoadTextureFn = async () => applySpriteNearest(new THREE.Texture()),
): Promise<{ ok: true; url: string; uvS: ReturnType<typeof frameUv> }> {
  const url = spritePublicPath("mallow-placeholder-4dir.png");
  if (url !== MALLOW_PLACEHOLDER_4DIR.url) {
    throw new Error(`smoke: path mismatch ${url}`);
  }
  const { texture, desc } = await loadSpriteSheet(MALLOW_PLACEHOLDER_4DIR, { loadTexture });
  if (desc.id !== "mallow-placeholder-4dir") throw new Error("smoke: bad desc id");
  if (texture.magFilter !== THREE.NearestFilter) throw new Error("smoke: magFilter");
  const col = directionColumn(desc, "S");
  const uvS = frameUv(col, 0, desc.columns, desc.rows);
  return { ok: true, url, uvS };
}

import * as THREE from "three";
import type { KnightRig } from "@/game/knightMesh";
import {
  applySpriteNearest,
  type LoadTextureFn,
} from "@/game/spriteSheet";

export const MALLOW_SPRITE_BASE = "/sprites/mallow";

/** Lowercase 4-dir keys matching `public/sprites/mallow/{s,e,n,w}.png`. */
export type DirKey = "s" | "e" | "n" | "w";

export const DIR_KEYS: readonly DirKey[] = ["s", "e", "n", "w"] as const;

export type SpriteDirMaps = Record<DirKey, THREE.Texture>;

/** Pink bow — README / CSS `--color-bow`. */
export const MALLOW_BOW = 0xe8a0b8;

function emptyGroup(name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

function dummyStd(hex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: true,
  });
}

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
 * Load four directional frames from `{baseUrl}/{dir}.png` via FS nearest filter.
 * Rejects if any frame fails (caller falls back to GLB / makeKnight).
 */
export async function loadMallowDirTextures(
  baseUrl: string = MALLOW_SPRITE_BASE,
  opts?: { loadTexture?: LoadTextureFn },
): Promise<SpriteDirMaps> {
  const load = opts?.loadTexture ?? defaultLoadTexture;
  const base = baseUrl.replace(/\/$/, "");
  const entries = await Promise.all(
    DIR_KEYS.map(async (d) => {
      const tex = applySpriteNearest(await load(`${base}/${d}.png`));
      return [d, tex] as const;
    }),
  );
  return Object.fromEntries(entries) as SpriteDirMaps;
}

/** Shortest signed delta from `from` to `to` (radians). */
export function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Presentation facing lerp — rate-limited turn toward intent/yaw.
 * Does not change gameplay yaw; sprite frame selection only.
 */
export function lerpFacingYaw(
  current: number,
  target: number,
  speed: number,
  dt: number,
): number {
  const diff = shortestAngleDelta(current, target);
  const max = speed * dt;
  return current + Math.max(-max, Math.min(max, diff));
}

/** Map world yaw (player facing) to a 4-dir key. */
export function yawToDir(yaw: number): DirKey {
  const tau = Math.PI * 2;
  const a = ((yaw % tau) + tau) % tau;
  // 0 → N (-Z), π/2 → E (+X), π → S (+Z), 3π/2 → W (-X) after createGame's +π visual flip.
  const sector = Math.round(a / (Math.PI / 2)) % 4;
  return DIR_KEYS[sector]!;
}

/**
 * Sticky 4-dir: keep `current` until yaw leaves that sector by more than
 * π/4 + hysteresis. Stops frame pop/jitter at sector boundaries under fixed cam.
 */
export function yawToDirSticky(
  yaw: number,
  current: DirKey,
  hysteresis: number = Math.PI / 8,
): DirKey {
  const tau = Math.PI * 2;
  const a = ((yaw % tau) + tau) % tau;
  const curIdx = DIR_KEYS.indexOf(current);
  const curCenter = (Math.max(0, curIdx) * Math.PI) / 2;
  const delta = shortestAngleDelta(curCenter, a);
  if (Math.abs(delta) <= Math.PI / 4 + hysteresis) return current;
  return yawToDir(yaw);
}

/**
 * HD-2D createGame playerSprite maps sectors as [s, w, n, e] (not DIR_KEYS order).
 * Keep that mapping; only add sticky selection for 1.1.4.
 */
export function yawToPlayerSpriteSector(yaw: number): number {
  const tau = Math.PI * 2;
  const a = ((yaw % tau) + tau) % tau;
  return Math.round(a / (Math.PI / 2)) % 4;
}

export function yawToPlayerSpriteSectorSticky(
  yaw: number,
  current: number,
  hysteresis: number = Math.PI / 8,
): number {
  const cur = ((current % 4) + 4) % 4;
  const tau = Math.PI * 2;
  const a = ((yaw % tau) + tau) % tau;
  const curCenter = (cur * Math.PI) / 2;
  const delta = shortestAngleDelta(curCenter, a);
  if (Math.abs(delta) <= Math.PI / 4 + hysteresis) return cur;
  return yawToPlayerSpriteSector(yaw);
}

/**
 * Billboard Sir Mallow from placeholder 4-dir sprites.
 * Returns a KnightRig-compatible shell so poseKnight / createGame keep working;
 * limb groups are empty — pose mutates are no-ops visually.
 * Uses Fullstack **1.0.2** `applySpriteNearest` / injectable `LoadTextureFn`.
 */
export async function loadMallowSpriteRig(
  baseUrl: string = MALLOW_SPRITE_BASE,
  opts?: { loadTexture?: LoadTextureFn },
): Promise<KnightRig & { setFacingYaw: (yaw: number) => void }> {
  const maps: SpriteDirMaps = await loadMallowDirTextures(baseUrl, opts);

  const root = new THREE.Group();
  root.name = "MallowSprite";
  root.userData.mallowSprite = true;
  root.userData.baked = true;

  const bob = emptyGroup("bob");
  root.add(bob);
  const head = emptyGroup("head");
  const weapon = emptyGroup("weapon");
  const cape = emptyGroup("cape");
  cape.userData.baseX = 0;
  const legL = emptyGroup("legL");
  const legR = emptyGroup("legR");
  const tail = emptyGroup("tail");
  bob.add(head, weapon, cape, legL, legR, tail);

  const mat = new THREE.SpriteMaterial({
    map: maps.s,
    transparent: true,
    depthWrite: true,
    alphaTest: 0.15,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.name = "mallowBillboard";
  // ~makeKnight height (~1.4–1.6); Sprite scale is world units.
  sprite.scale.set(1.55, 1.55, 1);
  sprite.center.set(0.5, 0);
  sprite.position.y = 0;
  bob.add(sprite);

  let facing: DirKey = "s";
  const applyDir = (d: DirKey) => {
    if (d === facing) return;
    facing = d;
    mat.map = maps[d];
    mat.needsUpdate = true;
  };

  /** Target yaw already presentation-smoothed by createGame; sticky dir only. */
  const setFacingYaw = (yaw: number) => {
    applyDir(yawToDirSticky(yaw, facing));
  };

  const armorMat = dummyStd(0xb8c0c8);
  const furMat = dummyStd(0xe8a05a);
  const eyeMat = dummyStd(0x241c18);
  // Keep bow tint reachable for VFX / future flash.
  furMat.userData.bow = MALLOW_BOW;

  return {
    root,
    bob,
    head,
    weapon,
    cape,
    legL,
    legR,
    tail,
    armorMat,
    furMat,
    eyeMat,
    setFacingYaw,
  };
}

export function isMallowSpriteRig(rig: KnightRig): boolean {
  return rig.root.userData.mallowSprite === true;
}

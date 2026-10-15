/**
 * P1 items (0.8.3 stub + 0.8.6 torch + 0.8.9 explosive + 0.8.12 healHerb) — world pickups + in-memory inventory flags.
 * No shop UI. Pure helpers; createGame owns meshes / KeyE wiring / torch light / AoE feel / heal.
 */

import { FIRE, SPAWN } from "./moves.ts";

export type ItemId = "ash-token" | "flask-shard" | "torch" | "explosive" | "healHerb";

export const ITEM_IDS: readonly ItemId[] = [
  "ash-token",
  "flask-shard",
  "torch",
  "explosive",
  "healHerb",
] as const;

export const ITEM_LABEL: Record<ItemId, string> = {
  "ash-token": "灰徽",
  "flask-shard": "瓶碎片",
  torch: "火炬",
  explosive: "炸藥",
  healHerb: "恢復藥草",
};

/** Interact reach (m) — slightly tighter than bonfire rest (1.75). */
export const ITEM_INTERACT_RANGE = 1.4;

/**
 * Held torch vs demon only — clear multiplier on the existing hit damage
 * (before stance-break 1.5). Does not rewrite MOVE damage tables.
 */
export const TORCH_DEMON_DAMAGE_MUL = 1.35;

/** Torch PointLight distance (m) when held — small personal radius. */
export const TORCH_LIGHT_DISTANCE = 6.5;

/** P1 0.8.9 explosive stub — AoE radius (m) at detonation origin. */
export const EXPLOSIVE_AOE_RADIUS = 3.0;

/** P1 0.8.9 explosive stub — flat damage to foes in radius (one-shot consume). */
export const EXPLOSIVE_DAMAGE = 50;

/** P1 0.8.12 heal herb — flat HP restore on use (clamped to hpMax; one-shot consume). */
export const HEAL_HERB_AMOUNT = 40;

export type WorldPickup = {
  id: ItemId;
  x: number;
  z: number;
  /** False after collect; stays until run reset. */
  active: boolean;
};

export type InventoryFlags = Record<ItemId, boolean>;

/** Minimal foe shape for pure AoE tests (no Three.js). */
export type ExplosiveTarget = {
  x: number;
  z: number;
  hp: number;
  state: string;
};

/** Courtyard stubs near FIRE / SPAWN — north of the gate. */
export function defaultWorldPickups(): WorldPickup[] {
  return [
    { id: "ash-token", x: FIRE.x + 2.4, z: FIRE.z - 1.2, active: true },
    { id: "flask-shard", x: SPAWN.x + 1.8, z: SPAWN.z - 0.6, active: true },
    { id: "torch", x: FIRE.x - 1.6, z: FIRE.z + 1.4, active: true },
    { id: "explosive", x: SPAWN.x - 1.8, z: SPAWN.z + 0.4, active: true },
    { id: "healHerb", x: SPAWN.x + 0.4, z: SPAWN.z + 1.6, active: true },
  ];
}

export function emptyInventory(): InventoryFlags {
  return { "ash-token": false, "flask-shard": false, torch: false, explosive: false, healHerb: false };
}

export function hasItem(inv: InventoryFlags, id: ItemId): boolean {
  return !!inv[id];
}

export function distXZ(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function inInteractRange(
  px: number,
  pz: number,
  item: Pick<WorldPickup, "x" | "z" | "active">,
  range = ITEM_INTERACT_RANGE,
): boolean {
  if (!item.active) return false;
  return distXZ(px, pz, item.x, item.z) <= range;
}

/** Nearest active pickup in range, or null. */
export function findNearestPickup(
  px: number,
  pz: number,
  pickups: readonly WorldPickup[],
  range = ITEM_INTERACT_RANGE,
): WorldPickup | null {
  let best: WorldPickup | null = null;
  let bestD = range;
  for (const p of pickups) {
    if (!p.active) continue;
    const d = distXZ(px, pz, p.x, p.z);
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Collect nearest in-range pickup into inventory.
 * Returns collected id, or null if none / already owned (still removes duplicate marker).
 */
export function tryCollectNearest(
  px: number,
  pz: number,
  pickups: WorldPickup[],
  inv: InventoryFlags,
  range = ITEM_INTERACT_RANGE,
): ItemId | null {
  const hit = findNearestPickup(px, pz, pickups, range);
  if (!hit) return null;
  hit.active = false;
  inv[hit.id] = true;
  return hit.id;
}

/**
 * Consume inventory explosive flag. Returns false if none held.
 * Pure — createGame applies AoE + feel after this succeeds.
 */
export function tryConsumeExplosive(inv: InventoryFlags): boolean {
  if (!inv.explosive) return false;
  inv.explosive = false;
  return true;
}

/**
 * Consume inventory healHerb flag. Returns false if none held.
 * Pure — createGame applies HP after this succeeds.
 */
export function tryConsumeHealHerb(inv: InventoryFlags): boolean {
  if (!inv.healHerb) return false;
  inv.healHerb = false;
  return true;
}

/**
 * Restore flat HP, clamped to hpMax. Pure — safe for unit tests.
 */
export function applyHealHerb(hp: number, hpMax: number, amount = HEAL_HERB_AMOUNT): number {
  return Math.min(hpMax, hp + amount);
}

/**
 * Deal flat AoE damage to living targets in radius. Mutates hp.
 * Skips dead / already-zero. Returns the targets that were hit.
 */
export function applyExplosiveAoe<T extends ExplosiveTarget>(
  ox: number,
  oz: number,
  targets: readonly T[],
  radius = EXPLOSIVE_AOE_RADIUS,
  damage = EXPLOSIVE_DAMAGE,
): T[] {
  const hit: T[] = [];
  for (const t of targets) {
    if (t.state === "dead" || t.hp <= 0) continue;
    if (distXZ(ox, oz, t.x, t.z) > radius) continue;
    t.hp = Math.max(0, t.hp - damage);
    hit.push(t);
  }
  return hit;
}

/** Reset markers + clear inventory (new run / again). */
export function resetItems(pickups: WorldPickup[], inv: InventoryFlags): void {
  const fresh = defaultWorldPickups();
  for (let i = 0; i < pickups.length; i++) {
    const src = fresh[i];
    const dst = pickups[i];
    if (!src || !dst) continue;
    dst.id = src.id;
    dst.x = src.x;
    dst.z = src.z;
    dst.active = true;
  }
  inv["ash-token"] = false;
  inv["flask-shard"] = false;
  inv.torch = false;
  inv.explosive = false;
  inv.healHerb = false;
}

export function ownedLabels(inv: InventoryFlags): string[] {
  return ITEM_IDS.filter((id) => inv[id]).map((id) => ITEM_LABEL[id]);
}

/**
 * Apply held-torch bonus vs demon only. Pure — safe for unit tests without Three.js.
 * Non-demon / no torch → base unchanged. Stance-break mul stays outside this helper.
 */
export function applyTorchDemonBonus(
  baseDmg: number,
  hasTorch: boolean,
  foeKind: string,
): number {
  if (!hasTorch || foeKind !== "demon") return baseDmg;
  return Math.round(baseDmg * TORCH_DEMON_DAMAGE_MUL);
}

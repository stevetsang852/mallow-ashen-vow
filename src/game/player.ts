import { MOVE } from "@/game/moves";

export const PLAYER = {
  dodgeEnd: 0.46,
  drinkEnd: 0.82,
  hurtEnd: 0.34,
  blockEnd: 0.3,
  iframeStart: 0.04,
  iframeEnd: 0.34,
} as const;

/**
 * P0 Deflect (0.8.0) — Sekiro-style press-guard window.
 * Raise block (KeyC) within `window` seconds *before* an enemy hit connects
 * (measured as time-since-block-start when hurtPlayer fires). Success nullifies
 * player damage, knocks the foe back, and briefly staggers them. Holding block
 * longer falls through to normal chip-block.
 */
export const DEFLECT = {
  /** Max seconds after raising guard for a connecting hit to count as deflect. */
  window: 0.2,
  /** Stamina spent on successful deflect (normal block spends 16). */
  staCost: 8,
  /** Poise damage applied to attacker on deflect. */
  poise: 34,
  /** HP chip dealt to attacker on bounce. */
  chip: 10,
  /** Foe hurt/stagger duration after deflect. */
  stagger: 0.55,
  /** Knockback distance along away-from-player. */
  knockback: 1.15,
  /** Min stamina to attempt guard (same as normal block gate). */
  minSta: 14,
  /** Min facing dot (player forward · to-foe) for guard to count. */
  minFacing: 0.1,
} as const;

export type GuardResolve = "deflect" | "block" | "whiff";

/** True while blockAge is inside the precise deflect window. */
export function inDeflectWindow(blockAge: number, window: number = DEFLECT.window): boolean {
  return blockAge >= 0 && blockAge <= window;
}

/**
 * Resolve an incoming foe hit while the player may be blocking.
 * - deflect: blockAge ≤ window, facing + stamina ok
 * - block: holding guard past the window
 * - whiff: not blocking / wrong facing / low stamina → full hit
 */
export function resolveGuardHit(opts: {
  blocking: boolean;
  blockAge: number;
  facingDot: number;
  stamina: number;
  window?: number;
  minSta?: number;
  minFacing?: number;
}): GuardResolve {
  if (!opts.blocking) return "whiff";
  const minSta = opts.minSta ?? DEFLECT.minSta;
  const minFacing = opts.minFacing ?? DEFLECT.minFacing;
  if (opts.stamina < minSta || opts.facingDot <= minFacing) return "whiff";
  return inDeflectWindow(opts.blockAge, opts.window ?? DEFLECT.window) ? "deflect" : "block";
}

export function actionEnd(act: string, heavy: boolean) {
  if (act === "attack") return heavy ? MOVE.heavyEnd : MOVE.lightEnd;
  if (act === "dodge") return PLAYER.dodgeEnd;
  if (act === "drink") return PLAYER.drinkEnd;
  if (act === "hurt") return PLAYER.hurtEnd;
  return PLAYER.blockEnd;
}

export function inIFrame(act: string, actT: number) {
  return act === "dodge" && actT > PLAYER.iframeStart && actT < PLAYER.iframeEnd;
}

export function hitWindow(heavy: boolean) {
  return heavy
    ? { open: MOVE.heavyOpen, shut: MOVE.heavyShut }
    : { open: MOVE.lightOpen, shut: MOVE.lightShut };
}

export function inRecover(act: string, actT: number, heavy: boolean) {
  if (act !== "attack") return false;
  const { shut } = hitWindow(heavy);
  return actT >= shut && actT < actionEnd(act, heavy);
}

export function inWindup(act: string, actT: number, heavy: boolean) {
  if (act !== "attack") return false;
  const { open } = hitWindow(heavy);
  return actT < open;
}

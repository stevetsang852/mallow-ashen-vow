/** @deprecated Prefer `@/game/ai` for AI picks — re-exports kept for older imports.
 *  0.8.0 also hosts deflect bounce / pre-hit timing helpers used by createGame.
 */
export {
  chooseDukeMove,
  dukeSwingSpan,
  dukeRecoverSpan,
} from "@/game/ai";

import { DEFLECT } from "@/game/player";
import type { Foe, FoeState } from "@/game/moves";

/** Typical swing.t when hollow / duke cleave / demon first call hurtPlayer. */
export const FOE_SWING_HIT_AT = 0.04;

/**
 * Seconds until this foe's current attack would connect
 * (telegraph remaining + swing hit delay). null if not attacking or already swung.
 */
export function timeUntilFoeHit(
  state: FoeState,
  t: number,
  span: number,
  swung: boolean,
  swingHitAt = FOE_SWING_HIT_AT,
): number | null {
  if (state === "telegraph") return Math.max(0, span - t) + swingHitAt;
  if (state === "swing" && !swung) return Math.max(0, swingHitAt - t);
  return null;
}

/** Enemy attack is inside the ~0.2s pre-hit deflect threat window. */
export function inFoeDeflectThreat(
  state: FoeState,
  t: number,
  span: number,
  swung: boolean,
  window: number = DEFLECT.window,
): boolean {
  const until = timeUntilFoeHit(state, t, span, swung);
  return until !== null && until <= window;
}

export type DeflectBounceTarget = Pick<
  Foe,
  "x" | "z" | "hp" | "poise" | "state" | "t" | "stagger" | "swung" | "span" | "cd"
>;

/**
 * Bounce foe away from player and put them in brief hurt/stagger.
 * Does not touch poiseMax / kind — caller may also add poise + breakPoise.
 */
export function applyDeflectBounce(
  f: DeflectBounceTarget,
  fromX: number,
  fromZ: number,
  opts?: { knockback?: number; stagger?: number; chip?: number },
): void {
  const kb = opts?.knockback ?? DEFLECT.knockback;
  const stagger = opts?.stagger ?? DEFLECT.stagger;
  const chip = opts?.chip ?? DEFLECT.chip;
  const dx = f.x - fromX;
  const dz = f.z - fromZ;
  const nd = Math.hypot(dx, dz) || 1;
  f.x += (dx / nd) * kb;
  f.z += (dz / nd) * kb;
  f.hp = Math.max(0, f.hp - chip);
  f.state = "hurt";
  f.t = 0;
  f.stagger = stagger;
  f.swung = true;
  f.span = stagger;
  f.cd = 0.35;
}

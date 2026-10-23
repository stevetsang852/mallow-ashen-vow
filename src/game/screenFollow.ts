import { actionEnd } from "@/game/player";

/**
 * Pure 2D screen follow. Not the isometric rig in camera.ts.
 * Follow uses the same exponential blend as stepCamera's free rate (7.5).
 */

/** Active-hit span the 2D step already uses (`actT > open && actT < shut`). */
export const PLANE_HIT_OPEN = 0.1;
export const PLANE_HIT_SHUT = 0.28;

/** Exponential follow rate. Matches stepCamera free follow. */
export const SCREEN_FOLLOW_RATE = 7.5;

/** Presentation shake in CSS pixels. Does not change move timings. */
export const PLANE_SHAKE = { hit: 4.5, heavy: 7, hurt: 6 } as const;

export type ScreenCam = { x: number; y: number };

export type PlaneCue = "windup" | "active" | "recover" | "idle";

/** World larger than the view so the playfield can track the knight. */
export function planeWorldSize(viewW: number, viewH: number): { w: number; h: number } {
  const vw = Math.max(1, viewW);
  const vh = Math.max(1, viewH);
  return { w: Math.max(2200, vw * 2), h: Math.max(1600, vh * 2) };
}

export function clampScreenCamera(
  x: number,
  y: number,
  viewW: number,
  viewH: number,
  worldW: number,
  worldH: number,
): ScreenCam {
  const maxX = worldW - viewW;
  const maxY = worldH - viewH;
  return {
    x: maxX >= 0 ? Math.min(maxX, Math.max(0, x)) : maxX / 2,
    y: maxY >= 0 ? Math.min(maxY, Math.max(0, y)) : maxY / 2,
  };
}

/**
 * Glide the view toward the player. One step never snaps to the goal,
 * so a single-frame position spike cannot jitter the playfield.
 */
export function stepScreenCamera(
  cam: ScreenCam,
  playerX: number,
  playerY: number,
  viewW: number,
  viewH: number,
  worldW: number,
  worldH: number,
  dt: number,
  rate = SCREEN_FOLLOW_RATE,
): ScreenCam {
  const goalX = playerX - viewW / 2;
  const goalY = playerY - viewH / 2;
  const k = 1 - Math.exp(-Math.max(0, dt) * rate);
  return clampScreenCamera(
    cam.x + (goalX - cam.x) * k,
    cam.y + (goalY - cam.y) * k,
    viewW,
    viewH,
    worldW,
    worldH,
  );
}

export function decayShake(amount: number, dt: number, rate = 8): number {
  if (!(amount > 0)) return 0;
  return amount * Math.exp(-Math.max(0, dt) * rate);
}

export function shakeOffset(time: number, amount: number): { x: number; y: number } {
  if (!(amount > 0)) return { x: 0, y: 0 };
  return {
    x: Math.sin(time * 78) * amount,
    y: Math.cos(time * 61) * amount * 0.62,
  };
}

/** True on the same frames the 2D step already applies swing damage. */
export function planeHitActive(act: string, actT: number): boolean {
  return act === "attack" && actT > PLANE_HIT_OPEN && actT < PLANE_HIT_SHUT;
}

/**
 * Wind-up / active / recover for the plane.
 * Open and shut are PLANE_HIT_*; recover ends at actionEnd (existing lock).
 */
export function planeAttackCue(act: string, actT: number, heavy: boolean): PlaneCue {
  if (act !== "attack") return "idle";
  if (!(actT > PLANE_HIT_OPEN)) return "windup";
  if (actT < PLANE_HIT_SHUT) return "active";
  if (actT < actionEnd("attack", heavy)) return "recover";
  return "idle";
}

/** Wind-up fills 0→1. Recover empties 1→0. Active is the hit-window progress. */
export function planeCueFill(actT: number, heavy: boolean, cue: PlaneCue): number {
  if (cue === "windup") return Math.max(0, Math.min(1, actT / PLANE_HIT_OPEN));
  if (cue === "active") {
    const span = PLANE_HIT_SHUT - PLANE_HIT_OPEN;
    return Math.max(0, Math.min(1, (actT - PLANE_HIT_OPEN) / span));
  }
  if (cue === "recover") {
    const end = actionEnd("attack", heavy);
    const span = Math.max(1e-6, end - PLANE_HIT_SHUT);
    const u = Math.max(0, Math.min(1, (actT - PLANE_HIT_SHUT) / span));
    return 1 - u;
  }
  return 0;
}

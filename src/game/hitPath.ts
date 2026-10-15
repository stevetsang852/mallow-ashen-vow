/**
 * Pure hit-path / feel-apply helpers extracted from createGame (0.8.13).
 * Does not change moves.ts damage tables or Graphics HUD.
 */

import { applyTorchDemonBonus } from "./items.ts";
import { HIT_SPARK_MUL, type SparkKind } from "./particles.ts";

/** Poise damage on connecting light / heavy swing (unchanged from createGame). */
export const POSTURE_ON_HIT = { light: 12, heavy: 34 } as const;

/** Base reach before foe radius pad. */
export const SWING_REACH_BASE = { light: 1.8, heavy: 2.15 } as const;

/** Min forward dot for a swing to land. */
export const SWING_DOT_MIN = { light: 0.16, heavy: 0.28 } as const;

/** HP multiplier when the same swing breaks poise. */
export const STANCE_BREAK_DMG_MUL = 1.5;

/** Extra HP chip applied by the standalone breakPoise() path (block / deflect). */
export const BREAK_POISE_HP_CHIP = 16;

/** Default poiseHit amount tagged on stance-break feel from breakPoise(). */
export const BREAK_POISE_DEFAULT_HIT = 22;

/** First connecting swing → camera / hitstop feel (locked). */
export const CONNECT_FEEDBACK = {
  light: {
    shake: 0.28,
    hitstop: 0.07,
    hitFlash: 0.45,
    camKick: 0.4,
    fovKick: 1.7,
    camRoll: 0.022,
  },
  heavy: {
    shake: 0.48,
    hitstop: 0.12,
    hitFlash: 0.85,
    camKick: 0.72,
    fovKick: 3.4,
    camRoll: 0.04,
  },
} as const;

/** Stance-break VFX impulse from breakPoise() (locked). */
export const STANCE_BREAK_FEEDBACK = {
  hitstop: 0.16,
  shake: 0.55,
} as const;

export function swingReach(heavy: boolean, foeRadius: number): number {
  return (heavy ? SWING_REACH_BASE.heavy : SWING_REACH_BASE.light) + foeRadius * 0.45;
}

export function inSwingArc(opts: {
  heavy: boolean;
  dist: number;
  dot: number;
  foeRadius: number;
}): boolean {
  const reach = swingReach(opts.heavy, opts.foeRadius);
  const minDot = opts.heavy ? SWING_DOT_MIN.heavy : SWING_DOT_MIN.light;
  return opts.dist < reach && opts.dot > minDot;
}

export function postureOnHit(heavy: boolean): number {
  return heavy ? POSTURE_ON_HIT.heavy : POSTURE_ON_HIT.light;
}

/**
 * Telegraph armour: light always; heavy only vs duke.
 * Matches prior createGame boolean exactly.
 */
export function isArmoredDuringSwing(opts: {
  foeState: string;
  foeKind: string;
  heavy: boolean;
}): boolean {
  const { foeState, foeKind, heavy } = opts;
  return (
    foeState === "swing" ||
    foeState === "roar" ||
    (foeState === "telegraph" && !(heavy && foeKind !== "duke"))
  );
}

export type FoeHitSnap = {
  id: number;
  kind: string;
  state: string;
  poise: number;
  poiseMax: number;
  hp: number;
  r: number;
};

export type SwingHitApplied = {
  hit: true;
  posture: number;
  broken: boolean;
  /** Damage after torch bonus, before stance-break mul. */
  hitDmg: number;
  /** HP subtracted this swing (rounded). */
  appliedHpDamage: number;
  nextHp: number;
  nextPoise: number;
  nextState: string;
  nextStagger: number;
  sparkMul: number;
  sparkKind: SparkKind;
  feelKind: "hit" | "heavy";
  toastStanceBreak: boolean;
};

export type SwingHitMiss = { hit: false };

export type SwingHitResult = SwingHitApplied | SwingHitMiss;

/**
 * Pure resolve of one player swing vs one living foe (geometry + poise + HP + spark tier).
 * createGame applies the returned fields and emits feel / VFX.
 */
export function resolveSwingHitOnFoe(opts: {
  heavy: boolean;
  baseDmg: number;
  torchHeld: boolean;
  foe: FoeHitSnap;
  dist: number;
  dot: number;
}): SwingHitResult {
  const { heavy, baseDmg, torchHeld, foe, dist, dot } = opts;
  if (!inSwingArc({ heavy, dist, dot, foeRadius: foe.r })) return { hit: false };

  const posture = postureOnHit(heavy);
  const poiseAfter = foe.poise + posture;
  const broken = poiseAfter >= foe.poiseMax;
  const hitDmg = applyTorchDemonBonus(baseDmg, torchHeld, foe.kind);
  const appliedHpDamage = Math.round(hitDmg * (broken ? STANCE_BREAK_DMG_MUL : 1));
  const nextHp = Math.max(0, foe.hp - appliedHpDamage);

  let nextState = foe.state;
  let nextStagger = 0;
  let nextPoise = poiseAfter;
  let toastStanceBreak = false;

  if (broken) {
    nextPoise = 0;
    nextState = "hurt";
    nextStagger = 1.05;
    toastStanceBreak = true;
  } else if (!isArmoredDuringSwing({ foeState: foe.state, foeKind: foe.kind, heavy })) {
    nextState = "hurt";
  }

  const sparkMul = broken
    ? HIT_SPARK_MUL["stance-break"]
    : heavy
      ? HIT_SPARK_MUL.heavy
      : HIT_SPARK_MUL.light;
  const sparkKind: SparkKind = broken || heavy ? "pink" : "steel";

  return {
    hit: true,
    posture,
    broken,
    hitDmg,
    appliedHpDamage,
    nextHp,
    nextPoise,
    nextState,
    nextStagger,
    sparkMul,
    sparkKind,
    feelKind: heavy ? "heavy" : "hit",
    toastStanceBreak,
  };
}

/** First connecting hit in a swing window — camera / stop impulses. */
export function connectSwingFeedback(heavy: boolean) {
  return heavy ? CONNECT_FEEDBACK.heavy : CONNECT_FEEDBACK.light;
}

/**
 * Pure camera / shake / hitstop magnitudes when the player takes a hit.
 * Side-dependent camRoll / camYaw still applied by createGame from attacker position.
 */
export function strikeCameraImpulse(amount: number, blocked = false) {
  const power = Math.min(1.4, amount / 28);
  const scale = blocked ? 0.4 : 1;
  return {
    power,
    camPush: (0.9 + power * 0.75) * scale,
    fovKick: blocked ? 1.1 : 2.4 + power * 1.6,
    shake: blocked ? 0.24 : 0.46 + power * 0.22,
    hitstop: blocked ? 0.05 : 0.09 + power * 0.04,
    hurtDip: blocked ? 0.08 : 0.24,
    camRollAbs: (blocked ? 0.028 : 0.07) * (0.7 + power),
    camYawKick: blocked ? 0.035 : 0.08,
    camRollFallback: blocked ? 0.02 : 0.05,
  };
}

export type BreakPoiseResult = {
  chipHp: number;
  nextHp: number;
  nextState: "hurt";
  stagger: number;
  hitstop: number;
  shake: number;
  sparkMul: number;
  poiseHit: number;
};

/**
 * Standalone breakPoise gate (block / deflect path).
 * Returns null when poise is not past max or foe is dead.
 */
export function resolveBreakPoise(
  foe: { poise: number; poiseMax: number; state: string; hp: number },
  poiseHit: number = BREAK_POISE_DEFAULT_HIT,
): BreakPoiseResult | null {
  if (foe.poise < foe.poiseMax || foe.state === "dead") return null;
  return {
    chipHp: BREAK_POISE_HP_CHIP,
    nextHp: Math.max(0, foe.hp - BREAK_POISE_HP_CHIP),
    nextState: "hurt",
    stagger: 1.05,
    hitstop: STANCE_BREAK_FEEDBACK.hitstop,
    shake: STANCE_BREAK_FEEDBACK.shake,
    sparkMul: HIT_SPARK_MUL["stance-break"],
    poiseHit,
  };
}

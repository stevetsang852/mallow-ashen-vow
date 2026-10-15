import { MOVE } from "@/game/moves";

export const PLAYER = {
  dodgeEnd: 0.46,
  drinkEnd: 0.82,
  hurtEnd: 0.34,
  blockEnd: 0.3,
  iframeStart: 0.04,
  iframeEnd: 0.34,
  parryEnd: 0.25,
  parryRecovery: 0.15,
} as const;

// Combo system constants
export const COMBO = {
  maxChains: 3,
  window: 0.8, // seconds to chain attacks
  dmgMultiplier: [1.0, 1.25, 1.5] as const,
  recovery: 0.15, // extra recovery after combo ends
};

// Parry/Deflect system constants
export const PARRY = {
  window: 0.2, // seconds to successfully parry
  deflectTime: 0.8, // how long enemy is staggered
  cost: 8, // stamina cost for parry
  cooldown: 0.5, // cooldown after failed parry
};

export function actionEnd(act: string, heavy: boolean, combo: number = 0) {
  if (act === "attack") {
    const baseEnd = heavy ? MOVE.heavyEnd : MOVE.lightEnd;
    // Add recovery time after combo chains
    if (combo > 0 && !heavy) return baseEnd + COMBO.recovery * combo;
    return baseEnd;
  }
  if (act === "dodge") return PLAYER.dodgeEnd;
  if (act === "drink") return PLAYER.drinkEnd;
  if (act === "hurt") return PLAYER.hurtEnd;
  if (act === "parry") return PLAYER.parryEnd;
  return PLAYER.blockEnd;
}

// Get combo damage multiplier
export function getComboMultiplier(combo: number, heavy: boolean): number {
  if (heavy) return 1.0; // heavy attacks don't use combo
  if (combo >= COMBO.dmgMultiplier.length) return COMBO.dmgMultiplier[COMBO.dmgMultiplier.length - 1];
  return COMBO.dmgMultiplier[combo] ?? 1.0;
}

// Check if player is in parry stance
export function isParrying(act: string): boolean {
  return act === "parry";
}

// Check if parry window is active (beginning of parry)
export function inParryWindow(actT: number): boolean {
  return act === "parry" && actT < PARRY.window;
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

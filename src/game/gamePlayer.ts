/**
 * Player state and actions — extracted from createGame.ts.
 * Handles player movement, combat, and inventory interactions.
 */
import { MOVE, beginLightComboHit, breakLightCombo, canStartLightCombo, dampAngle, lightComboDamage, type Act, type Foe, type LightComboState } from "./moves.ts";
import type { PlayerState } from "./moves.ts";
import { DEFLECT, hitWindow, inIFrame, inRecover, inWindup, resolveGuardHit, type GuardResolve } from "./player.ts";
import { applyDeflectBounce } from "./foes.ts";
import {
  connectSwingFeedback,
  resolveBreakPoise,
  resolveSwingHitOnFoe,
  strikeCameraImpulse,
} from "./hitPath.ts";

export type GameApi = {
  attack: (kind?: "light" | "heavy") => void;
  block: (on: boolean) => void;
  dodge: () => void;
  lockNext: () => void;
  interact: () => void;
  rest: () => void;
  temper: () => void;
  hotbarSelect: (slot: number) => void;
  hotbarUse: () => void;
};

export function createPlayerState(): PlayerState & {
  combo: number;
  comboTimer: number;
  lastAttackTime: number;
  parryActive: boolean;
  parryTimer: number;
  parryCooldown: number;
} {
  return {
    x: 0.35, z: 3.55, vx: 0, vz: 0, yaw: Math.PI,
    hp: 100, hpMax: 100, sta: 100, flasks: 4,
    act: "free" as Act, actT: 0, atk: null,
    hitDone: false, invuln: 0, nearFire: false,
    healed: false, dropped: null, ash: 0,
    runMs: 0, clears: 0, wind: 0, stun: 0,
    combo: 0, comboTimer: 0, lastAttackTime: 0,
    parryActive: false, parryTimer: 0, parryCooldown: 0,
  };
}

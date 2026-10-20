/** 招式數字表。調前搖、傷害、體力都改這裡，不要散落在模擬裡。 */

export { SAVE_KEY } from "@/game/saveManager";
export const STEP = 1 / 60;
export const STA_MAX = 100;
export const FLASK_MAX = 4;
export const WALK = 3.05;
export const RUN = 5.35;
export const FIRE = { x: -3.1, z: 0.2 };
export const SPAWN = { x: 0.35, z: 3.55 };
export const GATE_Z = -8;
export const MIN_X = -11;
export const MAX_X = 11;
export const MIN_Z = -18;
export const MAX_Z = 8.2;
export const PILLARS = [
  { x: -6.5, z: -8, r: 0.55 },
  { x: 6.5, z: -8, r: 0.55 },
  { x: -8.6, z: 2.2, r: 0.48 },
  { x: 8.6, z: 2.2, r: 0.48 },
  { x: -8.6, z: -13.2, r: 0.48 },
  { x: 8.6, z: -13.2, r: 0.48 },
];

export const LIGHT_COMBO_DMGS = [20, 25, 35] as const;
export const LIGHT_COMBO_MAX = LIGHT_COMBO_DMGS.length;

export const MOVE = {
  lightCost: 16,
  heavyCost: 34,
  dodgeCost: 28,
  /** First-hit light damage (same as LIGHT_COMBO_DMGS[0]). */
  lightDmg: 20,
  heavyDmg: 46,
  lightOpen: 0.12,
  lightShut: 0.3,
  /** Light attack total lock (0.8.29: 0.50→0.46; post-shut recover shorter; open/shut unchanged). */
  lightEnd: 0.46,
  heavyOpen: 0.32,
  heavyShut: 0.5,
  heavyEnd: 0.84,
  /** Seconds after a light hit ends to chain the next (must press again). */
  lightComboWindow: 0.92,
  /** Short recovery after combo ends (3rd hit or window timeout). */
  lightComboRecover: 0.22,
  duke: {
    overheadTell: 1.34,
    shockTell: 1.12,
    rushTell: 1.08,
    cleaveTell: 1.06,
    phase2Slow: 0.9,
    rushRecover: 1.02,
    rushRecoverP2: 1.28,
    shockRecover: 1.22,
    overheadRecover: 1.12,
  },
} as const;

/** Damage for light hit index 0..2 (clamped). */
export function lightComboDamage(hitIndex: number): number {
  const i = Math.max(0, Math.min(LIGHT_COMBO_MAX - 1, hitIndex | 0));
  return LIGHT_COMBO_DMGS[i]!;
}

/**
 * Next 0-based light hit index when the player presses light.
 * `completedHits` is how many lights already landed in this chain (0..3);
 * `inWindow` is true while the post-hit chain window is open.
 */
export function nextLightHitIndex(completedHits: number, inWindow: boolean): number {
  if (inWindow && completedHits > 0 && completedHits < LIGHT_COMBO_MAX) return completedHits;
  return 0;
}

/** After light swing `hitIndex` (0..2) finishes: open window or enter recover. */
export function afterLightHitEnd(hitIndex: number): {
  completedHits: number;
  kind: "window" | "recover";
  duration: number;
} {
  const completed = hitIndex + 1;
  if (completed >= LIGHT_COMBO_MAX) {
    return { completedHits: 0, kind: "recover", duration: MOVE.lightComboRecover };
  }
  return { completedHits: completed, kind: "window", duration: MOVE.lightComboWindow };
}

export type LightComboPhase = "idle" | "window" | "recover";

export type LightComboState = {
  /** Completed hits in the open chain (0..2 while window; 0 when idle/recover). */
  completedHits: number;
  phase: LightComboPhase;
  /** Time left in window or recover. */
  timer: number;
};

export function createLightComboState(): LightComboState {
  return { completedHits: 0, phase: "idle", timer: 0 };
}

export function canStartLightCombo(state: LightComboState): boolean {
  return state.phase !== "recover";
}

/** Commit a light press: returns hit index and updated state (attacking — timers cleared). */
export function beginLightComboHit(state: LightComboState): { hitIndex: number; state: LightComboState } {
  const inWindow = state.phase === "window" && state.timer > 0;
  const hitIndex = nextLightHitIndex(state.completedHits, inWindow);
  return {
    hitIndex,
    state: { completedHits: hitIndex, phase: "idle", timer: 0 },
  };
}

/** Light attack animation ended. */
export function finishLightComboHit(state: LightComboState): LightComboState {
  const result = afterLightHitEnd(state.completedHits);
  return {
    completedHits: result.completedHits,
    phase: result.kind,
    timer: result.duration,
  };
}

/** Tick window / recover timers. Call only while not mid-attack. */
export function tickLightCombo(state: LightComboState, dt: number): LightComboState {
  if (state.phase === "idle" || state.timer <= 0) {
    if (state.phase === "window") {
      return { completedHits: 0, phase: "recover", timer: MOVE.lightComboRecover };
    }
    if (state.phase === "recover") {
      return createLightComboState();
    }
    return state;
  }
  const timer = state.timer - dt;
  if (timer > 0) return { ...state, timer };
  if (state.phase === "window") {
    return { completedHits: 0, phase: "recover", timer: MOVE.lightComboRecover };
  }
  return createLightComboState();
}

/** Break the chain (heavy, hurt, dodge, etc.). */
export function breakLightCombo(_state?: LightComboState): LightComboState {
  return createLightComboState();
}

export type Act = "free" | "attack" | "dodge" | "drink" | "hurt" | "block";
export type FoeState = "idle" | "chase" | "roar" | "telegraph" | "swing" | "recover" | "hurt" | "dodge" | "drink" | "dead";
export type DukeMove = "cleave" | "overhead" | "shock" | "rush";

export type Foe = {
  id: number;
  name: string;
  kind: "hollow" | "duke" | "demon";
  x: number;
  z: number;
  yaw: number;
  baseYaw: number;
  hp: number;
  hpMax: number;
  r: number;
  speed: number;
  dmg: number;
  range: number;
  windup: number;
  aggroR: number;
  state: FoeState;
  t: number;
  cd: number;
  swung: boolean;
  flash: number;
  aggro: boolean;
  move: DukeMove;
  enraged: boolean;
  chain: number;
  span: number;
  aimX: number;
  aimZ: number;
  poise: number;
  poiseMax: number;
  stagger: number;
};

export function hash(i: number) {
  const x = Math.sin(i * 127.1 + 3.1) * 43758.5453;
  return x - Math.floor(x);
}

export function dampAngle(current: number, target: number, speed: number, dt: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const max = speed * dt;
  return current + Math.max(-max, Math.min(max, diff));
}

export function template(): Foe[] {
  const row = (
    id: number,
    name: string,
    kind: Foe["kind"],
    x: number,
    z: number,
    hp: number,
    speed: number,
    dmg: number,
    range: number,
    windup: number,
    aggroR: number,
    r: number,
  ): Foe => ({
    id,
    name,
    kind,
    x,
    z,
    yaw: Math.PI,
    baseYaw: Math.PI,
    hp,
    hpMax: hp,
    r,
    speed,
    dmg,
    range,
    windup,
    aggroR,
    state: "idle",
    t: 0,
    cd: 0.4,
    swung: false,
    flash: 0,
    aggro: false,
    move: "cleave",
    enraged: false,
    chain: 0,
    span: 1,
    aimX: 0,
    aimZ: 0,
    poise: 0,
    poiseMax: kind === "duke" ? 86 : kind === "demon" ? 48 : id === 3 ? 36 : 52,
    stagger: 0,
  });
  return [
    row(1, "側翼灰殼", "hollow", -5.8, -3.8, 58, 1.7, 22, 1.55, 1.08, 3.1, 0.42),
    row(2, "側翼灰殼", "hollow", 5.6, -4.0, 58, 1.7, 22, 1.55, 1.08, 3.1, 0.42),
    row(3, "路中灰殼", "hollow", 0.15, -4.5, 64, 1.75, 14, 1.55, 0.62, 5.2, 0.44),
    row(4, "煤灰公爵", "duke", 0, -14.1, 280, 1.7, 30, 2.15, 0.96, 10, 0.78),
    row(5, "紅契", "demon", 42, 42, 150, 2.65, 16, 1.7, 0.4, 7, 0.4),
  ];
}

export function dukeTell(move: DukeMove, p2: boolean) {
  const base =
    move === "overhead"
      ? MOVE.duke.overheadTell
      : move === "shock"
        ? MOVE.duke.shockTell
        : move === "rush"
          ? MOVE.duke.rushTell
          : MOVE.duke.cleaveTell;
  return base * (p2 ? MOVE.duke.phase2Slow : 1);
}

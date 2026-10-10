/** 招式數字表。調前搖、傷害、體力都改這裡，不要散落在模擬裡。 */

export const SAVE_KEY = "mallow-ashen-vow-v1";
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

export const MOVE = {
  lightCost: 16,
  heavyCost: 34,
  dodgeCost: 28,
  lightDmg: 20,
  heavyDmg: 46,
  lightOpen: 0.12,
  lightShut: 0.3,
  lightEnd: 0.5,
  heavyOpen: 0.32,
  heavyShut: 0.5,
  heavyEnd: 0.78,
  duke: {
    overheadTell: 1.34,
    shockTell: 1.12,
    rushTell: 1.08,
    cleaveTell: 1.06,
    phase2Slow: 0.9,
    rushRecover: 0.92,
    rushRecoverP2: 1.28,
    shockRecover: 1.22,
    overheadRecover: 1.12,
  },
} as const;

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

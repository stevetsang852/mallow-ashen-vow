/**
 * PREVIS SHOT A–G
 * ---------------
 * Public `/` timeline. Animation Designer storyboard (2026-10-26), shots A–G.
 * Camera and blocking live here. Clip ids and the AnimationMixer live in
 * `clips.ts`. `src/routes/index.tsx` only mounts the player.
 *
 * Greybox structure, not lookdev. No Seedance, `@theatre/studio`, or CozyClay.
 * The sequence loops. Pause holds the clock (the player does not integrate
 * clip time), so a freeze resumes on the same beat.
 *
 * Durations are the storyboard windows: A 2.2s, B 0.4s, C 0.6+0.9s, D 1.2s,
 * E 2.5s, F = duke charge, G 3.0s.
 */
import {
  CLIP_CONTRACTS,
  cueFromClip,
  type ClipPlay,
  type CueKind,
} from "@/previs/clips";

const LIGHT_S = CLIP_CONTRACTS.mallow_atk_light.seconds;
const HEAVY_S = CLIP_CONTRACTS.mallow_atk_heavy.seconds;
const ROLL_S = CLIP_CONTRACTS.mallow_roll.seconds;
const CHARGE_S = CLIP_CONTRACTS.duke_charge.seconds;

/** Roll begins just after the charge lean so the white i-frame sits in the rush. */
export const CHARGE_ROLL_START = 0.32;

export const STORY_SHOTS = [
  { id: "A", seconds: 2.2, label: "火芯醒來" },
  { id: "B", seconds: 0.4, label: "鎖敵" },
  { id: "C", seconds: LIGHT_S + HEAVY_S, label: "輕重懲戒" },
  { id: "D", seconds: 1.2, label: "灰燼拾取" },
  { id: "E", seconds: 2.5, label: "拱門 · 公爵" },
  { id: "F", seconds: CHARGE_S, label: "衝鋒懲戒" },
  { id: "G", seconds: 3, label: "靜勝 · 冷霧" },
] as const;

export type ShotId = (typeof STORY_SHOTS)[number]["id"];

export const SHOT = {
  seconds: STORY_SHOTS.reduce((sum, shot) => sum + shot.seconds, 0),
} as const;

export type Vec3 = { x: number; y: number; z: number };

export type CameraSample = { pos: Vec3; look: Vec3; fov: number };

export type PoseSample = {
  x: number;
  z: number;
  yaw: number;
  crouch: number;
  sheath: number;
  earFlick: number;
  /** 0 = cloak still settling, 1 = settled. */
  settle: number;
};

export type CueSample = {
  kind: CueKind;
  scale: number;
  anchor: "mallow" | "shell" | "duke";
};

export type GradeSample = {
  /** 1 warm firecore fog, 0 cool win grade. */
  warm: number;
  exposure: number;
  fire: number;
};

export type StageSample = {
  cloth: number;
  dukeWake: number;
  shellAlive: number;
  ash: number;
  ashRing: number;
  shellLean: Vec3;
  shellShield: Vec3;
  shellHood: Vec3;
};

/** Greybox set the cameras are blocked against. */
export const SET = {
  fire: { x: 0, y: 0, z: 0 },
  duke: { x: 0, y: 0, z: 11.05, yaw: Math.PI },
  arch: { x: 0, y: 2.4, z: 11.15 },
} as const;

type CamKey = { t: number; pos: Vec3; look: Vec3; fov: number };
type BlockKey = { t: number; x: number; z: number; yaw: number; crouch: number };

const CAMERA: Record<Exclude<ShotId, "G">, readonly CamKey[]> = {
  A: [
    { t: 0, pos: { x: 1.85, y: 1.52, z: -1.15 }, look: { x: 0.15, y: 0.85, z: 0.9 }, fov: 40 },
    { t: 0.6, pos: { x: 1.7, y: 1.48, z: -0.55 }, look: { x: 0.2, y: 0.95, z: 1.5 }, fov: 40 },
    { t: 1, pos: { x: 1.45, y: 1.46, z: 0.15 }, look: { x: 0.18, y: 1.05, z: 2.4 }, fov: 38 },
  ],
  B: [
    { t: 0, pos: { x: 1.45, y: 1.46, z: 0.15 }, look: { x: 0.18, y: 1.05, z: 2.4 }, fov: 38 },
    { t: 1, pos: { x: 0.42, y: 1.28, z: 3.35 }, look: { x: 0.05, y: 1.2, z: 6.15 }, fov: 30 },
  ],
  C: [
    { t: 0, pos: { x: 1.8, y: 1.55, z: 1.15 }, look: { x: 0.15, y: 1.05, z: 4.6 }, fov: 38 },
    { t: 0.16, pos: { x: 1.55, y: 1.42, z: 2.05 }, look: { x: 0.08, y: 1.05, z: 5.2 }, fov: 34 },
    { t: 0.18, pos: { x: 1.45, y: 1.38, z: 2.25 }, look: { x: 0.06, y: 1.02, z: 5.35 }, fov: 48 },
    { t: 0.24, pos: { x: 1.4, y: 1.4, z: 2.45 }, look: { x: 0.06, y: 1.04, z: 5.4 }, fov: 34 },
    { t: 0.68, pos: { x: 1.25, y: 1.32, z: 3.15 }, look: { x: 0.04, y: 1.0, z: 5.6 }, fov: 32 },
    { t: 0.73, pos: { x: 1.15, y: 1.28, z: 3.35 }, look: { x: 0.02, y: 0.98, z: 5.7 }, fov: 50 },
    { t: 0.8, pos: { x: 1.2, y: 1.32, z: 3.2 }, look: { x: 0.04, y: 1.02, z: 5.5 }, fov: 34 },
    { t: 1, pos: { x: 1.35, y: 1.4, z: 2.9 }, look: { x: 0.06, y: 1.0, z: 5.4 }, fov: 36 },
  ],
  D: [
    { t: 0, pos: { x: 1.05, y: 1.2, z: 3.55 }, look: { x: 0.05, y: 0.45, z: 5.9 }, fov: 38 },
    { t: 1, pos: { x: 1.2, y: 2.45, z: 2.85 }, look: { x: 0.1, y: 0.4, z: 5.75 }, fov: 40 },
  ],
  E: [
    { t: 0, pos: { x: 4.6, y: 1.85, z: 1.4 }, look: { x: 0.1, y: 1.6, z: 10.2 }, fov: 50 },
    { t: 0.45, pos: { x: 3.4, y: 1.7, z: 3.2 }, look: { x: 0, y: 2.05, z: 10.6 }, fov: 46 },
    { t: 1, pos: { x: 1.8, y: 1.42, z: 5.6 }, look: { x: 0, y: 2.65, z: 10.45 }, fov: 38 },
  ],
  F: [
    { t: 0, pos: { x: 3.4, y: 1.8, z: 8.2 }, look: { x: 0.1, y: 1.5, z: 11.0 }, fov: 42 },
    { t: 0.18, pos: { x: 3.2, y: 1.65, z: 6.4 }, look: { x: 0.4, y: 1.3, z: 8.5 }, fov: 42 },
    { t: 0.28, pos: { x: 3.0, y: 1.5, z: 4.4 }, look: { x: 1.2, y: 1.15, z: 6.4 }, fov: 40 },
    { t: 0.45, pos: { x: 2.8, y: 1.45, z: 4.2 }, look: { x: 1.3, y: 1.15, z: 6.2 }, fov: 40 },
    { t: 0.8, pos: { x: 2.6, y: 1.42, z: 4.3 }, look: { x: 0.6, y: 1.25, z: 6.6 }, fov: 38 },
    { t: 1, pos: { x: 2.55, y: 1.4, z: 4.25 }, look: { x: 0.55, y: 1.28, z: 6.55 }, fov: 38 },
  ],
};

const BLOCK: Record<ShotId, readonly BlockKey[]> = {
  A: [
    { t: 0, x: 0.36, z: 1.55, yaw: 0.22, crouch: 0.42 },
    { t: 0.55, x: 0.34, z: 1.72, yaw: 0.08, crouch: 0.06 },
    { t: 1, x: 0.3, z: 1.9, yaw: 0, crouch: 0 },
  ],
  B: [
    { t: 0, x: 0.3, z: 1.9, yaw: 0, crouch: 0 },
    { t: 1, x: 0.18, z: 2.55, yaw: -0.04, crouch: 0 },
  ],
  C: [
    { t: 0, x: 0.18, z: 2.55, yaw: 0, crouch: 0 },
    { t: 0.35, x: 0.06, z: 4.15, yaw: 0.02, crouch: 0.04 },
    { t: 0.5, x: 0.04, z: 4.35, yaw: 0.02, crouch: 0.02 },
    { t: 0.62, x: 0.02, z: 4.5, yaw: 0, crouch: 0.12 },
    { t: 1, x: 0, z: 4.85, yaw: 0, crouch: 0.02 },
  ],
  D: [
    { t: 0, x: 0, z: 4.85, yaw: 0.08, crouch: 0.08 },
    { t: 1, x: 0.12, z: 4.55, yaw: 0.35, crouch: 0.16 },
  ],
  E: [
    { t: 0, x: 0.12, z: 4.55, yaw: 0.1, crouch: 0 },
    { t: 1, x: 0.28, z: 4.25, yaw: -0.02, crouch: 0 },
  ],
  F: [
    { t: 0, x: 0.28, z: 4.25, yaw: 0, crouch: 0 },
    { t: 0.18, x: 1.4, z: 5.9, yaw: 0.45, crouch: 0.04 },
    { t: 0.32, x: 1.65, z: 6.15, yaw: 0.95, crouch: 0.1 },
    { t: 0.55, x: 1.5, z: 6.3, yaw: 0.3, crouch: 0 },
    { t: 1, x: 0.55, z: 5.95, yaw: -0.08, crouch: 0 },
  ],
  G: [
    { t: 0, x: 0.5, z: 5.9, yaw: 0.2, crouch: 0 },
    { t: 0.45, x: 0.38, z: 3.1, yaw: 0.55, crouch: 0 },
    { t: 1, x: 0.34, z: 1.85, yaw: 0.15, crouch: 0 },
  ],
};

const SHELL_HOME = {
  lean: { x: 0.05, z: 6.15, fromX: 0.2, fromZ: 8.5 },
  shield: { x: -1.35, z: 5.7, fromX: -1.7, fromZ: 8.15 },
  hood: { x: 1.28, z: 6.05, fromX: 1.55, fromZ: 8.3 },
} as const;

export function wrap01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const u = t % 1;
  return u < 0 ? u + 1 : u;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export type LocatedShot = {
  id: ShotId;
  label: string;
  index: number;
  /** 0..1 inside the shot. */
  local: number;
  localSeconds: number;
  globalSeconds: number;
};

export function locate(u: number): LocatedShot {
  const globalSeconds = wrap01(u) * SHOT.seconds;
  let acc = 0;
  for (let i = 0; i < STORY_SHOTS.length; i += 1) {
    const shot = STORY_SHOTS[i];
    const next = acc + shot.seconds;
    if (globalSeconds < next || i === STORY_SHOTS.length - 1) {
      const localSeconds = Math.min(shot.seconds, Math.max(0, globalSeconds - acc));
      return {
        id: shot.id,
        label: shot.label,
        index: i,
        local: shot.seconds <= 0 ? 0 : localSeconds / shot.seconds,
        localSeconds,
        globalSeconds,
      };
    }
    acc = next;
  }
  const first = STORY_SHOTS[0];
  return { id: first.id, label: first.label, index: 0, local: 0, localSeconds: 0, globalSeconds: 0 };
}

/** Global 0..1 at `localSeconds` into a shot. */
export function uAt(id: ShotId, localSeconds: number): number {
  let acc = 0;
  for (const shot of STORY_SHOTS) {
    if (shot.id === id) {
      const clamped = Math.min(shot.seconds, Math.max(0, localSeconds));
      return (acc + clamped) / SHOT.seconds;
    }
    acc += shot.seconds;
  }
  return 0;
}

function sampleChannel<T extends { t: number }>(keys: readonly T[], t: number, pick: (key: T) => number) {
  const u = Math.min(1, Math.max(0, t));
  let i = 0;
  const last = keys.length - 1;
  while (i < last - 1 && keys[i + 1].t < u) i += 1;
  const a = keys[i];
  const b = keys[Math.min(last, i + 1)];
  const span = b.t - a.t;
  const k = span <= 1e-8 ? 0 : Math.min(1, Math.max(0, (u - a.t) / span));
  return pick(a) + (pick(b) - pick(a)) * k;
}

function sampleVec(keys: readonly CamKey[], t: number, which: "pos" | "look"): Vec3 {
  return {
    x: sampleChannel(keys, t, (key) => key[which].x),
    y: sampleChannel(keys, t, (key) => key[which].y),
    z: sampleChannel(keys, t, (key) => key[which].z),
  };
}

/** Shot G: slow 15° orbit as Mallow returns to the fire. */
function orbitCamera(local: number): CameraSample {
  const k = Math.min(1, Math.max(0, local));
  const look = {
    x: lerp(0.45, 0.34, k),
    y: 1.05,
    z: lerp(4.2, 1.9, smooth(k)),
  };
  const sweep = (15 * Math.PI) / 180;
  const angle = 0.72 + sweep * k;
  const radius = lerp(3.6, 3.15, k);
  return {
    pos: {
      x: look.x + Math.sin(angle) * radius,
      y: lerp(1.7, 1.58, k),
      z: look.z + Math.cos(angle) * radius,
    },
    look,
    fov: lerp(38, 36, k),
  };
}

export function sampleCamera(u: number): CameraSample {
  const loc = locate(u);
  if (loc.id === "G") return orbitCamera(loc.local);
  const keys = CAMERA[loc.id];
  return {
    pos: sampleVec(keys, loc.local, "pos"),
    look: sampleVec(keys, loc.local, "look"),
    fov: sampleChannel(keys, loc.local, (key) => key.fov),
  };
}

export function samplePose(u: number): PoseSample {
  const loc = locate(u);
  const keys = BLOCK[loc.id];
  const sheath = loc.id === "G" ? smooth(Math.max(0, (loc.local - 0.35) / 0.65)) : 0;
  const earFlick = loc.id === "B" ? Math.sin(loc.local * Math.PI * 5) * (1 - loc.local) * 0.55 : 0;
  const settle = loc.id === "A" ? smooth(loc.local) : 1;
  return {
    x: sampleChannel(keys, loc.local, (key) => key.x),
    z: sampleChannel(keys, loc.local, (key) => key.z),
    yaw: sampleChannel(keys, loc.local, (key) => key.yaw),
    crouch: sampleChannel(keys, loc.local, (key) => key.crouch),
    sheath,
    earFlick,
    settle,
  };
}

function idleTime(globalSeconds: number) {
  const duration = CLIP_CONTRACTS.mallow_idle_ready.seconds;
  return ((globalSeconds % duration) + duration) % duration;
}

function idlePlay(globalSeconds: number): ClipPlay {
  return { id: "mallow_idle_ready", time: idleTime(globalSeconds), loop: true };
}

/** Which greybox clips the mixer should be showing at this point in the loop. */
export function clipPlan(u: number): ClipPlay[] {
  const loc = locate(u);
  switch (loc.id) {
    case "C":
      if (loc.localSeconds < LIGHT_S) {
        return [{ id: "mallow_atk_light", time: loc.localSeconds, loop: false }];
      }
      return [{ id: "mallow_atk_heavy", time: loc.localSeconds - LIGHT_S, loop: false }];
    case "F": {
      const plays: ClipPlay[] = [{ id: "duke_charge", time: loc.localSeconds, loop: false }];
      if (loc.localSeconds >= CHARGE_ROLL_START && loc.localSeconds < CHARGE_ROLL_START + ROLL_S) {
        plays.push({ id: "mallow_roll", time: loc.localSeconds - CHARGE_ROLL_START, loop: false });
      } else {
        plays.push(idlePlay(loc.globalSeconds));
      }
      return plays;
    }
    default:
      return [idlePlay(loc.globalSeconds)];
  }
}

const CUE_RANK: Record<CueKind, number> = {
  none: 0,
  orange: 1,
  pink: 2,
  white: 3,
  diamond: 4,
};

export function cueAt(u: number): CueSample {
  const loc = locate(u);
  if (loc.id === "B") {
    const pop = loc.local < 0.4 ? loc.local / 0.4 : 1;
    return { kind: "diamond", scale: 0.4 + pop * 1.2, anchor: "shell" };
  }
  let best: CueSample = { kind: "none", scale: 1, anchor: "mallow" };
  for (const play of clipPlan(u)) {
    const contract = CLIP_CONTRACTS[play.id];
    const norm = play.time / contract.seconds;
    const cue = cueFromClip(play.id, norm);
    if (!cue) continue;
    const anchor = contract.owner === "duke" ? "duke" : contract.owner === "shell" ? "shell" : "mallow";
    if (CUE_RANK[cue.kind] >= CUE_RANK[best.kind]) {
      best = { kind: cue.kind, scale: cue.scale, anchor };
    }
  }
  return best;
}

function approach(local: number) {
  return smooth(local);
}

function shellPoint(
  home: { x: number; z: number; fromX: number; fromZ: number },
  loc: LocatedShot,
  retreat: number,
): Vec3 {
  const k = loc.id === "A" ? approach(loc.local) : 1;
  return {
    x: lerp(home.fromX, home.x, k) + retreat * 0.35,
    y: 0,
    z: lerp(home.fromZ, home.z, k) + retreat * 0.85,
  };
}

export function sampleStage(u: number): StageSample {
  const loc = locate(u);
  const after = (id: ShotId) => loc.index > STORY_SHOTS.findIndex((shot) => shot.id === id);
  const cloth = loc.id === "E" ? smooth(Math.max(0, (loc.local - 0.08) / 0.45)) : after("E") ? 1 : 0;
  const dukeWake = loc.id === "E" ? smooth(Math.max(0, (loc.local - 0.2) / 0.6)) : after("E") ? 1 : 0;
  const shellAlive = loc.id === "D" ? 1 - smooth(loc.local) : after("D") ? 0 : 1;
  const ash = loc.id === "D" ? smooth(loc.local) : after("D") ? 1 : 0;
  const retreat = loc.id === "E" ? smooth(Math.min(1, loc.local / 0.55)) : after("E") ? 1 : 0;
  return {
    cloth,
    dukeWake,
    shellAlive,
    ash,
    ashRing: ash,
    shellLean: shellPoint(SHELL_HOME.lean, loc, 0),
    shellShield: shellPoint(SHELL_HOME.shield, loc, retreat),
    shellHood: shellPoint(SHELL_HOME.hood, loc, retreat),
  };
}

export function sampleGrade(u: number): GradeSample {
  const loc = locate(u);
  if (loc.id === "A") {
    return { warm: lerp(1, 0.82, loc.local), exposure: lerp(1.1, 1.04, loc.local), fire: 1 };
  }
  if (loc.id === "G") {
    const k = smooth(loc.local);
    return { warm: lerp(0.35, 0, k), exposure: lerp(0.98, 0.78, k), fire: lerp(0.75, 0.22, k) };
  }
  return { warm: 0.5, exposure: 1.02, fire: 1 };
}

const CUE_LABEL: Record<CueKind, string> = {
  none: "",
  orange: " · 橙圈",
  pink: " · 粉圈",
  white: " · 白圈",
  diamond: " · 粉菱",
};

/** On-screen beat, including the readability cue when one is up. */
export function beatAt(u: number): string {
  const loc = locate(u);
  return `${loc.id} · ${loc.label}${CUE_LABEL[cueAt(u).kind]}`;
}

export type PrevisFrameSample = {
  shot: ShotId;
  label: string;
  local: number;
  localSeconds: number;
  camera: CameraSample;
  pose: PoseSample;
  cue: CueSample;
  grade: GradeSample;
  stage: StageSample;
  clips: ClipPlay[];
};

export function sampleFrame(u: number): PrevisFrameSample {
  const loc = locate(u);
  return {
    shot: loc.id,
    label: loc.label,
    local: loc.local,
    localSeconds: loc.localSeconds,
    camera: sampleCamera(u),
    pose: samplePose(u),
    cue: cueAt(u),
    grade: sampleGrade(u),
    stage: sampleStage(u),
    clips: clipPlan(u),
  };
}

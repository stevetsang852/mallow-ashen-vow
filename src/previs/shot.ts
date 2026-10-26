/**
 * PREVIS SHOT HOOK
 * ----------------
 * Public loop timing lives in this file. Refine the dolly and the blocking
 * performance by editing CAMERA_KEYS and POSE_KEYS. `src/routes/index.tsx`
 * only mounts the player — do not grow shot logic there.
 *
 * This pass is STRUCTURE (white / greybox blocking + a camera path), not
 * appearance. Concept art and materials come later. Do not add a Seedance or
 * any other AI-video runtime, `@theatre/studio`, or CozyClay.
 *
 * Workflow note (2026-10-26): lock character motion and camera together
 * before lookdev. Learn the previs workflow only — do not copy outside
 * frames, characters, or music into this shot.
 *
 * Loop length is SHOT.seconds (keep it about 5–8s). The keys at t = 0 and
 * t = 1 are the same pose and the same camera, so the beat can repeat.
 */

export const SHOT = {
  /** Loop length in seconds. */
  seconds: 6.5,
} as const;

export type Vec3 = { x: number; y: number; z: number };

export type CameraKey = {
  /** 0..1 along the loop. Include both 0 and 1. */
  t: number;
  pos: Vec3;
  look: Vec3;
};

export type PoseKey = {
  t: number;
  x: number;
  z: number;
  /** Yaw of the root. 0 faces +Z (toward the duke block). */
  yaw: number;
  /** Weapon pitch. Larger values tip the blade forward. */
  swordX: number;
  /** Weapon roll. */
  swordZ: number;
  headYaw: number;
  headPitch: number;
  /** 0 = feet planted, 1 = full step. */
  stride: number;
};

/** Greybox set dressing the camera is blocked against. Move these with the keys. */
export const SET = {
  fire: { x: 0, y: 0, z: 0 },
  duke: { x: 0, y: 0, z: 10.4, yaw: Math.PI },
} as const;

/**
 * Dolly: fire-core foreground → track Mallow down the hall → 3/4 push on the
 * raised sword and the duke block → crane back to the opening frame.
 */
export const CAMERA_KEYS: readonly CameraKey[] = [
  { t: 0, pos: { x: 2.55, y: 1.62, z: -1.45 }, look: { x: 0.28, y: 1.05, z: 2.5 } },
  { t: 0.18, pos: { x: 1.65, y: 1.48, z: 0.55 }, look: { x: 0.22, y: 1.12, z: 3.7 } },
  { t: 0.4, pos: { x: -1.4, y: 1.52, z: 3.05 }, look: { x: 0.16, y: 1.2, z: 6.4 } },
  { t: 0.64, pos: { x: -1.85, y: 1.78, z: 4.55 }, look: { x: 0.12, y: 1.42, z: 9.8 } },
  { t: 0.8, pos: { x: 0.7, y: 2.65, z: 2.15 }, look: { x: 0.18, y: 1.28, z: 7.4 } },
  { t: 0.92, pos: { x: 2.15, y: 2.05, z: -0.35 }, look: { x: 0.32, y: 1.08, z: 3.1 } },
  { t: 1, pos: { x: 2.55, y: 1.62, z: -1.45 }, look: { x: 0.28, y: 1.05, z: 2.5 } },
];

/**
 * Blocking performance. Not a combat loop: walk out, hold a raised sword
 * toward the duke silhouette, walk back to the fire.
 */
export const POSE_KEYS: readonly PoseKey[] = [
  {
    t: 0,
    x: 0.42,
    z: 1.9,
    yaw: 0.2,
    swordX: 1.05,
    swordZ: 0.42,
    headYaw: -0.38,
    headPitch: 0.08,
    stride: 0,
  },
  {
    t: 0.12,
    x: 0.42,
    z: 1.9,
    yaw: 0.06,
    swordX: 1.0,
    swordZ: 0.38,
    headYaw: -0.04,
    headPitch: 0.02,
    stride: 0,
  },
  {
    t: 0.18,
    x: 0.32,
    z: 2.45,
    yaw: 0.02,
    swordX: 0.95,
    swordZ: 0.36,
    headYaw: 0.04,
    headPitch: 0,
    stride: 1,
  },
  {
    t: 0.38,
    x: 0.12,
    z: 5.05,
    yaw: 0,
    swordX: 0.9,
    swordZ: 0.32,
    headYaw: 0.1,
    headPitch: -0.02,
    stride: 1,
  },
  {
    t: 0.46,
    x: 0.1,
    z: 5.2,
    yaw: -0.06,
    swordX: 0.28,
    swordZ: 0.12,
    headYaw: 0.14,
    headPitch: -0.06,
    stride: 0,
  },
  {
    t: 0.68,
    x: 0.1,
    z: 5.2,
    yaw: -0.08,
    swordX: -0.2,
    swordZ: 0.04,
    headYaw: 0.2,
    headPitch: -0.14,
    stride: 0,
  },
  {
    t: 0.76,
    x: 0.16,
    z: 4.55,
    yaw: 0.02,
    swordX: 0.55,
    swordZ: 0.22,
    headYaw: 0.08,
    headPitch: -0.02,
    stride: 1,
  },
  {
    t: 0.9,
    x: 0.42,
    z: 1.9,
    yaw: 0.16,
    swordX: 1.02,
    swordZ: 0.4,
    headYaw: -0.22,
    headPitch: 0.05,
    stride: 0.15,
  },
  {
    t: 1,
    x: 0.42,
    z: 1.9,
    yaw: 0.2,
    swordX: 1.05,
    swordZ: 0.42,
    headYaw: -0.38,
    headPitch: 0.08,
    stride: 0,
  },
];

export function wrap01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const u = t % 1;
  return u < 0 ? u + 1 : u;
}

function lerpChannel<T extends { t: number }>(
  keys: readonly T[],
  u: number,
  pick: (key: T) => number,
): number {
  const t = wrap01(u);
  let i = 0;
  const last = keys.length - 1;
  while (i < last - 1 && keys[i + 1].t < t) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  const k = span <= 1e-8 ? 0 : Math.min(1, Math.max(0, (t - a.t) / span));
  return pick(a) + (pick(b) - pick(a)) * k;
}

export function sampleCamera(u: number): { pos: Vec3; look: Vec3 } {
  return {
    pos: {
      x: lerpChannel(CAMERA_KEYS, u, (k) => k.pos.x),
      y: lerpChannel(CAMERA_KEYS, u, (k) => k.pos.y),
      z: lerpChannel(CAMERA_KEYS, u, (k) => k.pos.z),
    },
    look: {
      x: lerpChannel(CAMERA_KEYS, u, (k) => k.look.x),
      y: lerpChannel(CAMERA_KEYS, u, (k) => k.look.y),
      z: lerpChannel(CAMERA_KEYS, u, (k) => k.look.z),
    },
  };
}

export type PoseSample = Omit<PoseKey, "t"> & {
  /** Leg swing in radians. Zero when stride is zero. */
  step: number;
};

export function samplePose(u: number): PoseSample {
  const t = wrap01(u);
  const stride = lerpChannel(POSE_KEYS, t, (k) => k.stride);
  // Phase is zero at the start of the outbound walk so the first step eases in.
  const step = Math.sin((t - 0.12) * Math.PI * 2 * 3.1) * stride * 0.62;
  return {
    x: lerpChannel(POSE_KEYS, t, (k) => k.x),
    z: lerpChannel(POSE_KEYS, t, (k) => k.z),
    yaw: lerpChannel(POSE_KEYS, t, (k) => k.yaw),
    swordX: lerpChannel(POSE_KEYS, t, (k) => k.swordX),
    swordZ: lerpChannel(POSE_KEYS, t, (k) => k.swordZ),
    headYaw: lerpChannel(POSE_KEYS, t, (k) => k.headYaw),
    headPitch: lerpChannel(POSE_KEYS, t, (k) => k.headPitch),
    stride,
    step,
  };
}

/** On-screen beat name for the current point in the loop. */
export function beatAt(u: number): string {
  const t = wrap01(u);
  if (t < 0.12) return "火芯 · 待機";
  if (t < 0.46) return "走向剪影";
  if (t < 0.72) return "舉劍 · 停格";
  if (t < 0.9) return "退回火芯";
  return "鏡頭收回";
}

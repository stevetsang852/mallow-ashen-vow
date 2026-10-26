/**
 * CLIP CONTRACTS — Animation Designer storyboard §5 (2.0.5 → previs 2.0.6).
 * Greybox clips are procedural AnimationClips on pose proxies. Swap in skinned
 * clips later without renaming these ids. No Seedance, Theatre, or CozyClay.
 */
import * as THREE from "three";

export const CLIP_IDS = [
  "mallow_idle_ready",
  "mallow_atk_light",
  "mallow_atk_heavy",
  "mallow_block_hold",
  "mallow_deflect",
  "mallow_roll",
  "shell_atk_horiz",
  "duke_charge",
  "duke_stance_break",
  "red_intrude",
] as const;

export type ClipId = (typeof CLIP_IDS)[number];

export type ClipOwner = "player" | "shell" | "duke" | "red";

export type ClipEvent = {
  name: string;
  /** Normalized 0..1. */
  t: number;
  /** Inclusive end for a window. Omit for a marker. */
  tEnd?: number;
};

export type ClipContract = {
  id: ClipId;
  owner: ClipOwner;
  loop: boolean;
  seconds: number;
  events: readonly ClipEvent[];
};

/** Pose proxies the mixer writes. Names are the AnimationClip track targets. */
export const POSE_NODES = {
  mallow: "mallow-pose",
  shell: "shell-pose",
  duke: "duke-pose",
  red: "red-pose",
} as const;

const M = POSE_NODES.mallow;
const S = POSE_NODES.shell;
const D = POSE_NODES.duke;
const R = POSE_NODES.red;

export const CLIP_CONTRACTS: { readonly [K in ClipId]: ClipContract } = {
  mallow_idle_ready: {
    id: "mallow_idle_ready",
    owner: "player",
    loop: true,
    seconds: 5 / 3,
    events: [{ name: "bow_bob", t: 0 }],
  },
  mallow_atk_light: {
    id: "mallow_atk_light",
    owner: "player",
    loop: false,
    seconds: 0.6,
    events: [
      { name: "ring_on", t: 0.05 },
      { name: "hit", t: 0.45 },
      { name: "recover_pink", t: 0.7 },
    ],
  },
  mallow_atk_heavy: {
    id: "mallow_atk_heavy",
    owner: "player",
    loop: false,
    seconds: 0.9,
    events: [
      { name: "ring_on", t: 0.05 },
      { name: "hit", t: 0.55 },
      { name: "recover_pink", t: 0.75 },
    ],
  },
  mallow_block_hold: {
    id: "mallow_block_hold",
    owner: "player",
    loop: true,
    seconds: 0.8,
    events: [{ name: "arc_visible", t: 0, tEnd: 1 }],
  },
  mallow_deflect: {
    id: "mallow_deflect",
    owner: "player",
    loop: false,
    seconds: 0.4,
    events: [
      { name: "spark", t: 0.2 },
      { name: "foe_stun", t: 0.25 },
    ],
  },
  mallow_roll: {
    id: "mallow_roll",
    owner: "player",
    loop: false,
    seconds: 0.5,
    events: [
      { name: "iframe", t: 0.1, tEnd: 0.85 },
      { name: "dust", t: 0.15 },
    ],
  },
  shell_atk_horiz: {
    id: "shell_atk_horiz",
    owner: "shell",
    loop: false,
    seconds: 0.8,
    events: [
      { name: "tell", t: 0, tEnd: 0.35 },
      { name: "active", t: 0.35, tEnd: 0.55 },
    ],
  },
  duke_charge: {
    id: "duke_charge",
    owner: "duke",
    loop: false,
    seconds: 2,
    events: [
      { name: "lean", t: 0, tEnd: 0.3 },
      { name: "rush", t: 0.3, tEnd: 0.7 },
      { name: "skid", t: 0.7, tEnd: 1 },
    ],
  },
  duke_stance_break: {
    id: "duke_stance_break",
    owner: "duke",
    loop: false,
    seconds: 1,
    events: [
      { name: "flash", t: 0 },
      { name: "open", t: 0, tEnd: 1 },
    ],
  },
  red_intrude: {
    id: "red_intrude",
    owner: "red",
    loop: false,
    seconds: 1,
    events: [
      { name: "flare", t: 0 },
      { name: "land", t: 0.4 },
    ],
  },
};

export type CueKind = "none" | "orange" | "pink" | "white" | "diamond";

export type ClipCue = {
  kind: Exclude<CueKind, "none" | "diamond">;
  /** Ring scale. Larger move → larger orange telegraph. */
  scale: number;
};

const LIGHT_ORANGE = 1;
const HEAVY_ORANGE = 1.65;
const DUKE_ORANGE = 2.05;

/** Normalized clip time → readability cue. Null when the beat has no ring. */
export function cueFromClip(id: ClipId, normalized: number): ClipCue | null {
  const n = Math.min(1, Math.max(0, normalized));
  switch (id) {
    case "mallow_atk_light":
      if (n >= 0.05 && n < 0.45) return { kind: "orange", scale: LIGHT_ORANGE };
      if (n >= 0.7) return { kind: "pink", scale: 1 };
      return null;
    case "mallow_atk_heavy":
      if (n >= 0.05 && n < 0.55) return { kind: "orange", scale: HEAVY_ORANGE };
      if (n >= 0.75) return { kind: "pink", scale: 1.2 };
      return null;
    case "mallow_roll":
      if (n >= 0.1 && n <= 0.85) return { kind: "white", scale: 1.15 };
      return null;
    case "mallow_block_hold":
      return { kind: "white", scale: 0.9 };
    case "mallow_deflect":
      if (n >= 0.15 && n <= 0.35) return { kind: "white", scale: 0.85 };
      return null;
    case "shell_atk_horiz":
      if (n <= 0.35) return { kind: "orange", scale: 0.72 };
      return null;
    case "duke_charge":
      if (n < 0.3) return { kind: "orange", scale: DUKE_ORANGE };
      if (n >= 0.7) return { kind: "pink", scale: 1.45 };
      return null;
    case "duke_stance_break":
      if (n < 0.12) return { kind: "white", scale: 1.4 };
      return { kind: "pink", scale: 1.5 };
    default:
      return null;
  }
}

export const CUE_SCALES = {
  light: LIGHT_ORANGE,
  heavy: HEAVY_ORANGE,
  duke: DUKE_ORANGE,
} as const;

type Key = readonly [number, number];

function num(node: string, prop: "position" | "rotation" | "scale", index: "x" | "y" | "z", keys: readonly Key[]) {
  return new THREE.NumberKeyframeTrack(
    `${node}.${prop}[${index}]`,
    keys.map((key) => key[0]),
    keys.map((key) => key[1]),
  );
}

function seconds(id: ClipId, normalized: number) {
  return CLIP_CONTRACTS[id].seconds * normalized;
}

function wave(
  node: string,
  prop: "position" | "rotation" | "scale",
  index: "x" | "y" | "z",
  duration: number,
  base: number,
  amp: number,
  cycles: number,
  steps: number,
) {
  const keys: Key[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i === steps ? duration : (duration * i) / steps;
    keys.push([t, base + Math.sin((i / steps) * cycles * Math.PI * 2) * amp]);
  }
  return num(node, prop, index, keys);
}

function tracksFor(id: ClipId): THREE.KeyframeTrack[] {
  const dur = CLIP_CONTRACTS[id].seconds;
  const at = (n: number) => seconds(id, n);
  switch (id) {
    case "mallow_idle_ready":
      return [
        wave(M, "position", "x", dur, 1.05, 0.02, 1, 8),
        wave(M, "position", "y", dur, 0.4, 0.03, 1, 8),
        wave(M, "position", "z", dur, 0.24, 0.07, 1, 12),
        wave(M, "rotation", "x", dur, 0.04, 0.03, 1, 8),
        wave(M, "rotation", "y", dur, -0.06, 0.05, 1, 8),
        // Bow bob ~0.6 Hz (one cycle across the 5/3 s clip).
        wave(M, "rotation", "z", dur, 0, 0.045, 1, 16),
        // Micro knee, ~11 frames at 60fps, integer cycles so the loop matches.
        wave(M, "scale", "x", dur, 0, 0.07, 9, 36),
        num(M, "scale", "y", [
          [0, 1],
          [dur, 1],
        ]),
        num(M, "scale", "z", [
          [0, 0],
          [dur, 0],
        ]),
      ];
    case "mallow_atk_light":
      return [
        num(M, "position", "x", [
          [0, 1.05],
          [at(0.05), 1.02],
          [at(0.2), 0.55],
          [at(0.45), 1.42],
          [at(0.53), 1.42],
          [at(0.7), 1.12],
          [dur, 1.05],
        ]),
        num(M, "position", "y", [
          [0, 0.4],
          [at(0.2), 0.72],
          [at(0.45), -0.55],
          [at(0.53), -0.55],
          [at(0.7), 0.12],
          [dur, 0.4],
        ]),
        num(M, "position", "z", [
          [0, 0.22],
          [at(0.2), 0.08],
          [at(0.45), 0.4],
          [dur, 0.24],
        ]),
        num(M, "rotation", "y", [
          [0, 0],
          [at(0.2), -0.25],
          [at(0.45), 0.35],
          [dur, 0],
        ]),
        num(M, "scale", "y", [
          [0, 1],
          [dur, 1],
        ]),
        num(M, "scale", "z", [
          [0, 0],
          [dur, 0],
        ]),
      ];
    case "mallow_atk_heavy":
      return [
        num(M, "position", "x", [
          [0, 1.05],
          [at(0.05), 0.85],
          [at(0.28), -0.5],
          [at(0.55), 1.62],
          [at(0.64), 1.62],
          [at(0.75), 1.18],
          [dur, 1.05],
        ]),
        num(M, "position", "y", [
          [0, 0.4],
          [at(0.28), 0.05],
          [at(0.55), 0.02],
          [dur, 0.4],
        ]),
        num(M, "position", "z", [
          [0, 0.2],
          [at(0.28), 0.55],
          [at(0.55), 0.15],
          [dur, 0.24],
        ]),
        num(M, "scale", "y", [
          [0, 1],
          [at(0.28), 0.76],
          [at(0.55), 0.86],
          [at(0.75), 0.96],
          [dur, 1],
        ]),
        num(M, "scale", "z", [
          [0, 0],
          [dur, 0],
        ]),
      ];
    case "mallow_block_hold":
      return [
        num(M, "position", "x", [
          [0, 0.7],
          [dur, 0.7],
        ]),
        num(M, "position", "y", [
          [0, -0.85],
          [dur, -0.85],
        ]),
        wave(M, "position", "z", dur, 0.18, 0.02, 1, 4),
        num(M, "scale", "y", [
          [0, 1],
          [dur, 1],
        ]),
        num(M, "scale", "z", [
          [0, 0],
          [dur, 0],
        ]),
      ];
    case "mallow_deflect":
      return [
        num(M, "position", "x", [
          [0, 0.75],
          [at(0.2), 0.35],
          [at(0.25), 0.3],
          [dur, 0.9],
        ]),
        num(M, "position", "y", [
          [0, -0.4],
          [at(0.2), -1.05],
          [dur, -0.2],
        ]),
        num(M, "scale", "z", [
          [0, 0],
          [dur, 0],
        ]),
      ];
    case "mallow_roll":
      return [
        num(M, "position", "x", [
          [0, 1.05],
          [at(0.4), 1.2],
          [dur, 1.05],
        ]),
        num(M, "position", "z", [
          [0, 0.2],
          [at(0.15), 0.55],
          [at(0.5), 0.7],
          [dur, 0.24],
        ]),
        num(M, "scale", "y", [
          [0, 1],
          [at(0.35), 0.82],
          [dur, 1],
        ]),
        num(M, "scale", "z", [
          [0, 0],
          [at(0.1), 0.25],
          [at(0.4), 0.95],
          [at(0.85), 0.2],
          [dur, 0],
        ]),
      ];
    case "shell_atk_horiz":
      return [
        num(S, "position", "x", [
          [0, 0.2],
          [at(0.35), -0.7],
          [at(0.5), 1.15],
          [dur, 0.2],
        ]),
        num(S, "position", "z", [
          [0, 0],
          [at(0.35), 0.05],
          [at(0.5), 0.45],
          [dur, 0],
        ]),
      ];
    case "duke_charge":
      return [
        num(D, "position", "x", [
          [0, 0],
          [at(0.3), 0.72],
          [at(0.7), 0.22],
          [dur, 0],
        ]),
        num(D, "position", "y", [
          [0, 0],
          [at(0.7), 0],
          [at(0.85), 0.55],
          [dur, 0.18],
        ]),
        num(D, "position", "z", [
          [0, 0],
          [at(0.3), -0.15],
          [at(0.7), -4.55],
          [at(0.85), -4.15],
          [dur, -4.05],
        ]),
        num(D, "rotation", "y", [
          [0, 0],
          [at(0.7), 0.04],
          [dur, -0.08],
        ]),
      ];
    case "duke_stance_break":
      return [
        num(D, "position", "x", [
          [0, 0.15],
          [dur, -0.35],
        ]),
        num(D, "scale", "x", [
          [0, 1],
          [at(0.2), 1.18],
          [dur, 1.12],
        ]),
      ];
    case "red_intrude":
      return [
        num(R, "rotation", "z", [
          [0, -0.8],
          [at(0.2), 0.65],
          [at(0.4), 0.1],
          [dur, 0],
        ]),
        num(R, "position", "y", [
          [0, 1.4],
          [at(0.4), 0],
          [dur, 0],
        ]),
        num(R, "position", "z", [
          [0, -1.2],
          [at(0.4), 0],
          [dur, 0.2],
        ]),
      ];
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

const clipCache = new Map<ClipId, THREE.AnimationClip>();

export function buildGreyboxClip(id: ClipId): THREE.AnimationClip {
  const cached = clipCache.get(id);
  if (cached) return cached;
  const contract = CLIP_CONTRACTS[id];
  const clip = new THREE.AnimationClip(id, contract.seconds, tracksFor(id));
  clipCache.set(id, clip);
  return clip;
}

export type PoseProxies = {
  root: THREE.Group;
  mallow: THREE.Object3D;
  shell: THREE.Object3D;
  duke: THREE.Object3D;
  red: THREE.Object3D;
};

export type ClipPlay = {
  id: ClipId;
  /** Seconds into this clip. The mixer is seeked, not integrated. */
  time: number;
  loop: boolean;
};

export type ClipMixer = {
  proxies: PoseProxies;
  mixer: THREE.AnimationMixer;
  apply: (plan: readonly ClipPlay[]) => void;
  dispose: () => void;
};

function restPose(proxies: PoseProxies) {
  proxies.mallow.position.set(1.05, 0.4, 0.24);
  proxies.mallow.rotation.set(0.04, -0.06, 0);
  proxies.mallow.scale.set(0, 1, 0);
  proxies.shell.position.set(0.2, 0, 0);
  proxies.duke.position.set(0, 0, 0);
  proxies.duke.rotation.set(0, 0, 0);
  proxies.red.position.set(0, 0, 0);
  proxies.red.rotation.set(0, 0, 0);
}

/**
 * One mixer for every storyboard clip id. `apply` seeks actions to the
 * timeline so a paused previs holds the same pose.
 */
export function createClipMixer(): ClipMixer {
  const root = new THREE.Group();
  root.name = "clip-proxies";
  const make = (name: string) => {
    const node = new THREE.Object3D();
    node.name = name;
    root.add(node);
    return node;
  };
  const proxies: PoseProxies = {
    root,
    mallow: make(POSE_NODES.mallow),
    shell: make(POSE_NODES.shell),
    duke: make(POSE_NODES.duke),
    red: make(POSE_NODES.red),
  };
  restPose(proxies);

  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<ClipId, THREE.AnimationAction>();

  const actionFor = (id: ClipId) => {
    let action = actions.get(id);
    if (!action) {
      action = mixer.clipAction(buildGreyboxClip(id));
      action.enabled = true;
      action.clampWhenFinished = !CLIP_CONTRACTS[id].loop;
      action.setLoop(
        CLIP_CONTRACTS[id].loop ? THREE.LoopRepeat : THREE.LoopOnce,
        CLIP_CONTRACTS[id].loop ? Infinity : 1,
      );
      actions.set(id, action);
    }
    return action;
  };

  // Bind every clip once so a later skinned swap still has a slot.
  for (const id of CLIP_IDS) actionFor(id);

  return {
    proxies,
    mixer,
    apply(plan) {
      const want = new Set(plan.map((play) => play.id));
      for (const [id, action] of actions) {
        if (!want.has(id) && action.isRunning()) action.stop();
      }
      for (const play of plan) {
        const action = actionFor(play.id);
        const clip = action.getClip();
        action.enabled = true;
        action.setLoop(play.loop ? THREE.LoopRepeat : THREE.LoopOnce, play.loop ? Infinity : 1);
        action.clampWhenFinished = !play.loop;
        if (!action.isRunning()) action.play();
        const duration = Math.max(clip.duration, 1e-6);
        const time = play.loop
          ? ((play.time % duration) + duration) % duration
          : Math.min(duration, Math.max(0, play.time));
        action.time = time;
      }
      // Seeked clock: delta 0 reapplies the interpolant without advancing.
      mixer.update(0);
    },
    dispose() {
      mixer.stopAllAction();
      for (const id of CLIP_IDS) mixer.uncacheClip(buildGreyboxClip(id));
      mixer.uncacheRoot(root);
    },
  };
}

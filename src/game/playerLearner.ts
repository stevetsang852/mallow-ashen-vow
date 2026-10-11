/** Tabular ε-greedy learner for harness player AI — no ML stack. */

import type { CombatFeelEvent } from "./combatFeel.ts";
import type { AutoThinkAction, AutoThinkCtx, AutoFoeSnap } from "./autoHarness.ts";
import { decideAutoThink } from "./autoHarness.ts";

export type LearnActionId =
  | "dodge_l"
  | "dodge_r"
  | "attack_l"
  | "attack_h"
  | "flask"
  | "approach"
  | "circle_l"
  | "circle_r"
  | "retreat"
  | "hold";

export const LEARN_ACTIONS: readonly LearnActionId[] = [
  "dodge_l",
  "dodge_r",
  "attack_l",
  "attack_h",
  "flask",
  "approach",
  "circle_l",
  "circle_r",
  "retreat",
  "hold",
] as const;

const POLICY_KEY = "mallow-qa-learner";

export type LearnerSummary = {
  episodes: number;
  wins: number;
  losses: number;
  epsilon: number;
  qStates: number;
  lastReward: number;
  winRate: number | null;
  topPrefs: Array<{ state: string; action: LearnActionId; q: number }>;
};

export type LearnerOptions = {
  epsilon?: number;
  epsilonMin?: number;
  epsilonDecay?: number;
  alpha?: number;
  gamma?: number;
  /** Prefer sessionStorage persistence (browser). Default true. */
  persist?: boolean;
  /** Skip seeding dodge/punish priors (for clean toy curves). */
  seedPriors?: boolean;
  /** Inject RNG for tests. */
  random?: () => number;
};

type StepTrace = { state: string; action: LearnActionId };

function livingAutoFoe(f: AutoFoeSnap, gateOpen: boolean) {
  if (f.state === "dead") return false;
  if (f.kind === "demon" && !f.aggro) return false;
  if (f.kind === "duke" && !gateOpen) return false;
  return true;
}

function nearest(foes: AutoFoeSnap[], px: number, pz: number, gateOpen: boolean, max = 18): AutoFoeSnap | null {
  let best: AutoFoeSnap | null = null;
  let bestD = max;
  for (const f of foes) {
    if (!livingAutoFoe(f, gateOpen)) continue;
    const d = Math.hypot(f.x - px, f.z - pz);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function distBucket(d: number): "near" | "mid" | "far" {
  if (d < 2.0) return "near";
  if (d < 3.6) return "mid";
  return "far";
}

function hpBucket(hp: number): "crit" | "low" | "ok" {
  if (hp < 28) return "crit";
  if (hp < 52) return "low";
  return "ok";
}

function foePhase(state: string): "danger" | "punish" | "neutral" {
  if (state === "telegraph" || state === "swing" || state === "roar") return "danger";
  if (state === "recover" || state === "hurt") return "punish";
  return "neutral";
}

/** Discrete state key from foe telegraph / range / HP. */
export function featureState(ctx: AutoThinkCtx): { key: string; foe: AutoFoeSnap | null; dist: number } {
  const foe =
    nearest(ctx.foes, ctx.player.x, ctx.player.z, ctx.gateOpen, 18) ??
    ctx.foes.find((f) => f.kind === "hollow" && f.state !== "dead") ??
    null;
  if (!foe) return { key: "none", foe: null, dist: 99 };
  const dist = Math.hypot(foe.x - ctx.player.x, foe.z - ctx.player.z);
  const move = foe.move && foePhase(foe.state) === "danger" ? foe.move : "-";
  const key = [
    foe.kind,
    foePhase(foe.state),
    distBucket(dist),
    hpBucket(ctx.player.hp),
    move,
    ctx.player.flasks > 0 ? "f1" : "f0",
  ].join("|");
  return { key, foe, dist };
}

function emptyRow(): Record<LearnActionId, number> {
  const row = {} as Record<LearnActionId, number>;
  for (const a of LEARN_ACTIONS) row[a] = 0;
  return row;
}

function feelReward(ev: CombatFeelEvent): number {
  switch (ev.kind) {
    case "hit":
      return 0.35;
    case "heavy":
      return 0.7;
    case "stance-break":
      return 1.1;
    case "block":
      return 0.25;
    case "hurt":
      return -1.2;
    case "stamina":
      return -0.05;
    default:
      return 0;
  }
}

export function createPlayerLearner(opts: LearnerOptions = {}) {
  let epsilon = opts.epsilon ?? 0.28;
  const epsilonMin = opts.epsilonMin ?? 0.06;
  const epsilonDecay = opts.epsilonDecay ?? 0.992;
  const alpha = opts.alpha ?? 0.22;
  const gamma = opts.gamma ?? 0.88;
  const persist = opts.persist !== false;
  const doSeed = opts.seedPriors !== false;
  const rnd = opts.random ?? Math.random;

  const q = new Map<string, Record<LearnActionId, number>>();
  let episodes = 0;
  let wins = 0;
  let losses = 0;
  let lastReward = 0;
  let episodeReward = 0;
  let last: StepTrace | null = null;
  const episodeTrace: StepTrace[] = [];

  function row(state: string): Record<LearnActionId, number> {
    let r = q.get(state);
    if (!r) {
      r = emptyRow();
      q.set(state, r);
    }
    return r;
  }

  function bestAction(state: string, allowed?: readonly LearnActionId[]): LearnActionId {
    const r = row(state);
    const pool = allowed ?? LEARN_ACTIONS;
    let best: LearnActionId = pool[0]!;
    let bestQ = -Infinity;
    for (const a of pool) {
      if (r[a] > bestQ) {
        bestQ = r[a];
        best = a;
      }
    }
    return best;
  }

  function maxQ(state: string): number {
    const r = row(state);
    let m = -Infinity;
    for (const a of LEARN_ACTIONS) if (r[a] > m) m = r[a];
    return m === -Infinity ? 0 : m;
  }

  function pickAction(state: string, allowed?: readonly LearnActionId[]): LearnActionId {
    const pool = allowed ?? LEARN_ACTIONS;
    if (rnd() < epsilon) {
      return pool[Math.floor(rnd() * pool.length)]!;
    }
    return bestAction(state, pool);
  }

  function update(
    state: string,
    action: LearnActionId,
    reward: number,
    nextState: string | null,
    terminal: boolean,
  ) {
    const r = row(state);
    const target = terminal ? reward : reward + gamma * maxQ(nextState ?? state);
    r[action] += alpha * (target - r[action]);
  }

  function toAutoAction(
    action: LearnActionId,
    ctx: AutoThinkCtx,
    foe: AutoFoeSnap,
    dist: number,
    autoCd: number,
  ): AutoThinkAction {
    const lockId = foe.id;
    const dx = foe.x - ctx.player.x;
    const dz = foe.z - ctx.player.z;
    const len = Math.hypot(dx, dz) || 0.0001;
    const fx = -Math.sin(ctx.camYaw);
    const fz = -Math.cos(ctx.camYaw);
    const rx = Math.cos(ctx.camYaw);
    const rz = -Math.sin(ctx.camYaw);
    const forward = (dx * fx + dz * fz) / len;
    const right = (dx * rx + dz * rz) / len;

    switch (action) {
      case "dodge_l":
        return { type: "dodge", side: "left", autoCd: foe.move === "shock" ? 0.7 : 0.42, lockId };
      case "dodge_r":
        return { type: "dodge", side: "right", autoCd: foe.move === "shock" ? 0.7 : 0.42, lockId };
      case "attack_l":
        return { type: "attack", heavy: false, autoCd: 0.38, lockId };
      case "attack_h":
        return { type: "attack", heavy: true, autoCd: 0.48, lockId };
      case "flask":
        return { type: "flask", autoCd: 0.9, lockId };
      case "hold":
        return { type: "noop", autoCd: Math.max(autoCd, 0.12) };
      case "approach": {
        const keys: string[] = [];
        if (forward > 0.12) keys.push("KeyW");
        else if (forward < -0.12) keys.push("KeyS");
        if (right > 0.12) keys.push("KeyD");
        else if (right < -0.12) keys.push("KeyA");
        if (dist > 3.2) keys.push("ShiftLeft");
        return { type: "move", keys, autoCd, lockId };
      }
      case "retreat": {
        const keys: string[] = [];
        if (forward > 0.12) keys.push("KeyS");
        else if (forward < -0.12) keys.push("KeyW");
        if (right > 0.12) keys.push("KeyA");
        else if (right < -0.12) keys.push("KeyD");
        return { type: "move", keys, autoCd, lockId };
      }
      case "circle_l": {
        const keys = ["KeyA"];
        if (dist > 2.2) keys.push("KeyW");
        return { type: "move", keys, autoCd, lockId };
      }
      case "circle_r": {
        const keys = ["KeyD"];
        if (dist > 2.2) keys.push("KeyW");
        return { type: "move", keys, autoCd, lockId };
      }
    }
  }

  function legalize(ctx: AutoThinkCtx, foe: AutoFoeSnap, dist: number, action: LearnActionId): LearnActionId {
    if (action === "flask" && (ctx.player.flasks <= 0 || ctx.player.hp >= 70)) {
      return foePhase(foe.state) === "danger" ? "dodge_r" : "approach";
    }
    if ((action === "attack_l" || action === "attack_h") && dist > 2.6) return "approach";
    if ((action === "dodge_l" || action === "dodge_r") && foePhase(foe.state) !== "danger" && dist > 3.5) {
      return "approach";
    }
    return action;
  }

  function commit(state: string, action: LearnActionId, ctx: AutoThinkCtx, foe: AutoFoeSnap, dist: number, autoCd: number) {
    last = { state, action };
    episodeTrace.push(last);
    return toAutoAction(action, ctx, foe, dist, autoCd);
  }

  function decide(ctx: AutoThinkCtx, dt: number): AutoThinkAction {
    if (ctx.menuOpen || ctx.phase === "title" || ctx.phase === "dead" || ctx.phase === "win") {
      return decideAutoThink(ctx, dt);
    }
    if (ctx.player.act === "hurt" || ctx.player.act === "drink" || ctx.player.act === "dodge") {
      return decideAutoThink(ctx, dt);
    }

    let autoCd = Math.max(0, ctx.autoCd - dt);
    const { key, foe, dist } = featureState(ctx);
    if (!foe) return { type: "noop", autoCd };

    if (autoCd > 0) return decideAutoThink(ctx, dt);

    const phase = foePhase(foe.state);

    // During danger in range: choose among dodge / retreat (learn which).
    if (phase === "danger" && dist < 3.4 && ctx.player.act === "free") {
      const pool: LearnActionId[] = ["dodge_l", "dodge_r", "retreat"];
      const action = pickAction(key, pool);
      const cd = action.startsWith("dodge") ? (foe.move === "shock" ? 0.7 : 0.42) : 0.2;
      return commit(key, action, ctx, foe, dist, cd);
    }

    let action = legalize(ctx, foe, dist, pickAction(key));
    // Mild prior when Q is still flat on punish windows.
    if (phase === "punish" && dist < 2.4 && Math.abs(row(key)[action]) < 0.05) {
      action = foe.state === "hurt" || foe.stagger > 0 ? "attack_h" : "attack_l";
    }
    // Low HP + flask available.
    if (ctx.player.hp < 42 && ctx.player.flasks > 0 && dist > 2.4 && Math.abs(row(key).flask) < 0.05) {
      if (rnd() < 0.55) action = "flask";
    }

    return commit(key, action, ctx, foe, dist, autoCd);
  }

  function noteFeel(ev: CombatFeelEvent) {
    const r = feelReward(ev);
    if (r === 0 || !last) return;
    episodeReward += r;
    update(last.state, last.action, r, last.state, false);
  }

  function endEpisode(result: "win" | "loss") {
    episodes += 1;
    if (result === "win") wins += 1;
    else losses += 1;
    const terminal = result === "win" ? 6 : -5;
    episodeReward += terminal;
    lastReward = episodeReward;

    const seen = new Set<string>();
    for (let i = episodeTrace.length - 1; i >= 0; i--) {
      const step = episodeTrace[i]!;
      const id = `${step.state}::${step.action}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const shaped = terminal * (0.55 + 0.45 * ((i + 1) / Math.max(1, episodeTrace.length)));
      update(step.state, step.action, shaped, null, true);
    }

    epsilon = Math.max(epsilonMin, epsilon * epsilonDecay);
    episodeReward = 0;
    episodeTrace.length = 0;
    last = null;
    save();
  }

  function summary(): LearnerSummary {
    const prefs: LearnerSummary["topPrefs"] = [];
    for (const [state, r] of q) {
      for (const a of LEARN_ACTIONS) {
        if (Math.abs(r[a]) > 0.15) prefs.push({ state, action: a, q: Math.round(r[a] * 1000) / 1000 });
      }
    }
    prefs.sort((a, b) => Math.abs(b.q) - Math.abs(a.q));
    const decided = wins + losses;
    return {
      episodes,
      wins,
      losses,
      epsilon: Math.round(epsilon * 1000) / 1000,
      qStates: q.size,
      lastReward: Math.round(lastReward * 1000) / 1000,
      winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 1000 : null,
      topPrefs: prefs.slice(0, 12),
    };
  }

  function save() {
    if (!persist) return;
    try {
      const obj: Record<string, Record<LearnActionId, number>> = {};
      for (const [k, v] of q) obj[k] = { ...v };
      sessionStorage.setItem(
        POLICY_KEY,
        JSON.stringify({ q: obj, episodes, wins, losses, epsilon }),
      );
    } catch {
      /* ignore */
    }
  }

  function load() {
    if (!persist) return;
    try {
      const raw = sessionStorage.getItem(POLICY_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        q?: Record<string, Partial<Record<LearnActionId, number>>>;
        episodes?: number;
        wins?: number;
        losses?: number;
        epsilon?: number;
      };
      if (data.q) {
        for (const [k, v] of Object.entries(data.q)) {
          const r = emptyRow();
          for (const a of LEARN_ACTIONS) if (typeof v[a] === "number") r[a] = v[a]!;
          q.set(k, r);
        }
      }
      episodes = data.episodes ?? 0;
      wins = data.wins ?? 0;
      losses = data.losses ?? 0;
      if (typeof data.epsilon === "number") epsilon = data.epsilon;
    } catch {
      /* ignore */
    }
  }

  function reset() {
    q.clear();
    episodes = 0;
    wins = 0;
    losses = 0;
    epsilon = opts.epsilon ?? 0.28;
    lastReward = 0;
    episodeReward = 0;
    episodeTrace.length = 0;
    last = null;
    if (persist) {
      try {
        sessionStorage.removeItem(POLICY_KEY);
      } catch {
        /* ignore */
      }
    }
    if (doSeed) seedPriors();
  }

  function seedPriors() {
    for (const kind of ["hollow", "duke", "demon"]) {
      for (const move of ["-", "shock", "cleave", "overhead", "rush"]) {
        for (const dist of ["near", "mid"] as const) {
          for (const hp of ["ok", "low", "crit"] as const) {
            for (const flask of ["f1", "f0"] as const) {
              const key = `${kind}|danger|${dist}|${hp}|${move}|${flask}`;
              const r = row(key);
              r.dodge_l += 0.8;
              r.dodge_r += 0.8;
              r.retreat += 0.35;
              r.attack_l -= 0.5;
              r.attack_h -= 0.6;
              r.approach -= 0.3;
            }
          }
        }
      }
      for (const dist of ["near", "mid"] as const) {
        for (const hp of ["ok", "low", "crit"] as const) {
          for (const flask of ["f1", "f0"] as const) {
            const key = `${kind}|punish|${dist}|${hp}|-|${flask}`;
            const r = row(key);
            r.attack_l += 0.9;
            r.attack_h += 0.7;
            r.dodge_l -= 0.2;
            r.retreat -= 0.3;
          }
        }
      }
    }
  }

  load();
  if (q.size === 0 && doSeed) seedPriors();

  return {
    decide,
    noteFeel,
    endEpisode,
    summary,
    reset,
    save,
    load,
    forceUpdate: update,
    getQ: (state: string, action: LearnActionId) => row(state)[action],
    setEpsilon: (v: number) => {
      epsilon = v;
    },
    get epsilon() {
      return epsilon;
    },
  };
}

export type PlayerLearner = ReturnType<typeof createPlayerLearner>;

export type ToyStep = {
  foeState: "telegraph" | "swing" | "recover" | "idle";
  dist: number;
  playerHp: number;
  playerAct: string;
};

export function toyFeatureCtx(step: ToyStep): AutoThinkCtx {
  return {
    phase: "play",
    menuOpen: false,
    autoCd: 0,
    camYaw: 0,
    lockId: 1,
    gateOpen: true,
    player: { x: 0, z: 0, hp: step.playerHp, flasks: 2, act: step.playerAct },
    foes: [
      {
        id: 1,
        x: 0,
        z: -step.dist,
        kind: "hollow",
        state: step.foeState,
        stagger: step.foeState === "recover" ? 0.5 : 0,
        move: "cleave",
        aggro: true,
      },
    ],
  };
}

export type ToyEvalOpts = {
  /** If false, skip noteFeel/endEpisode (pure eval). Default true for training. */
  learn?: boolean;
};

/** One synthetic bout. Optimal: dodge danger, attack recover. */
export function playToyBout(
  learner: PlayerLearner,
  ep = 0,
  opts: ToyEvalOpts = {},
): "win" | "loss" {
  const learn = opts.learn !== false;
  let hp = 72;
  let dealt = 0;
  const need = 4;
  for (let beat = 0; beat < 12 && hp > 0 && dealt < need; beat++) {
    const cycle = beat % 3;
    const foeState = (cycle === 0 ? "telegraph" : cycle === 1 ? "swing" : "recover") as ToyStep["foeState"];
    const dist = foeState === "recover" ? 1.55 : 2.35;
    const ctx = toyFeatureCtx({ foeState, dist, playerHp: hp, playerAct: "free" });
    const action = learner.decide(ctx, 0.016);
    const danger = foeState === "telegraph" || foeState === "swing";

    if (action.type === "dodge") {
      if (danger && learn) learner.noteFeel({ kind: "block", t: ep * 10 + beat, amount: 10 });
    } else if (action.type === "attack") {
      if (foeState === "recover") {
        dealt += action.heavy ? 2 : 1;
        if (learn) {
          learner.noteFeel({
            kind: action.heavy ? "heavy" : "hit",
            t: ep * 10 + beat,
            amount: action.heavy ? 36 : 18,
          });
          if (dealt >= need) {
            learner.noteFeel({ kind: "stance-break", t: ep * 10 + beat, amount: 12 });
          }
        }
      } else if (danger) {
        hp -= 34;
        if (learn) learner.noteFeel({ kind: "hurt", t: ep * 10 + beat, amount: 34 });
      }
    } else if (danger) {
      hp -= 30;
      if (learn) learner.noteFeel({ kind: "hurt", t: ep * 10 + beat, amount: 30 });
    }
  }

  const win = dealt >= need && hp > 0;
  if (learn) learner.endEpisode(win ? "win" : "loss");
  return win ? "win" : "loss";
}

/**
 * Train on synthetic rematches. Returns trained learner + split win counts.
 */
export function runToyLearning(
  episodes = 80,
  opts: LearnerOptions = {},
): {
  firstHalfWins: number;
  secondHalfWins: number;
  totalWins: number;
  totalLosses: number;
  learner: PlayerLearner;
} {
  const learner = createPlayerLearner({
    persist: false,
    seedPriors: false,
    epsilon: 0.55,
    epsilonMin: 0.08,
    epsilonDecay: 0.97,
    alpha: 0.4,
    ...opts,
  });

  let totalWins = 0;
  let totalLosses = 0;
  let firstHalfWins = 0;
  let secondHalfWins = 0;
  const mid = Math.floor(episodes / 2);

  for (let ep = 0; ep < episodes; ep++) {
    const result = playToyBout(learner, ep, { learn: true });
    if (result === "win") {
      totalWins += 1;
      if (ep < mid) firstHalfWins += 1;
      else secondHalfWins += 1;
    } else {
      totalLosses += 1;
    }
  }

  return { firstHalfWins, secondHalfWins, totalWins, totalLosses, learner };
}

/** Evaluate a fixed policy for N bouts without further learning. */
export function evalToyPolicy(
  learner: PlayerLearner,
  episodes: number,
  epsilon: number,
): number {
  const prev = learner.epsilon;
  learner.setEpsilon(epsilon);
  let wins = 0;
  for (let ep = 0; ep < episodes; ep++) {
    if (playToyBout(learner, ep, { learn: false }) === "win") wins += 1;
  }
  learner.setEpsilon(prev);
  return wins;
}

/** Player QA autoThink + AI-vs-AI harness session (record win/loss + feel). */

import {
  emptyFeelCounts,
  type CombatFeelCounts,
  type CombatFeelEvent,
  type CombatFeelKind,
} from "./combatFeel.ts";
import type { Phase } from "./hud.ts";

export type AutoFoeSnap = {
  id: number;
  x: number;
  z: number;
  kind: string;
  state: string;
  move?: string;
  aggro?: boolean;
  stagger: number;
  /** Duke phase-2 / demon frenzy flag for finer learner buckets (0.8.7). */
  phase2?: boolean;
};

export type AutoThinkCtx = {
  phase: Phase;
  menuOpen: boolean;
  autoCd: number;
  camYaw: number;
  lockId: number | null;
  gateOpen: boolean;
  player: {
    x: number;
    z: number;
    hp: number;
    flasks: number;
    act: string;
  };
  foes: AutoFoeSnap[];
};

export type AutoThinkAction =
  | { type: "noop"; autoCd: number }
  | { type: "begin"; autoCd: number }
  | { type: "rise"; autoCd: number }
  | { type: "again"; autoCd: number }
  | { type: "dodge"; side: "left" | "right"; autoCd: number; lockId: number }
  | { type: "flask"; autoCd: number; lockId: number }
  | { type: "attack"; heavy: boolean; autoCd: number; lockId: number }
  | { type: "move"; keys: string[]; autoCd: number; lockId: number };

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

/** Pure decision step for knight-cat QA AI (same behaviour as previous inline autoThink). */
export function decideAutoThink(ctx: AutoThinkCtx, dt: number): AutoThinkAction {
  let autoCd = Math.max(0, ctx.autoCd - dt);
  if (ctx.menuOpen) return { type: "noop", autoCd };

  if (ctx.phase === "title") return { type: "begin", autoCd };

  if (ctx.phase === "dead" || ctx.phase === "win") {
    if (autoCd <= 0) {
      return ctx.phase === "dead"
        ? { type: "rise", autoCd: 1.1 }
        : { type: "again", autoCd: 1.1 };
    }
    return { type: "noop", autoCd };
  }

  if (ctx.player.act === "hurt" || ctx.player.act === "drink" || ctx.player.act === "dodge") {
    return { type: "noop", autoCd };
  }

  const foe =
    nearest(ctx.foes, ctx.player.x, ctx.player.z, ctx.gateOpen, 18) ??
    ctx.foes.find((f) => f.kind === "hollow" && f.state !== "dead") ??
    null;
  if (!foe) return { type: "noop", autoCd };

  const lockId = foe.id;
  const dx = foe.x - ctx.player.x;
  const dz = foe.z - ctx.player.z;
  const dist = Math.hypot(dx, dz) || 0.0001;
  const fx = -Math.sin(ctx.camYaw);
  const fz = -Math.cos(ctx.camYaw);
  const rx = Math.cos(ctx.camYaw);
  const rz = -Math.sin(ctx.camYaw);
  const forward = (dx * fx + dz * fz) / dist;
  const right = (dx * rx + dz * rz) / dist;

  const danger = foe.state === "telegraph" || foe.state === "swing";
  if (danger && dist < 3.4 && autoCd <= 0 && ctx.player.act === "free") {
    return {
      type: "dodge",
      side: right > 0 ? "right" : "left",
      autoCd: foe.move === "shock" ? 0.7 : 0.42,
      lockId,
    };
  }

  if (
    ctx.player.hp < 42 &&
    ctx.player.flasks > 0 &&
    dist > 2.4 &&
    ctx.player.act === "free" &&
    autoCd <= 0
  ) {
    return { type: "flask", autoCd: 0.9, lockId };
  }

  if (
    (foe.state === "recover" || foe.state === "hurt" || foe.stagger > 0) &&
    dist < 2.35 &&
    autoCd <= 0
  ) {
    return {
      type: "attack",
      heavy: foe.state === "hurt" || foe.stagger > 0,
      autoCd: 0.38,
      lockId,
    };
  }

  const keys: string[] = [];
  if (dist > 1.65) {
    if (forward > 0.15) keys.push("KeyW");
    else if (forward < -0.15) keys.push("KeyS");
    if (right > 0.15) keys.push("KeyD");
    else if (right < -0.15) keys.push("KeyA");
    if (dist > 3.2) keys.push("ShiftLeft");
  }
  return { type: "move", keys, autoCd, lockId };
}

export type HarnessRun = {
  id: number;
  startedAt: number;
  endedAt: number | null;
  result: "win" | "loss" | null;
  feel: CombatFeelCounts;
  events: CombatFeelEvent[];
};

export type HarnessSummary = {
  enabled: boolean;
  runs: number;
  wins: number;
  losses: number;
  /** Finished wins / (wins+losses); null if none decided. */
  winRate: number | null;
  /** Win rate over the last `recentWindow` finished runs. */
  recentWinRate: number | null;
  recentWindow: number;
  /** Mean duration ms of finished runs with endedAt. */
  avgMs: number | null;
  currentId: number | null;
  lastResult: "win" | "loss" | null;
  feelTotals: CombatFeelCounts;
  recentRuns: Array<{
    id: number;
    result: "win" | "loss" | null;
    feel: CombatFeelCounts;
    ms: number | null;
  }>;
};

const HARNESS_KEY = "mallow-qa-harness";

export function harnessWanted(): boolean {
  try {
    return sessionStorage.getItem(HARNESS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHarnessWanted(on: boolean) {
  try {
    if (on) sessionStorage.setItem(HARNESS_KEY, "1");
    else sessionStorage.removeItem(HARNESS_KEY);
  } catch {
    /* ignore */
  }
}

/** Longer recent win-rate window (was 8 in 0.7.3). */
export const HARNESS_RECENT_WINDOW = 24;

/** Default seed for fixed harness regression (0.8.7). */
export const HARNESS_REGRESSION_SEED = 0x8719_8701;

/** Mulberry32 — deterministic [0,1) for regression / tests. Does not touch moves damage. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export type FixedSeedRegressionReport = {
  seed: number;
  runs: number;
  wins: number;
  losses: number;
  winRate: number;
  recentWinRate: number | null;
  recentWindow: number;
  /** Stable fingerprint of decideAutoThink on fixed duke/demon/hollow cues. */
  decideFingerprint: string;
};

/** Fixed duke/demon/hollow cues — outputs must stay stable across refactors. */
export function regressionDecideCases(): AutoThinkCtx[] {
  const basePlayer = { x: 0, z: 0, hp: 80, flasks: 2, act: "free" as const };
  return [
    {
      phase: "play",
      menuOpen: false,
      autoCd: 0,
      camYaw: 0,
      lockId: 1,
      gateOpen: true,
      player: { ...basePlayer },
      foes: [
        {
          id: 1,
          x: 2.0,
          z: 0,
          kind: "duke",
          state: "telegraph",
          move: "overhead",
          stagger: 0,
          aggro: true,
          phase2: false,
        },
      ],
    },
    {
      phase: "play",
      menuOpen: false,
      autoCd: 0,
      camYaw: 0,
      lockId: 2,
      gateOpen: true,
      player: { ...basePlayer, hp: 36 },
      foes: [
        {
          id: 2,
          x: 1.5,
          z: 0.2,
          kind: "duke",
          state: "swing",
          move: "shock",
          stagger: 0,
          aggro: true,
          phase2: true,
        },
      ],
    },
    {
      phase: "play",
      menuOpen: false,
      autoCd: 0,
      camYaw: 0.4,
      lockId: 3,
      gateOpen: true,
      player: { ...basePlayer },
      foes: [
        {
          id: 3,
          x: 2.8,
          z: -0.5,
          kind: "demon",
          state: "telegraph",
          move: "cleave",
          stagger: 0,
          aggro: true,
          phase2: false,
        },
      ],
    },
    {
      phase: "play",
      menuOpen: false,
      autoCd: 0,
      camYaw: 0,
      lockId: 4,
      gateOpen: true,
      player: { ...basePlayer },
      foes: [
        {
          id: 4,
          x: 1.4,
          z: 0,
          kind: "hollow",
          state: "recover",
          stagger: 0.2,
          aggro: true,
        },
      ],
    },
  ];
}

function fingerprintDecide(): string {
  return regressionDecideCases()
    .map((ctx) => {
      const a = decideAutoThink(ctx, 0.016);
      if (a.type === "dodge") return `dodge:${a.side}`;
      if (a.type === "attack") return `atk:${a.heavy ? "h" : "l"}`;
      if (a.type === "move") return `move:${a.keys.join("+") || "-"}`;
      if (a.type === "flask") return "flask";
      return a.type;
    })
    .join("|");
}

/**
 * Fixed-seed harness regression: synthetic win/loss stream + decide fingerprint.
 * Does not simulate combat damage / moves tables.
 */
export function runFixedSeedRegression(
  seed: number = HARNESS_REGRESSION_SEED,
  runs = 48,
): FixedSeedRegressionReport {
  const rnd = mulberry32(seed);
  const h = createHarnessSession();
  h.setEnabled(true);
  let wins = 0;
  let losses = 0;
  for (let i = 0; i < runs; i++) {
    // ~58% win bias — stable under fixed seed for gate assertions
    const win = rnd() < 0.58;
    if (win) wins += 1;
    else losses += 1;
    h.endRun(win ? "win" : "loss", 1000 + i * 120);
  }
  const s = h.summary();
  return {
    seed,
    runs,
    wins,
    losses,
    winRate: s.winRate ?? 0,
    recentWinRate: s.recentWinRate,
    recentWindow: s.recentWindow,
    decideFingerprint: fingerprintDecide(),
  };
}

export function createHarnessSession() {
  let enabled = false;
  let nextId = 1;
  let current: HarnessRun | null = null;
  const runs: HarnessRun[] = [];
  const feelTotals = emptyFeelCounts();

  function startRun(now = performance.now()) {
    current = {
      id: nextId++,
      startedAt: now,
      endedAt: null,
      result: null,
      feel: emptyFeelCounts(),
      events: [],
    };
  }

  function noteFeel(ev: CombatFeelEvent) {
    if (!enabled || !current || current.result) return;
    current.events.push(ev);
    current.feel[ev.kind] += 1;
    feelTotals[ev.kind] += 1;
  }

  function endRun(result: "win" | "loss", now = performance.now()) {
    if (!current || current.result) return current;
    current.result = result;
    current.endedAt = now;
    runs.push(current);
    const finished = current;
    current = null;
    if (enabled) startRun(now);
    return finished;
  }

  const recentWindow = HARNESS_RECENT_WINDOW;

  function rate(w: number, l: number): number | null {
    const n = w + l;
    return n > 0 ? Math.round((w / n) * 1000) / 1000 : null;
  }

  function summary(): HarnessSummary {
    let wins = 0;
    let losses = 0;
    let msSum = 0;
    let msN = 0;
    for (const r of runs) {
      if (r.result === "win") wins += 1;
      else if (r.result === "loss") losses += 1;
      if (r.endedAt != null) {
        msSum += r.endedAt - r.startedAt;
        msN += 1;
      }
    }
    const recent = runs.slice(-recentWindow);
    let rw = 0;
    let rl = 0;
    for (const r of recent) {
      if (r.result === "win") rw += 1;
      else if (r.result === "loss") rl += 1;
    }
    return {
      enabled,
      runs: runs.length,
      wins,
      losses,
      winRate: rate(wins, losses),
      recentWinRate: rate(rw, rl),
      recentWindow,
      avgMs: msN > 0 ? Math.round(msSum / msN) : null,
      currentId: current?.id ?? null,
      lastResult: runs.length ? runs[runs.length - 1]!.result : null,
      feelTotals: { ...feelTotals },
      recentRuns: recent.map((r) => ({
        id: r.id,
        result: r.result,
        feel: { ...r.feel },
        ms: r.endedAt != null ? Math.round(r.endedAt - r.startedAt) : null,
      })),
    };
  }

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on: boolean) {
      enabled = on;
      setHarnessWanted(on);
      if (on && !current) startRun();
      if (!on) current = null;
    },
    noteFeel,
    onPhase(phase: Phase) {
      if (!enabled) return;
      if (phase === "dead") endRun("loss");
      else if (phase === "win") endRun("win");
      else if (phase === "play" && !current) startRun();
    },
    startRun,
    endRun,
    summary,
    currentFeel(): CombatFeelCounts {
      return current ? { ...current.feel } : emptyFeelCounts();
    },
    reset() {
      runs.length = 0;
      for (const k of Object.keys(feelTotals) as CombatFeelKind[]) feelTotals[k] = 0;
      current = enabled ? { id: nextId++, startedAt: performance.now(), endedAt: null, result: null, feel: emptyFeelCounts(), events: [] } : null;
    },
  };
}

export type HarnessSession = ReturnType<typeof createHarnessSession>;

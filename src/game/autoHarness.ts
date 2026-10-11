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

  function summary(): HarnessSummary {
    let wins = 0;
    let losses = 0;
    for (const r of runs) {
      if (r.result === "win") wins += 1;
      else if (r.result === "loss") losses += 1;
    }
    return {
      enabled,
      runs: runs.length,
      wins,
      losses,
      currentId: current?.id ?? null,
      lastResult: runs.length ? runs[runs.length - 1]!.result : null,
      feelTotals: { ...feelTotals },
      recentRuns: runs.slice(-8).map((r) => ({
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

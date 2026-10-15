/** Pure enemy AI decision helpers (hollow / duke / demon). Simulation stays in createGame. */

import { MOVE, type DukeMove } from "@/game/moves";

export type Rng = () => number;

/** Duke: pick move + optional cleave chain by range / phase-2. Inject RNG for tests. */
export function chooseDukeMove(
  dist: number,
  p2: boolean,
  random: Rng = Math.random,
): { move: DukeMove; chain: number } {
  let move: DukeMove;
  if (dist > 4.5) move = random() < 0.72 ? "rush" : "overhead";
  else if (p2 && dist < 2.2 && random() < 0.42) move = "shock";
  else if (random() < 0.48) move = "overhead";
  else move = "cleave";
  return { move, chain: move === "cleave" && p2 && random() < 0.7 ? 1 : 0 };
}

export function dukeSwingSpan(move: DukeMove) {
  if (move === "shock") return 0.5;
  if (move === "rush") return 0.42;
  if (move === "overhead") return 0.18;
  return 0.22;
}

export function dukeRecoverSpan(move: DukeMove, p2: boolean, chain: number) {
  if (chain > 0) return 0.2;
  if (move === "overhead") return MOVE.duke.overheadRecover;
  if (move === "shock") return MOVE.duke.shockRecover;
  if (move === "rush") return p2 ? MOVE.duke.rushRecoverP2 : MOVE.duke.rushRecover;
  return 0.8;
}

/** Whether duke should open a new telegraph while chasing. */
export function shouldDukeCommit(dist: number, cd: number) {
  return cd <= 0 && (dist < 2.65 || dist > 4.55);
}

export type HollowIntent = "telegraph" | "chase" | "hold";

/** Hollow ash-shell: attack in range, chase when outside soft range, else hold. */
export function chooseHollowIntent(dist: number, range: number, cd: number): HollowIntent {
  if (dist <= range && cd <= 0) return "telegraph";
  if (dist > range * 0.82) return "chase";
  return "hold";
}

export type DemonIntent =
  | { type: "dodge"; side: 1 | -1 }
  | { type: "drink" }
  | { type: "telegraph"; move: "cleave" | "rush"; span: number }
  | { type: "chase" };

export type DemonDecideCtx = {
  dist: number;
  cd: number;
  hp: number;
  hpMax: number;
  /** Remaining drink charges (createGame uses chain as drink flag). */
  chain: number;
  /** Player mid-swing threat in melee. */
  threatened: boolean;
  /** Oscillator time used for dodge side (same as prior createGame). */
  t: number;
};

/**
 * Red-contract demon chase-phase intent.
 * Telegraphs stay short but readable (cleave 0.38 / rush 0.42) for learner punish windows.
 */
export function chooseDemonIntent(ctx: DemonDecideCtx): DemonIntent {
  const { dist, cd, hp, hpMax, chain, threatened, t } = ctx;
  if (threatened && cd <= 0) {
    const side: 1 | -1 = t * 3 > Math.PI ? 1 : -1;
    return { type: "dodge", side };
  }
  if (chain > 0 && hp < hpMax * 0.42 && dist > 2.15 && cd <= 0) {
    return { type: "drink" };
  }
  if (cd <= 0 && dist < 2.05) {
    return { type: "telegraph", move: "cleave", span: 0.38 };
  }
  if (cd <= 0 && dist > 3.15 && dist < 6.5) {
    return { type: "telegraph", move: "rush", span: 0.42 };
  }
  return { type: "chase" };
}

import { MOVE, type DukeMove } from "@/game/moves";

export function chooseDukeMove(dist: number, p2: boolean): { move: DukeMove; chain: number } {
  let move: DukeMove;
  if (dist > 4.5) move = Math.random() < 0.72 ? "rush" : "overhead";
  else if (p2 && dist < 2.2 && Math.random() < 0.42) move = "shock";
  else if (Math.random() < 0.48) move = "overhead";
  else move = "cleave";
  return { move, chain: move === "cleave" && p2 && Math.random() < 0.7 ? 1 : 0 };
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

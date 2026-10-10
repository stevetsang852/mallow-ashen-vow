import { MOVE } from "@/game/moves";

export const PLAYER = {
  dodgeEnd: 0.46,
  drinkEnd: 0.82,
  hurtEnd: 0.34,
  blockEnd: 0.3,
  iframeStart: 0.04,
  iframeEnd: 0.34,
} as const;

export function actionEnd(act: string, heavy: boolean) {
  if (act === "attack") return heavy ? MOVE.heavyEnd : MOVE.lightEnd;
  if (act === "dodge") return PLAYER.dodgeEnd;
  if (act === "drink") return PLAYER.drinkEnd;
  if (act === "hurt") return PLAYER.hurtEnd;
  return PLAYER.blockEnd;
}

export function inIFrame(act: string, actT: number) {
  return act === "dodge" && actT > PLAYER.iframeStart && actT < PLAYER.iframeEnd;
}

export function hitWindow(heavy: boolean) {
  return heavy
    ? { open: MOVE.heavyOpen, shut: MOVE.heavyShut }
    : { open: MOVE.lightOpen, shut: MOVE.lightShut };
}

export function inRecover(act: string, actT: number, heavy: boolean) {
  if (act !== "attack") return false;
  const { shut } = hitWindow(heavy);
  return actT >= shut && actT < actionEnd(act, heavy);
}

export function inWindup(act: string, actT: number, heavy: boolean) {
  if (act !== "attack") return false;
  const { open } = hitWindow(heavy);
  return actT < open;
}

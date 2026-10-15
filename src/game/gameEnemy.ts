/**
 * Enemy AI and step logic — extracted from createGame.ts.
 * Handles AI decision making and per-frame updates for each foe type.
 */
import {
  chooseDemonIntent,
  chooseDukeMove,
  chooseHollowIntent,
  dukeRecoverSpan,
  dukeSwingSpan,
  shouldDukeCommit,
  type DukeMove,
} from "./ai.ts";
import { MOVE, dampAngle, dukeTell, type Foe } from "./moves.ts";

export function stepFoe(f: Foe, dt: number, playerX: number, playerZ: number, gateOpen: boolean): {
  dx: number;
  dz: number;
  dist: number;
} {
  f.flash = Math.max(0, f.flash - dt);
  f.cd = Math.max(0, f.cd - dt);

  if (f.state === "dead") {
    f.t += dt;
    return { dx: 0, dz: 0, dist: 0 };
  }

  if (f.hp <= 0) {
    f.state = "dead";
    f.t = 0;
    return { dx: 0, dz: 0, dist: 0 };
  }

  const dx = playerX - f.x;
  const dz = playerZ - f.z;
  const dist = Math.hypot(dx, dz) || 0.0001;

  if (f.kind === "demon") {
    if (!f.aggro) return { dx, dz, dist };
    stepDemon(f, dt, dx, dz, dist);
    return { dx, dz, dist };
  }

  const canSee = f.kind === "hollow" || (gateOpen && playerZ < MOVE.GATE_Z + 0.15);
  if (!f.aggro && canSee && dist < f.aggroR) {
    f.aggro = true;
    if (f.kind === "duke") {
      f.state = "roar";
      f.t = 0;
      f.span = 1.05;
      f.move = "overhead";
    } else {
      f.state = "chase";
    }
  }

  if (!f.aggro) {
    f.yaw = f.baseYaw + Math.sin(Date.now() / 700 + f.id) * 0.12;
    return { dx, dz, dist };
  }

  if (f.kind === "duke") {
    stepDuke(f, dt, dx, dz, dist);
    return { dx, dz, dist };
  }

  stepHollow(f, dt, dx, dz, dist);
  return { dx, dz, dist };
}

function stepHollow(f: Foe, dt: number, dx: number, dz: number, dist: number) {
  const face = Math.atan2(-dx, -dz);
  if (f.state !== "swing" && f.state !== "recover") f.yaw = dampAngle(f.yaw, face, 6.5, dt);

  if (f.state === "hurt") {
    f.t += dt;
    if (f.t > (f.stagger || 0.2)) {
      f.stagger = 0;
      f.state = "chase";
    }
    return;
  }

  if (f.state === "telegraph") {
    f.t += dt;
    if (f.t >= f.span) {
      f.state = "swing";
      f.t = 0;
      f.swung = false;
      f.span = 0.24;
    }
    return;
  }

  if (f.state === "swing") {
    f.t += dt;
    if (!f.swung && f.t > 0.04) f.swung = true;
    if (f.t >= f.span) {
      f.state = "recover";
      f.t = 0;
      f.span = 0.35;
    }
    return;
  }

  if (f.state === "recover") {
    f.t += dt;
    if (f.t >= f.span) {
      f.state = "chase";
      f.t = 0;
    }
    return;
  }

  // Chase or idle
  const intent = chooseHollowIntent(dist, f.range, f.cd);
  if (intent === "telegraph" && f.cd <= 0) {
    f.state = "telegraph";
    f.t = 0;
    f.span = MOVE.lightOpen + 0.1;
    f.cd = 1.5;
  } else if (intent === "chase") {
    f.state = "chase";
    f.yaw = face;
  } else {
    f.state = "idle";
  }
}

function stepDuke(f: Foe, dt: number, dx: number, dz: number, dist: number) {
  const p2 = f.hp < f.hpMax * 0.5;

  const turn = f.state === "telegraph" || f.state === "swing" ? 1.35 : p2 ? 3.3 : 2.5;
  if (!(f.state === "swing" && f.move === "rush")) {
    f.yaw = dampAngle(f.yaw, Math.atan2(-dx, -dz), turn, dt);
  }

  if (f.state === "roar") {
    f.t += dt;
    if (f.t >= f.span) {
      f.state = "chase";
      f.t = 0;
      f.cd = 0.4;
    }
    return;
  }

  if (f.state === "hurt") {
    f.t += dt;
    if (f.t > (f.stagger || (p2 ? 0.16 : 0.28))) {
      f.stagger = 0;
      f.state = "chase";
      f.cd = 0.2;
    }
    return;
  }

  if (f.state === "telegraph") {
    f.t += dt;
    if (f.t >= f.span) {
      f.state = "swing";
      f.t = 0;
      f.swung = false;
      f.span = dukeSwingSpan(f.move);
    }
    return;
  }

  if (f.state === "swing") {
    f.t += dt;
    if (!f.swung && f.t > 0.06) f.swung = true;
    if (f.t >= f.span) {
      f.state = "recover";
      f.t = 0;
      f.span = dukeRecoverSpan(f.move, p2, f.chain);
    }
    return;
  }

  if (f.state === "recover") {
    f.t += dt;
    if (f.t >= f.span) {
      f.state = "chase";
      f.t = 0;
    }
    return;
  }

  // Chase phase
  const shouldCommit = shouldDukeCommit(dist, f.cd);
  if (shouldCommit) {
    startDukeMove(f, dist, p2);
    f.cd = 1.2;
  }
}

function startDukeMove(f: Foe, dist: number, p2: boolean) {
  const picked = chooseDukeMove(dist, p2);
  f.move = picked.move;
  f.chain = picked.chain;
  f.state = "telegraph";
  f.t = 0;
  f.swung = false;
  f.span = dukeTell(f.move, p2);
}

function stepDemon(f: Foe, dt: number, dx: number, dz: number, dist: number) {
  const ctx = {
    dist,
    cd: f.cd,
    hp: f.hp,
    hpMax: f.hpMax,
    chain: f.chain,
    threatened: false, // simplified
    t: Date.now() / 1000,
  };

  const intent = chooseDemonIntent(ctx);

  if (intent.type === "dodge") {
    f.state = "dodge";
    f.t = 0;
    f.span = 0.45;
    // Dodge direction
    f.dodgeDir = intent.side;
  } else if (intent.type === "drink" && f.chain > 0) {
    f.state = "drink";
    f.t = 0;
    f.span = 0.8;
    f.chain = 0;
  } else if (intent.type === "telegraph") {
    f.state = "telegraph";
    f.t = 0;
    f.move = intent.move;
    f.span = intent.span;
    f.swung = false;
    f.cd = 0.5;
  } else {
    // Chase
    f.state = "chase";
    f.yaw = Math.atan2(-dx, -dz);
  }
}

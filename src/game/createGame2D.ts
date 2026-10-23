/**
 * Pure 2D Canvas game — no 3D scene.
 * Dark Souls-like combat (stamina, dodge i-frames, guard, posture) on a 2D plane.
 * Reuses moves / player / hitPath constants where possible.
 */
import { MOVE, WALK, RUN, STA_MAX, FLASK_MAX, LIGHT_COMBO_DMGS } from "@/game/moves";
import { PLAYER, inIFrame, actionEnd } from "@/game/player";
import { GAME_VERSION } from "@/game/version";

export type HudSnap = {
  phase: string;
  hp: number;
  hpMax: number;
  sta: number;
  flasks: number;
  version: string;
};

type Actor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  yaw: number;
  hp: number;
  hpMax: number;
  r: number;
  act: string;
  actT: number;
  atk: "light" | "heavy";
  combo: number;
  sta: number;
  invuln: number;
  dodgeX: number;
  dodgeY: number;
  kind: string;
};

export function createGame2D(
  canvas: HTMLCanvasElement,
  hooks: { onHud: (hud: HudSnap) => void },
): { dispose: () => void } {
  const ctx = canvas.getContext("2d")!;
  let w = canvas.clientWidth || 800;
  let h = canvas.clientHeight || 600;
  canvas.width = w * (window.devicePixelRatio || 1);
  canvas.height = h * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const player: Actor = {
    x: w / 2,
    y: h / 2 + 40,
    vx: 0,
    vy: 0,
    yaw: -Math.PI / 2,
    hp: 120,
    hpMax: 120,
    r: 16,
    act: "free",
    actT: 0,
    atk: "light",
    combo: 0,
    sta: STA_MAX,
    invuln: 0,
    dodgeX: 0,
    dodgeY: 0,
    kind: "mallow",
  };

  const foes: Actor[] = [
    { x: w / 2 - 120, y: h / 2 - 40, vx: 0, vy: 0, yaw: 0, hp: 60, hpMax: 60, r: 18, act: "free", actT: 0, atk: "light", combo: 0, sta: 100, invuln: 0, dodgeX: 0, dodgeY: 0, kind: "hollow" },
    { x: w / 2 + 100, y: h / 2 - 80, vx: 0, vy: 0, yaw: 0, hp: 90, hpMax: 90, r: 22, act: "free", actT: 0, atk: "light", combo: 0, sta: 100, invuln: 0, dodgeX: 0, dodgeY: 0, kind: "duke" },
  ];

  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent, down: boolean) => {
    if (down) keys.add(e.code);
    else keys.delete(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  };
  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));

  let flasks = FLASK_MAX;
  let last = performance.now();
  let running = true;

  function wishDir() {
    let ix = 0;
    let iy = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) iy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) iy += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }
    return { ix, iy, mag: Math.min(1, mag) };
  }

  function attack(heavy: boolean) {
    if (player.act !== "free") return;
    const cost = heavy ? MOVE.heavyCost : MOVE.lightCost;
    if (player.sta < cost) return;
    player.sta -= cost;
    player.act = "attack";
    player.actT = 0;
    player.atk = heavy ? "heavy" : "light";
    player.combo = heavy ? 0 : (player.combo + 1) % 3;
  }

  function dodge() {
    if (player.act !== "free" || player.sta < MOVE.dodgeCost) return;
    const { ix, iy, mag } = wishDir();
    player.sta -= MOVE.dodgeCost;
    player.act = "dodge";
    player.actT = 0;
    player.invuln = PLAYER.iframeEnd - PLAYER.iframeStart;
    player.dodgeX = mag > 0.1 ? ix : Math.cos(player.yaw);
    player.dodgeY = mag > 0.1 ? iy : Math.sin(player.yaw);
  }

  function drink() {
    if (player.act !== "free" || flasks <= 0) return;
    flasks--;
    player.act = "drink";
    player.actT = 0;
  }

  function step(dt: number) {
    player.invuln = Math.max(0, player.invuln - dt);
    if (player.act !== "free") {
      player.actT += dt;
      const end = actionEnd(player.act, player.atk === "heavy");
      if (player.actT >= end) player.act = "free";
    }

    if (keys.has("KeyJ") || keys.has("KeyZ")) attack(false);
    if (keys.has("KeyK") || keys.has("KeyX")) attack(true);
    if (keys.has("Space") || keys.has("KeyL")) dodge();
    if (keys.has("KeyE")) drink();

    const { ix, iy, mag } = wishDir();
    if (player.act === "free" && mag > 0.1) {
      const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const speed = running ? RUN * 40 : WALK * 40;
      player.vx = ix * speed;
      player.vy = iy * speed;
      player.yaw = Math.atan2(iy, ix);
    } else if (player.act === "dodge") {
      const u = player.actT / 0.4;
      const curve = u < 1 ? Math.sin(Math.min(1, u) * Math.PI) : 0;
      player.vx = player.dodgeX * 420 * curve;
      player.vy = player.dodgeY * 420 * curve;
    } else if (player.act === "attack") {
      const lung = player.atk === "heavy" ? 80 : 50;
      player.vx = Math.cos(player.yaw) * lung;
      player.vy = Math.sin(player.yaw) * lung;
    } else {
      player.vx = 0;
      player.vy = 0;
    }

    player.x = Math.max(40, Math.min(w - 40, player.x + player.vx * dt));
    player.y = Math.max(40, Math.min(h - 40, player.y + player.vy * dt));

    // Simple foe AI: walk toward player
    for (const f of foes) {
      if (f.hp <= 0) continue;
      const dx = player.x - f.x;
      const dy = player.y - f.y;
      const dist = Math.hypot(dx, dy) || 1;
      f.x += (dx / dist) * 28 * dt;
      f.y += (dy / dist) * 28 * dt;
      // Hit player
      if (dist < player.r + f.r && player.invuln <= 0 && player.act !== "dodge") {
        player.hp = Math.max(0, player.hp - 12);
        player.invuln = 0.4;
      }
    }

    // Player attack hit
    if (player.act === "attack" && player.actT > 0.1 && player.actT < 0.28) {
      const dmg = player.atk === "heavy" ? MOVE.heavyDmg : LIGHT_COMBO_DMGS[player.combo] ?? 22;
      for (const f of foes) {
        if (f.hp <= 0) continue;
        const dx = f.x - player.x;
        const dy = f.y - player.y;
        if (Math.hypot(dx, dy) < player.r + f.r + 18) {
          f.hp = Math.max(0, f.hp - dmg);
        }
      }
    }

    if (player.sta < STA_MAX) player.sta = Math.min(STA_MAX, player.sta + 28 * dt);
    if (player.act === "drink" && player.actT > 0.3) {
      player.hp = Math.min(player.hpMax, player.hp + 40);
    }
  }

  function draw() {
    ctx.fillStyle = "#1a1512";
    ctx.fillRect(0, 0, w, h);

    // Ground grid (2D only)
    ctx.strokeStyle = "#2a221c";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Foes
    for (const f of foes) {
      if (f.hp <= 0) continue;
      ctx.fillStyle = f.kind === "duke" ? "#6a3a3a" : "#4a4a4a";
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e85d04";
      ctx.fillRect(f.x - f.r, f.y - f.r - 8, (f.hp / f.hpMax) * f.r * 2, 4);
    }

    // Player (pink bow accent)
    ctx.fillStyle = "#b8c0c8";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e7a0b0";
    ctx.fillRect(player.x + 6, player.y - 10, 6, 6);
    if (player.invuln > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HUD
    ctx.fillStyle = "#f0e6d8";
    ctx.font = "14px sans-serif";
    ctx.fillText(`HP ${player.hp}/${player.hpMax}   STA ${Math.round(player.sta)}   Flask ${flasks}   v${GAME_VERSION}`, 16, 24);
    ctx.fillText("WASD move  J/Z light  K/X heavy  Space dodge  E flask", 16, h - 16);
  }

  function loop(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    hooks.onHud({
      phase: player.hp > 0 ? "play" : "dead",
      hp: player.hp,
      hpMax: player.hpMax,
      sta: player.sta,
      flasks,
      version: GAME_VERSION,
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    dispose() {
      running = false;
    },
    toggleMute() {},
    interact() {},
    rest() {},
    temper() {},
  };
}

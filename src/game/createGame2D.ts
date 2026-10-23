/**
 * Pure 2D Canvas game — no 3D scene.
 * Dark Souls-like combat (stamina, dodge i-frames, guard, posture) on a 2D plane.
 * Reuses moves / player / hitPath constants where possible.
 *
 * 2.0.4: the view eases after the knight on a world larger than the screen.
 * Wind-up / hit / recover cues read the existing plane hit span and actionEnd.
 */
import { MOVE, WALK, RUN, STA_MAX, FLASK_MAX, LIGHT_COMBO_DMGS } from "@/game/moves";
import { PLAYER, actionEnd } from "@/game/player";
import { GAME_VERSION } from "@/game/version";
import {
  PLANE_SHAKE,
  decayShake,
  planeAttackCue,
  planeCueFill,
  planeHitActive,
  planeWorldSize,
  shakeOffset,
  stepScreenCamera,
  type ScreenCam,
} from "@/game/screenFollow";

/** Cardinal frames: `public/sprites/<kind>/{n,e,s,w}.png` (sheet.json `dirs`). */
export const CANVAS_DIRS = ["n", "e", "s", "w"] as const;
export type CanvasDir = (typeof CANVAS_DIRS)[number];

const HOLLOW_DIR_BASE = "/sprites/hollow";
const MALLOW_DIR_BASE = "/sprites/mallow";
const PLAYER_SPRITE = 64;
const HOLLOW_SPRITE = 64;

/**
 * Screen yaw from `Math.atan2(dy, dx)`: 0 = east (+x), +π/2 = south (+y).
 * Do not reuse `mallowSprite.yawToDir` — that map is the old iso / Three facing.
 */
export function canvasYawToDir(yaw: number): CanvasDir {
  if (!Number.isFinite(yaw)) return "s";
  const tau = Math.PI * 2;
  const a = ((yaw % tau) + tau) % tau;
  const sector = Math.round(a / (Math.PI / 2)) % 4;
  return (["e", "s", "w", "n"] as const)[sector]!;
}

/** Facing hollow frame, or null so the caller keeps the silhouette + ember crack. */
export function hollowDirForYaw(ready: ReadonlySet<CanvasDir>, yaw: number): CanvasDir | null {
  const dir = canvasYawToDir(yaw);
  return ready.has(dir) ? dir : null;
}

/** Facing mallow frame, else south if that PNG loaded, else null (pink-bow arc). */
export function mallowDirForYaw(ready: ReadonlySet<CanvasDir>, yaw: number): CanvasDir | null {
  const facing = canvasYawToDir(yaw);
  if (ready.has(facing)) return facing;
  return ready.has("s") ? "s" : null;
}

export type HudSnap = {
  phase: string;
  hp: number;
  hpMax: number;
  sta: number;
  staMax: number;
  flasks: number;
  flaskMax: number;
  version: string;
  hurt: number;
  guard: number;
  staFlash: number;
  muted: boolean;
  webgl: boolean;
  ready: boolean;
  loadPct: number;
  menuOpen: boolean;
  bossHp: number | null;
  bossMax: number;
  bossShown: boolean;
  bossPhase: number;
  demonHp: number | null;
  demonMax: number;
  demonShown: boolean;
  demonName: string;
  lockName: string | null;
  punish: boolean;
  poise: number | null;
  poiseMax: number;
  banner: string;
  toast: string;
  lightCombo: number;
  nearItem: string;
  nearFire: boolean;
  canTemper: boolean;
  clears: number;
  bestMs: number | null;
  hotbarSelected: number;
  hotbarFilled: [boolean, boolean, boolean, boolean];
  hasAshToken: boolean;
  hasFlaskShard: boolean;
  hasTorch: boolean;
  hasExplosive: boolean;
  hasHealHerb: boolean;
};

/** Overlay defaults for the 2D shell. Live combat fields are overwritten each frame. */
export const INITIAL_PLANE_HUD: HudSnap = {
  phase: "play",
  hp: 120,
  hpMax: 120,
  sta: STA_MAX,
  staMax: STA_MAX,
  flasks: FLASK_MAX,
  flaskMax: FLASK_MAX,
  version: GAME_VERSION,
  hurt: 0,
  guard: 0,
  staFlash: 0,
  muted: true,
  webgl: true,
  ready: true,
  loadPct: 100,
  menuOpen: false,
  bossHp: null,
  bossMax: 280,
  bossShown: false,
  bossPhase: 1,
  demonHp: null,
  demonMax: 150,
  demonShown: false,
  demonName: "",
  lockName: null,
  punish: false,
  poise: null,
  poiseMax: 1,
  banner: "",
  toast: "",
  lightCombo: 0,
  nearItem: "",
  nearFire: false,
  canTemper: false,
  clears: 0,
  bestMs: null,
  hotbarSelected: 0,
  hotbarFilled: [false, false, false, false],
  hasAshToken: false,
  hasFlaskShard: false,
  hasTorch: false,
  hasExplosive: false,
  hasHealHerb: false,
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
  flash: number;
};

export type PlaneGame = {
  dispose: () => void;
  toggleMute: () => void;
  interact: () => void;
  rest: () => void;
  temper: () => void;
};

export function createGame2D(
  canvas: HTMLCanvasElement,
  hooks: { onHud: (hud: HudSnap) => void },
): PlaneGame {
  const ctx = canvas.getContext("2d")!;
  let w = 0;
  let h = 0;

  function measure() {
    const nextW = canvas.clientWidth || w || 800;
    const nextH = canvas.clientHeight || h || 600;
    if (nextW === w && nextH === h && canvas.width > 0) return;
    w = nextW;
    h = nextH;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  measure();

  const world = planeWorldSize(w, h);
  const worldW = world.w;
  const worldH = world.h;

  const player: Actor = {
    x: worldW / 2,
    y: worldH / 2,
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
    flash: 0,
  };

  const foes: Actor[] = [
    {
      x: player.x - 120,
      y: player.y - 40,
      vx: 0,
      vy: 0,
      yaw: 0,
      hp: 60,
      hpMax: 60,
      r: 18,
      act: "free",
      actT: 0,
      atk: "light",
      combo: 0,
      sta: 100,
      invuln: 0,
      dodgeX: 0,
      dodgeY: 0,
      kind: "hollow",
      flash: 0,
    },
    {
      x: player.x + 100,
      y: player.y - 80,
      vx: 0,
      vy: 0,
      yaw: 0,
      hp: 90,
      hpMax: 90,
      r: 22,
      act: "free",
      actT: 0,
      atk: "light",
      combo: 0,
      sta: 100,
      invuln: 0,
      dodgeX: 0,
      dodgeY: 0,
      kind: "duke",
      flash: 0,
    },
  ];

  let cam: ScreenCam = stepScreenCamera(
    { x: player.x - w / 2, y: player.y - h / 2 },
    player.x,
    player.y,
    w,
    h,
    worldW,
    worldH,
    0,
  );
  let shake = 0;
  let hurtFlash = 0;
  let staFlash = 0;
  let time = 0;
  let swingShook = false;

  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent, down: boolean) => {
    if (down) keys.add(e.code);
    else keys.delete(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code))
      e.preventDefault();
  };
  const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
  const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const onResize = () => measure();
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
  ro?.observe(canvas);

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
    if (player.sta < cost) {
      staFlash = 1;
      return;
    }
    player.sta -= cost;
    player.act = "attack";
    player.actT = 0;
    player.atk = heavy ? "heavy" : "light";
    player.combo = heavy ? 0 : (player.combo + 1) % 3;
  }

  function dodge() {
    if (player.act !== "free") return;
    if (player.sta < MOVE.dodgeCost) {
      staFlash = 1;
      return;
    }
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
    time += dt;
    shake = decayShake(shake, dt);
    hurtFlash = Math.max(0, hurtFlash - dt * 2.8);
    staFlash = Math.max(0, staFlash - dt * 2.2);
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

    player.x = Math.max(40, Math.min(worldW - 40, player.x + player.vx * dt));
    player.y = Math.max(40, Math.min(worldH - 40, player.y + player.vy * dt));

    // Simple foe AI: walk toward player
    for (const f of foes) {
      f.flash = Math.max(0, f.flash - dt * 3.2);
      if (f.hp <= 0) continue;
      const dx = player.x - f.x;
      const dy = player.y - f.y;
      const dist = Math.hypot(dx, dy) || 1;
      f.x = Math.max(f.r, Math.min(worldW - f.r, f.x + (dx / dist) * 28 * dt));
      f.y = Math.max(f.r, Math.min(worldH - f.r, f.y + (dy / dist) * 28 * dt));
      // Hit player
      if (dist < player.r + f.r && player.invuln <= 0 && player.act !== "dodge") {
        player.hp = Math.max(0, player.hp - 12);
        player.invuln = 0.4;
        hurtFlash = 1;
        shake = Math.max(shake, PLANE_SHAKE.hurt);
      }
    }

    // Player attack hit — same span as before (PLANE_HIT_OPEN/SHUT).
    if (planeHitActive(player.act, player.actT)) {
      if (!swingShook) {
        shake = Math.max(shake, player.atk === "heavy" ? PLANE_SHAKE.heavy : PLANE_SHAKE.hit);
        swingShook = true;
      }
      const dmg = player.atk === "heavy" ? MOVE.heavyDmg : (LIGHT_COMBO_DMGS[player.combo] ?? 22);
      for (const f of foes) {
        if (f.hp <= 0) continue;
        const dx = f.x - player.x;
        const dy = f.y - player.y;
        if (Math.hypot(dx, dy) < player.r + f.r + 18) {
          f.hp = Math.max(0, f.hp - dmg);
          f.flash = 1;
        }
      }
    } else {
      swingShook = false;
    }

    if (player.sta < STA_MAX) player.sta = Math.min(STA_MAX, player.sta + 28 * dt);
    if (player.act === "drink" && player.actT > 0.3) {
      player.hp = Math.min(player.hpMax, player.hp + 40);
    }

    cam = stepScreenCamera(cam, player.x, player.y, w, h, worldW, worldH, dt);
  }

  // 2.0.3: dir PNGs via drawImage. Three.js sheet loader stays off this path.
  // Miss / not loaded → hollow silhouette + ember crack, player pink-bow arc.
  function loadDirSprites(base: string): {
    images: Record<CanvasDir, HTMLImageElement>;
    ready: Set<CanvasDir>;
  } {
    const ready = new Set<CanvasDir>();
    const images = {} as Record<CanvasDir, HTMLImageElement>;
    for (const dir of CANVAS_DIRS) {
      const image = new Image();
      const mark = () => {
        if (image.naturalWidth > 0) ready.add(dir);
      };
      image.onload = mark;
      image.onerror = () => {
        ready.delete(dir);
      };
      image.src = `${base}/${dir}.png`;
      if (image.complete) mark();
      images[dir] = image;
    }
    return { images, ready };
  }

  const hollowSprites = loadDirSprites(HOLLOW_DIR_BASE);
  const mallowSprites = loadDirSprites(MALLOW_DIR_BASE);

  function drawDirFrame(
    set: { images: Record<CanvasDir, HTMLImageElement>; ready: Set<CanvasDir> },
    dir: CanvasDir | null,
    x: number,
    y: number,
    size: number,
    nearest: boolean,
  ): boolean {
    if (!dir || !set.ready.has(dir)) return false;
    const image = set.images[dir];
    if (!image.complete || image.naturalWidth <= 0) return false;
    const prevSmooth = ctx.imageSmoothingEnabled;
    if (nearest) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    if (nearest) ctx.imageSmoothingEnabled = prevSmooth;
    return true;
  }

  function drawFoeFallback(f: Actor) {
    ctx.fillStyle = f.kind === "duke" ? "#3a2220" : "#2a2a2a";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e85d04";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.x - f.r * 0.4, f.y - f.r * 0.2);
    ctx.lineTo(f.x + f.r * 0.3, f.y + f.r * 0.4);
    ctx.stroke();
  }

  function drawFloor() {
    const tile = 96;
    const x0 = Math.floor((cam.x - tile) / tile) * tile;
    const y0 = Math.floor((cam.y - tile) / tile) * tile;
    const x1 = cam.x + w + tile;
    const y1 = cam.y + h + tile;
    for (let x = x0; x < x1; x += tile) {
      for (let y = y0; y < y1; y += tile) {
        const ix = Math.floor(x / tile);
        const iy = Math.floor(y / tile);
        ctx.fillStyle = (ix + iy) % 2 === 0 ? "#14110e" : "#1c1714";
        ctx.fillRect(x, y, tile + 0.5, tile + 0.5);
      }
    }
    ctx.strokeStyle = "rgba(232,93,4,0.38)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, worldW - 6, worldH - 6);
  }

  function drawTelegraphBar(x: number, y: number, fill: number, color: string) {
    const bw = 40;
    const bh = 5;
    const left = x - bw / 2;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(left, y, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(left, y, bw * Math.max(0, Math.min(1, fill)), bh);
  }

  function drawPlaneCues() {
    const heavy = player.atk === "heavy";
    const cue = planeAttackCue(player.act, player.actT, heavy);
    const fill = planeCueFill(player.actT, heavy, cue);
    if (cue === "windup") {
      const color = heavy ? "#ff7a2f" : "#e85d04";
      const radius = player.r + 14 + (heavy ? 6 : 0);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = heavy ? 5 : 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = heavy ? 6 : 5;
      ctx.beginPath();
      ctx.arc(
        player.x,
        player.y,
        radius + 6,
        -Math.PI / 2,
        -Math.PI / 2 + Math.max(0.12, fill) * Math.PI * 2,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawTelegraphBar(player.x, player.y - 46, fill, color);
    } else if (cue === "active") {
      ctx.strokeStyle = "rgba(243,239,231,0.95)";
      ctx.lineWidth = heavy ? 5 : 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + (heavy ? 28 : 22), player.yaw - 0.9, player.yaw + 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.yaw) * 8, player.y + Math.sin(player.yaw) * 8);
      ctx.lineTo(
        player.x + Math.cos(player.yaw) * (player.r + (heavy ? 40 : 30)),
        player.y + Math.sin(player.yaw) * (player.r + (heavy ? 40 : 30)),
      );
      ctx.stroke();
    } else if (cue === "recover") {
      ctx.strokeStyle = `rgba(231,160,176,${0.35 + fill * 0.55})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 16, 0, Math.PI * 2);
      ctx.stroke();
      drawTelegraphBar(player.x, player.y - 46, fill, "#e7a0b0");
    }

    if (player.act === "dodge") {
      ctx.strokeStyle = "rgba(243,239,231,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 8 + player.actT * 18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (player.invuln > 0 || hurtFlash > 0) {
      ctx.strokeStyle = `rgba(226,59,59,${0.35 + hurtFlash * 0.55})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0f0c0a");
    bg.addColorStop(1, "#1c1612");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const kick = shakeOffset(time, shake);
    ctx.save();
    ctx.translate(-Math.round(cam.x + kick.x), -Math.round(cam.y + kick.y));
    drawFloor();

    // Foes — hollow dir PNG when loaded; else silhouette + ember crack. Duke stays arc.
    for (const f of foes) {
      if (f.hp <= 0) continue;
      let drewSprite = false;
      if (f.kind === "hollow") {
        const face = Math.atan2(player.y - f.y, player.x - f.x);
        drewSprite = drawDirFrame(
          hollowSprites,
          hollowDirForYaw(hollowSprites.ready, face),
          f.x,
          f.y,
          HOLLOW_SPRITE,
          true,
        );
      }
      if (!drewSprite) drawFoeFallback(f);
      if (f.flash > 0) {
        ctx.strokeStyle = `rgba(255,244,230,${0.35 + 0.6 * f.flash})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, (drewSprite ? 30 : f.r) + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      const barTop = drewSprite ? HOLLOW_SPRITE / 2 + 8 : f.r + 10;
      ctx.fillStyle = "#e85d04";
      ctx.fillRect(f.x - f.r, f.y - barTop, (f.hp / f.hpMax) * f.r * 2, 3);
    }

    // Player — facing dir PNG, else s.png, else pink-bow arc
    const mallowDir = mallowDirForYaw(mallowSprites.ready, player.yaw);
    if (!drawDirFrame(mallowSprites, mallowDir, player.x, player.y, PLAYER_SPRITE, false)) {
      ctx.fillStyle = "#8a9298";
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e7a0b0";
      ctx.fillRect(player.x + 8, player.y - 12, 8, 8);
    }
    drawPlaneCues();
    ctx.restore();

    const vig = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, Math.max(w, h) * 0.7);
    vig.addColorStop(0, "rgba(232,93,4,0.05)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const edgeA = Math.max(player.sta < MOVE.lightCost ? 0.28 : 0, staFlash * 0.55);
    if (edgeA > 0) {
      ctx.fillStyle = `rgba(214,195,122,${edgeA})`;
      ctx.fillRect(0, 0, w, 8);
      ctx.fillRect(0, h - 8, w, 8);
      ctx.fillRect(0, 0, 8, h);
      ctx.fillRect(w - 8, 0, 8, h);
    }

    // HUD
    ctx.fillStyle = "#f0e6d8";
    ctx.font = "13px sans-serif";
    ctx.fillText(
      `HP ${player.hp}/${player.hpMax}   STA ${Math.round(player.sta)}   Flask ${flasks}   v${GAME_VERSION}`,
      16,
      24,
    );
    ctx.fillText("WASD move  J/Z light  K/X heavy  Space dodge  E flask", 16, h - 16);
  }

  function loop(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    hooks.onHud({
      ...INITIAL_PLANE_HUD,
      phase: player.hp > 0 ? "play" : "dead",
      hp: player.hp,
      hpMax: player.hpMax,
      sta: player.sta,
      flasks,
      hurt: hurtFlash,
      staFlash,
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    dispose() {
      running = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    },
    toggleMute() {},
    interact() {},
    rest() {},
    temper() {},
  };
}

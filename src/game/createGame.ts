import * as THREE from "three";
import { makeKnight, poseKnight, type KnightRig } from "@/game/knightMesh";
import { flashMallow, loadMallowRig } from "@/game/mallowRig";

export type Phase = "title" | "play" | "dead" | "win";

export type HudSnap = {
  phase: Phase;
  webgl: boolean;
  hp: number;
  hpMax: number;
  sta: number;
  staMax: number;
  flasks: number;
  flaskMax: number;
  ash: number;
  deaths: number;
  bestMs: number | null;
  clears: number;
  runMs: number;
  bossHp: number | null;
  bossMax: number;
  bossShown: boolean;
  bossPhase: number;
  lockName: string | null;
  nearFire: boolean;
  canTemper: boolean;
  toast: string;
  hurt: number;
  muted: boolean;
  gateOpen: boolean;
  demonShown: boolean;
  demonName: string;
  demonHp: number | null;
  demonMax: number;
};

export type GameApi = {
  begin: () => void;
  rise: () => void;
  again: () => void;
  rest: () => void;
  temper: () => void;
  attack: () => void;
  dodge: () => void;
  lock: () => void;
  flask: () => void;
  toggleMute: () => void;
  setStick: (x: number, y: number) => void;
  dispose: () => void;
};

const SAVE_KEY = "mallow-ashen-vow-v1";
const STEP = 1 / 60;
const STA_MAX = 100;
const FLASK_MAX = 4;
const WALK = 3.75;
const FIRE = { x: -3.1, z: 0.2 };
const SPAWN = { x: 0.35, z: 3.55 };
const GATE_Z = -8;
const MIN_X = -11;
const MAX_X = 11;
const MIN_Z = -18;
const MAX_Z = 8.2;
const PILLARS = [
  { x: -6.5, z: -8, r: 0.55 },
  { x: 6.5, z: -8, r: 0.55 },
  { x: -8.6, z: 2.2, r: 0.48 },
  { x: 8.6, z: 2.2, r: 0.48 },
  { x: -8.6, z: -13.2, r: 0.48 },
  { x: 8.6, z: -13.2, r: 0.48 },
];

type Act = "free" | "attack" | "dodge" | "drink" | "hurt";
type FoeState = "idle" | "chase" | "roar" | "telegraph" | "swing" | "recover" | "hurt" | "dodge" | "drink" | "dead";
type DukeMove = "cleave" | "overhead" | "shock" | "rush";

type Foe = {
  id: number;
  name: string;
  kind: "hollow" | "duke" | "demon";
  x: number;
  z: number;
  yaw: number;
  baseYaw: number;
  hp: number;
  hpMax: number;
  r: number;
  speed: number;
  dmg: number;
  range: number;
  windup: number;
  aggroR: number;
  state: FoeState;
  t: number;
  cd: number;
  swung: boolean;
  flash: number;
  aggro: boolean;
  move: DukeMove;
  enraged: boolean;
  chain: number;
  span: number;
  aimX: number;
  aimZ: number;
};

export const INITIAL_HUD: HudSnap = {
  phase: "title",
  webgl: true,
  hp: 100,
  hpMax: 100,
  sta: STA_MAX,
  staMax: STA_MAX,
  flasks: FLASK_MAX,
  flaskMax: FLASK_MAX,
  ash: 0,
  deaths: 0,
  bestMs: null,
  clears: 0,
  runMs: 0,
  bossHp: null,
  bossMax: 280,
  bossShown: false,
  bossPhase: 1,
  lockName: null,
  nearFire: false,
  canTemper: false,
  toast: "",
  hurt: 0,
  muted: true,
  gateOpen: false,
  demonShown: false,
  demonName: "紅契",
  demonHp: null,
  demonMax: 150,
};

function hash(i: number) {
  const x = Math.sin(i * 127.1 + 3.1) * 43758.5453;
  return x - Math.floor(x);
}

function dampAngle(current: number, target: number, speed: number, dt: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const max = speed * dt;
  return current + Math.max(-max, Math.min(max, diff));
}

function template(): Foe[] {
  const row = (
    id: number,
    name: string,
    kind: Foe["kind"],
    x: number,
    z: number,
    hp: number,
    speed: number,
    dmg: number,
    range: number,
    windup: number,
    aggroR: number,
    r: number,
  ): Foe => ({
    id,
    name,
    kind,
    x,
    z,
    yaw: Math.PI,
    baseYaw: Math.PI,
    hp,
    hpMax: hp,
    r,
    speed,
    dmg,
    range,
    windup,
    aggroR,
    state: "idle",
    t: 0,
    cd: 0.4,
    swung: false,
    flash: 0,
    aggro: false,
    move: "cleave",
    enraged: false,
    chain: 0,
    span: 1,
    aimX: 0,
    aimZ: 0,
  });
  return [
    row(1, "灰殼侍從", "hollow", -4.8, -1.8, 58, 2.05, 18, 1.55, 0.7, 6.4, 0.42),
    row(2, "灰殼侍從", "hollow", 4.4, -2.4, 58, 2.05, 18, 1.55, 0.66, 6.4, 0.42),
    row(3, "灰殼侍從", "hollow", 0.1, -5.4, 72, 2.15, 20, 1.6, 0.6, 6.6, 0.44),
    row(4, "煤灰公爵", "duke", 0, -14.1, 280, 1.7, 30, 2.15, 0.84, 10, 0.78),
    row(5, "紅契", "demon", 42, 42, 150, 2.65, 16, 1.7, 0.4, 7, 0.4),
  ];
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      setSteer?: (v: number) => void;
      getHp: () => number;
      strike: () => void;
      lockOn: () => void;
      foeSummary: () => { id: number; hp: number; state: string; d: number }[];
      getDebug: () => { x: number; z: number; speed: number; err: string; phase: string };
      tick: (n: number) => void;
    };
  }
}

export function createGame(
  canvas: HTMLCanvasElement,
  hooks: { onHud: (hud: HudSnap) => void },
): GameApi {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    hooks.onHud({ ...INITIAL_HUD, webgl: false });
    return noop();
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x1b1714);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1714);
  scene.fog = new THREE.FogExp2(0x1b1714, 0.02);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);

  const hemi = new THREE.HemisphereLight(0xe6d5c4, 0x3a2a22, 1.05);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xd5e0ee, 1.45);
  moon.position.set(7, 14, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 2;
  moon.shadow.camera.far = 36;
  moon.shadow.camera.left = -16;
  moon.shadow.camera.right = 16;
  moon.shadow.camera.top = 16;
  moon.shadow.camera.bottom = -16;
  moon.shadow.bias = -0.0006;
  scene.add(moon);

  const bonfireLight = new THREE.PointLight(0xff7a32, 22, 11, 2);
  bonfireLight.position.set(FIRE.x, 1.1, FIRE.z);
  scene.add(bonfireLight);
  const rim = new THREE.DirectionalLight(0xffc9a0, 0.7);
  rim.position.set(-2, 6, -10);
  scene.add(rim);
  const keyLight = new THREE.PointLight(0xffe2c4, 10, 10, 2);
  scene.add(keyLight);

  const stoneTex = makeStoneTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x6e655c,
    map: stoneTex,
    roughness: 0.96,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -4);
  ground.receiveShadow = true;
  scene.add(ground);

  const inlay = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 1 }),
  );
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(0, 0.012, -14);
  inlay.receiveShadow = true;
  scene.add(inlay);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.92 });
  const postGeo = new THREE.BoxGeometry(0.85, 1, 0.85);
  const addPost = (x: number, z: number, h: number) => {
    const m = new THREE.Mesh(postGeo, stoneMat);
    m.scale.y = h;
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  };
  for (let i = 0; i <= 12; i++) {
    const z = -17.2 + i * 2.05;
    addPost(-11, z, 1.1 + hash(i) * 1.7);
    addPost(11, z, 1.1 + hash(i + 20) * 1.7);
  }
  for (let i = 0; i <= 10; i++) {
    const x = -10 + i * 2.2;
    if (Math.abs(x) < 2.2) continue;
    addPost(x, 8.1, 1.3 + hash(i + 40) * 1.3);
    addPost(x, -17.6, 1.4 + hash(i + 60) * 1.5);
  }
  for (const p of PILLARS) addPost(p.x, p.z, 2.6);

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.45, 0.55),
    stoneMat,
  );
  beam.position.set(0, 2.55, GATE_Z);
  beam.castShadow = true;
  scene.add(beam);

  const fogMat = new THREE.MeshBasicMaterial({
    color: 0xcfc3b4,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fogWall = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.8), fogMat);
  fogWall.position.set(0, 1.35, GATE_Z);
  scene.add(fogWall);

  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
  for (const rot of [-0.4, 0.6, 1.4]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rot;
    log.position.set(FIRE.x + Math.sin(rot) * 0.12, 0.1, FIRE.z + Math.cos(rot) * 0.08);
    log.castShadow = true;
    scene.add(log);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 7),
    new THREE.MeshBasicMaterial({ color: 0xe85d04 }),
  );
  flame.position.set(FIRE.x, 0.48, FIRE.z);
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.32, 6),
    new THREE.MeshBasicMaterial({ color: 0xf6efe4 }),
  );
  core.position.set(FIRE.x, 0.42, FIRE.z);
  scene.add(flame, core);

  const emberPos = new Float32Array(18 * 3);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(
    emberGeo,
    new THREE.PointsMaterial({
      color: 0xe85d04,
      size: 0.055,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(embers);

  const sparkPos = new Float32Array(28 * 3);
  const sparkVel = new Float32Array(28 * 3);
  const sparkLife = new Float32Array(28);
  sparkPos.fill(-20);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      color: 0xf0d2a4,
      size: 0.07,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(sparks);

  let playerRig: KnightRig = makeKnight({
    fur: 0xc4a574,
    armor: 0xc5ced8,
    bow: true,
    helm: false,
    cape: true,
    eye: 0x241c18,
  });
  playerRig.root.rotation.order = "YXZ";
  scene.add(playerRig.root);
  loadMallowRig()
    .then((rig) => {
      const prev = playerRig.root;
      scene.remove(prev);
      playerRig = rig;
      playerRig.root.rotation.order = "YXZ";
      scene.add(playerRig.root);
    })
    .catch(() => {
      /* keep the procedural cat if the model fails to load */
    });

  const foeRigs: KnightRig[] = [];
  const foes = template();
  for (const f of foes) {
    const rig = makeKnight({
      fur: f.kind === "duke" ? 0x2c2624 : f.kind === "demon" ? 0x3a1418 : 0x6e5b49,
      armor: f.kind === "duke" ? 0x5c534c : f.kind === "demon" ? 0x7a2430 : 0x8d8680,
      bow: false,
      helm: f.kind === "duke" || f.kind === "demon",
      cape: f.kind === "demon",
      eye: f.kind === "hollow" ? 0x1a1412 : 0x2a0c08,
      eyeEmissive: f.kind === "duke" ? 0xff4d2e : f.kind === "demon" ? 0xff2430 : 0,
    });
    rig.root.rotation.order = "YXZ";
    rig.root.scale.setScalar(f.kind === "duke" ? 1.5 : f.kind === "demon" ? 1.08 : 0.96);
    rig.root.visible = f.kind !== "demon";
    scene.add(rig.root);
    foeRigs.push(rig);
  }

  const ringGeo = new THREE.RingGeometry(0.55, 0.72, 24);
  const rings: THREE.Mesh[] = foes.map((f) => {
    const mat = new THREE.MeshBasicMaterial({
      color: f.kind === "duke" ? 0xe85d04 : 0x9b2335,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
    return ring;
  });

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    new THREE.MeshStandardMaterial({
      color: 0xf3efe7,
      emissive: 0xe85d04,
      emissiveIntensity: 0.7,
      metalness: 0.4,
      roughness: 0.3,
    }),
  );
  scene.add(gem);

  const stain = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({
      color: 0xd6c37a,
      emissive: 0xe85d04,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    }),
  );
  stain.visible = false;
  scene.add(stain);

  const player = {
    x: SPAWN.x,
    z: SPAWN.z,
    yaw: 0,
    vx: 0,
    vz: 0,
    hp: 100,
    hpMax: 100,
    sta: STA_MAX,
    staDelay: 0,
    flasks: FLASK_MAX,
    act: "free" as Act,
    actT: 0,
    hitDone: false,
    healed: false,
    invuln: 0,
    dodgeX: 0,
    dodgeZ: -1,
  };

  let ash = 0;
  let deaths = 0;
  let bestMs: number | null = null;
  let clears = 0;
  let phase: Phase = "title";
  let camYaw = 0.15;
  let camDist = 6.1;
  let camHeight = 2.2;
  let gateOpen = false;
  let lockId: number | null = null;
  let dropped: { x: number; z: number; n: number } | null = null;
  let toast = "";
  let toastT = 0;
  let hurtV = 0;
  let shake = 0;
  let hitstop = 0;
  let winArm = 0;
  let invadeIn = 7;
  let runStart = 0;
  let frozenRun = 0;
  let muted = true;
  let warnedHollow = false;
  let stickX = 0;
  let stickY = 0;
  let qa: Set<string> | null = null;
  let sparkCursor = 0;
  let audioCtx: AudioContext | null = null;
  let emitAcc = 0;
  let lastKey = "";
  let simError = "";
  let disposed = false;

  loadSave();

  const keys = new Set<string>();
  const abort = new AbortController();
  const { signal } = abort;

  function held(code: string) {
    return (qa ?? keys).has(code);
  }

  function lockFoe() {
    return foes.find((f) => f.id === lockId && f.state !== "dead") ?? null;
  }

  function nearFire() {
    return Math.hypot(player.x - FIRE.x, player.z - FIRE.z) < 1.75;
  }

  function say(text: string) {
    toast = text;
    toastT = 2.8;
    emit(true);
  }

  function makeSnap(): HudSnap {
    const duke = foes[3]!;
    const demon = foes[4]!;
    const locked = lockFoe();
    const runMs = phase === "play" ? performance.now() - runStart : frozenRun;
    return {
      phase,
      webgl: true,
      hp: player.hp,
      hpMax: player.hpMax,
      sta: player.sta,
      staMax: STA_MAX,
      flasks: player.flasks,
      flaskMax: FLASK_MAX,
      ash,
      deaths,
      bestMs,
      clears,
      runMs,
      bossHp: duke.hp,
      bossMax: duke.hpMax,
      bossShown: duke.aggro && phase === "play",
      bossPhase: duke.enraged ? 2 : 1,
      lockName: locked ? locked.name : null,
      nearFire: phase === "play" && nearFire(),
      canTemper: phase === "play" && nearFire() && ash >= 200 && player.hpMax < 180,
      toast: toastT > 0 ? toast : "",
      hurt: hurtV,
      muted,
      gateOpen,
      demonShown: demon.aggro && demon.state !== "dead" && phase === "play",
      demonName: demon.name,
      demonHp: demon.hp,
      demonMax: demon.hpMax,
    };
  }

  function emit(force = false) {
    const snap = makeSnap();
    const key = [
      snap.phase,
      Math.round(snap.hp),
      snap.hpMax,
      Math.round(snap.sta),
      snap.flasks,
      snap.ash,
      snap.deaths,
      snap.bossShown ? Math.round(snap.bossHp ?? 0) : "-",
      snap.bossPhase,
      snap.lockName ?? "",
      snap.nearFire ? 1 : 0,
      snap.canTemper ? 1 : 0,
      snap.toast,
      snap.muted ? 1 : 0,
      snap.gateOpen ? 1 : 0,
      snap.demonShown ? Math.round(snap.demonHp ?? 0) : "-",
      snap.clears,
      snap.bestMs ?? "",
    ].join("|");
    if (!force && key === lastKey) return;
    lastKey = key;
    hooks.onHud(snap);
  }

  function save() {
    try {
      const data = JSON.stringify({
        deaths,
        hpMax: player.hpMax,
        bestMs,
        clears,
      });
      localStorage.setItem(SAVE_KEY, data);
    } catch {
      /* private mode */
    }
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        deaths?: number;
        hpMax?: number;
        bestMs?: number | null;
        clears?: number;
      };
      if (typeof parsed.deaths === "number") deaths = parsed.deaths;
      if (typeof parsed.hpMax === "number") {
        player.hpMax = Math.min(180, Math.max(100, parsed.hpMax));
        player.hp = player.hpMax;
      }
      if (typeof parsed.bestMs === "number") bestMs = parsed.bestMs;
      if (typeof parsed.clears === "number") clears = parsed.clears;
    } catch {
      /* ignore */
    }
  }

  function burst(x: number, y: number, z: number) {
    for (let i = 0; i < 8; i++) {
      const k = sparkCursor % 28;
      sparkCursor++;
      sparkPos[k * 3] = x;
      sparkPos[k * 3 + 1] = y;
      sparkPos[k * 3 + 2] = z;
      sparkVel[k * 3] = (hash(k + sparkCursor) - 0.5) * 4;
      sparkVel[k * 3 + 1] = 1.2 + hash(k + 5) * 2.4;
      sparkVel[k * 3 + 2] = (hash(k + 9) - 0.5) * 4;
      sparkLife[k] = 0.28 + hash(k) * 0.15;
    }
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.45), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function clampWorld(x: number, z: number, r: number, side: "north" | "south" | "any") {
    let nx = Math.max(MIN_X + r, Math.min(MAX_X - r, x));
    let nz = Math.max(MIN_Z + r, Math.min(MAX_Z - r, z));
    if (side === "north") nz = Math.max(nz, GATE_Z + r);
    if (side === "south") nz = Math.min(nz, GATE_Z - r);
    if (side === "any" && !gateOpen) nz = Math.max(nz, GATE_Z + 0.35);
    for (const p of PILLARS) {
      const dx = nx - p.x;
      const dz = nz - p.z;
      const d = Math.hypot(dx, dz);
      const min = r + p.r;
      if (d < min) {
        const ux = d < 1e-4 ? 1 : dx / d;
        const uz = d < 1e-4 ? 0 : dz / d;
        nx = p.x + ux * min;
        nz = p.z + uz * min;
      }
    }
    nx = Math.max(MIN_X + r, Math.min(MAX_X - r, nx));
    nz = Math.max(MIN_Z + r, Math.min(MAX_Z - r, nz));
    if (side === "north") nz = Math.max(nz, GATE_Z + r);
    if (side === "south") nz = Math.min(nz, GATE_Z - r);
    if (side === "any" && !gateOpen) nz = Math.max(nz, GATE_Z + 0.35);
    return { x: nx, z: nz };
  }

  function separate(ax: number, az: number, ar: number, bx: number, bz: number, br: number) {
    let dx = ax - bx;
    let dz = az - bz;
    let d = Math.hypot(dx, dz);
    const min = ar + br;
    if (d >= min) return { x: ax, z: az };
    if (d < 1e-4) {
      dx = 1;
      dz = 0;
      d = 1;
    }
    const push = (min - d) * 0.7;
    return { x: ax + (dx / d) * push, z: az + (dz / d) * push };
  }

  function placeAtBonfire() {
    player.x = FIRE.x + 1.15;
    player.z = FIRE.z + 0.35;
    player.yaw = 0;
    player.vx = 0;
    player.vz = 0;
    player.act = "free";
    player.actT = 0;
    player.hp = player.hpMax;
    player.sta = STA_MAX;
    player.flasks = FLASK_MAX;
    player.invuln = 1;
    camYaw = 0;
  }

  function resetFoes() {
    const fresh = template();
    for (let i = 0; i < foes.length; i++) Object.assign(foes[i]!, fresh[i]!);
    gateOpen = false;
    lockId = null;
    warnedHollow = false;
    winArm = 0;
    invadeIn = 7;
  }

  function hurtPlayer(amount: number) {
    if (phase !== "play" || player.hp <= 0 || player.invuln > 0) return;
    if (player.act === "dodge" && player.actT > 0.05 && player.actT < 0.3) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.62;
    hurtV = 1;
    shake = Math.max(shake, 0.28);
    hitstop = Math.max(hitstop, 0.06);
    tone(90, 0.2, "sawtooth", 0.05);
    if (player.hp <= 0) {
      die();
      return;
    }
    player.act = "hurt";
    player.actT = 0;
    emit(true);
  }

  function die() {
    if (ash > 0) dropped = { x: player.x, z: player.z, n: ash };
    ash = 0;
    player.hp = 0;
    player.vx = 0;
    player.vz = 0;
    deaths += 1;
    frozenRun = performance.now() - runStart;
    phase = "dead";
    lockId = null;
    save();
    say("灰燼留在原地");
    emit(true);
  }

  function spendSta(cost: number) {
    if (player.sta < cost) {
      shake = Math.max(shake, 0.08);
      return false;
    }
    player.sta -= cost;
    player.staDelay = 0.48;
    return true;
  }

  function tryAttack() {
    if (phase !== "play" || player.act !== "free") return;
    if (!spendSta(22)) return;
    player.act = "attack";
    player.actT = 0;
    player.hitDone = false;
    tone(210, 0.12, "triangle", 0.06);
  }

  function tryDodge() {
    if (phase !== "play" || player.act !== "free") return;
    if (!spendSta(28)) return;
    const { ix, iz, mag } = wishDir();
    if (mag > 0.2) {
      player.dodgeX = ix / mag;
      player.dodgeZ = iz / mag;
    } else {
      player.dodgeX = -Math.sin(player.yaw);
      player.dodgeZ = -Math.cos(player.yaw);
    }
    player.act = "dodge";
    player.actT = 0;
    const face = Math.atan2(-player.dodgeX, -player.dodgeZ);
    player.yaw = face;
    tone(140, 0.08, "sine", 0.04);
  }

  function tryFlask() {
    if (phase !== "play" || player.act !== "free") return;
    if (player.flasks <= 0 || player.hp >= player.hpMax) return;
    player.flasks -= 1;
    player.act = "drink";
    player.actT = 0;
    player.healed = false;
    tone(320, 0.18, "sine", 0.04);
  }

  function tryLock() {
    if (phase !== "play") return;
    const cands = foes
      .filter((f) => f.state !== "dead" && Math.hypot(f.x - player.x, f.z - player.z) < 14)
      .filter((f) => (f.kind === "duke" ? gateOpen : f.kind === "demon" ? f.aggro : true))
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    if (!cands.length) {
      lockId = null;
      emit(true);
      return;
    }
    if (lockId == null) {
      lockId = cands[0]!.id;
    } else if (cands.length === 1 && cands[0]!.id === lockId) {
      lockId = null;
    } else {
      const i = cands.findIndex((c) => c.id === lockId);
      lockId = cands[(i + 1) % cands.length]!.id;
    }
    emit(true);
  }

  function rest() {
    if (phase !== "play" || player.act !== "free" || !nearFire()) return;
    player.hp = player.hpMax;
    player.flasks = FLASK_MAX;
    player.sta = STA_MAX;
    tone(180, 0.3, "sine", 0.05);
    say("火芯承認你了");
  }

  function temper() {
    if (phase !== "play" || !nearFire()) return;
    if (player.hpMax >= 180) {
      say("生命已經鍛滿");
      return;
    }
    if (ash < 200) {
      say("灰不夠，需要 200");
      return;
    }
    ash -= 200;
    player.hpMax += 12;
    player.hp = player.hpMax;
    save();
    tone(240, 0.22, "triangle", 0.05);
    say("誓約更厚了一層");
  }

  function wishDir() {
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let ix = 0;
    let iz = 0;
    if (held("KeyW") || held("ArrowUp")) {
      ix += fx;
      iz += fz;
    }
    if (held("KeyS") || held("ArrowDown")) {
      ix -= fx;
      iz -= fz;
    }
    if (held("KeyD") || held("ArrowRight")) {
      ix += rx;
      iz += rz;
    }
    if (held("KeyA") || held("ArrowLeft")) {
      ix -= rx;
      iz -= rz;
    }
    ix += rx * stickX + fx * stickY;
    iz += rz * stickX + fz * stickY;
    const mag = Math.hypot(ix, iz);
    return { ix, iz, mag };
  }

  function startDukeMove(f: Foe, dist: number, p2: boolean) {
    let move: DukeMove;
    if (dist > 4.5) move = Math.random() < 0.72 ? "rush" : "overhead";
    else if (p2 && dist < 2.2 && Math.random() < 0.42) move = "shock";
    else if (Math.random() < 0.48) move = "overhead";
    else move = "cleave";
    f.move = move;
    f.chain = move === "cleave" && p2 && Math.random() < 0.7 ? 1 : 0;
    f.state = "telegraph";
    f.t = 0;
    f.swung = false;
    const slow = p2 ? 0.84 : 1;
    f.span = (move === "overhead" ? 1.08 : move === "shock" ? 0.92 : move === "rush" ? 0.62 : 0.74) * slow;
  }

  function stepDuke(f: Foe, dt: number, dx: number, dz: number, dist: number) {
    const p2 = f.hp < f.hpMax * 0.5;
    if (p2 && !f.enraged) {
      f.enraged = true;
      say("第二階段。連段，還有震地");
      tone(70, 0.4, "sawtooth", 0.06);
      shake = Math.max(shake, 0.4);
    }
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
      if (f.t > (p2 ? 0.16 : 0.28)) {
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
        if (f.move === "rush") {
          f.aimX = -Math.sin(f.yaw);
          f.aimZ = -Math.cos(f.yaw);
        }
        f.span = f.move === "shock" ? 0.5 : f.move === "rush" ? 0.42 : f.move === "overhead" ? 0.18 : 0.22;
      }
      return;
    }
    if (f.state === "swing") {
      f.t += dt;
      if (f.move === "rush") {
        const c = clampWorld(f.x + f.aimX * 8.6 * dt, f.z + f.aimZ * 8.6 * dt, f.r, "south");
        f.x = c.x;
        f.z = c.z;
        if (!f.swung && f.t > 0.05 && Math.hypot(player.x - f.x, player.z - f.z) < f.r + 0.9) {
          f.swung = true;
          hurtPlayer(28);
        }
      } else if (f.move === "shock") {
        if (!f.swung && f.t > 0.4) {
          f.swung = true;
          if (Math.hypot(player.x - f.x, player.z - f.z) < 2.9) {
            hurtPlayer(32);
            shake = Math.max(shake, 0.48);
            hitstop = Math.max(hitstop, 0.08);
            tone(52, 0.3, "square", 0.06);
          }
        }
      } else {
        if (f.t < 0.14) {
          const fx = -Math.sin(f.yaw);
          const fz = -Math.cos(f.yaw);
          const lunge = f.move === "overhead" ? 2.6 : 1.7;
          const c = clampWorld(f.x + fx * lunge * dt, f.z + fz * lunge * dt, f.r, "south");
          f.x = c.x;
          f.z = c.z;
        }
        if (!f.swung && f.t > 0.04) {
          f.swung = true;
          const fx = -Math.sin(f.yaw);
          const fz = -Math.cos(f.yaw);
          const px = player.x - f.x;
          const pz = player.z - f.z;
          const nd = Math.hypot(px, pz) || 0.0001;
          const dot = (fx * px + fz * pz) / nd;
          const reach = f.move === "overhead" ? 2.4 : 2.6;
          if (nd < reach && dot > (f.move === "overhead" ? 0.28 : 0.12)) hurtPlayer(f.move === "overhead" ? 40 : 24);
        }
      }
      if (f.t >= f.span) {
        f.state = "recover";
        f.t = 0;
        f.span =
          f.chain > 0 ? 0.2 : f.move === "overhead" ? 1.08 : f.move === "shock" ? 1.22 : f.move === "rush" ? 0.8 : 0.74;
      }
      return;
    }
    if (f.state === "recover") {
      f.t += dt;
      if (f.t >= f.span) {
        if (f.chain > 0) {
          f.chain -= 1;
          f.move = "cleave";
          f.state = "telegraph";
          f.t = 0;
          f.swung = false;
          f.span = p2 ? 0.4 : 0.52;
        } else {
          f.state = "chase";
          f.cd = p2 ? 0.34 : 0.58;
        }
      }
      return;
    }

    if (f.cd <= 0 && (dist < 2.65 || dist > 4.55)) {
      startDukeMove(f, dist, p2);
      return;
    }
    if (dist > 2.05) {
      const sp = f.speed * (p2 ? 1.24 : 1);
      const c = clampWorld(f.x + (dx / dist) * sp * dt, f.z + (dz / dist) * sp * dt, f.r, "south");
      f.x = c.x;
      f.z = c.z;
    }
  }

  function stepDemon(f: Foe, dt: number, dx: number, dz: number, dist: number) {
    if (f.state !== "dodge" && !(f.state === "swing" && f.move === "rush")) {
      f.yaw = dampAngle(f.yaw, Math.atan2(-dx, -dz), 8.5, dt);
    }

    if (f.state === "roar") {
      f.t += dt;
      if (f.t >= f.span) {
        f.state = "chase";
        f.t = 0;
        f.cd = 0.35;
      }
      return;
    }
    if (f.state === "hurt") {
      f.t += dt;
      if (f.t > 0.22) {
        f.state = "chase";
        f.t = 0;
      }
      return;
    }
    if (f.state === "dodge") {
      f.t += dt;
      const c = clampWorld(f.x + f.aimX * 7.4 * dt, f.z + f.aimZ * 7.4 * dt, f.r, "north");
      f.x = c.x;
      f.z = c.z;
      if (f.t >= f.span) {
        f.state = "chase";
        f.t = 0;
        f.cd = 0.28;
      }
      return;
    }
    if (f.state === "drink") {
      f.t += dt;
      if (!f.swung && f.t > 0.42) {
        f.hp = Math.min(f.hpMax, f.hp + 48);
        f.swung = true;
      }
      if (f.t > 0.72) {
        f.state = "chase";
        f.t = 0;
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
        if (f.move === "rush") {
          f.aimX = -Math.sin(f.yaw);
          f.aimZ = -Math.cos(f.yaw);
        }
        f.span = f.move === "rush" ? 0.32 : 0.16;
      }
      return;
    }
    if (f.state === "swing") {
      f.t += dt;
      if (f.move === "rush") {
        const c = clampWorld(f.x + f.aimX * 7.8 * dt, f.z + f.aimZ * 7.8 * dt, f.r, "north");
        f.x = c.x;
        f.z = c.z;
        if (!f.swung && f.t > 0.06 && Math.hypot(player.x - f.x, player.z - f.z) < f.r + 0.75) {
          f.swung = true;
          hurtPlayer(22);
        }
      } else if (!f.swung && f.t > 0.04) {
        f.swung = true;
        const fx = -Math.sin(f.yaw);
        const fz = -Math.cos(f.yaw);
        const px = player.x - f.x;
        const pz = player.z - f.z;
        const nd = Math.hypot(px, pz) || 0.0001;
        if (nd < 2.05 && (fx * px + fz * pz) / nd > 0.15) hurtPlayer(16);
      }
      if (f.t >= f.span) {
        f.state = "recover";
        f.t = 0;
        f.span = f.move === "rush" ? 0.55 : 0.36;
      }
      return;
    }
    if (f.state === "recover") {
      f.t += dt;
      if (f.t >= f.span) {
        f.state = "chase";
        f.t = 0;
        f.cd = 0.32;
      }
      return;
    }

    f.t += dt;
    const threatened = player.act === "attack" && player.actT > 0.06 && player.actT < 0.22 && dist < 2.55;
    if (threatened && f.cd <= 0) {
      const side = f.t * 3 > Math.PI ? 1 : -1;
      f.aimX = (-dz / dist) * side;
      f.aimZ = (dx / dist) * side;
      f.state = "dodge";
      f.t = 0;
      f.span = 0.28;
      return;
    }
    if (f.chain > 0 && f.hp < f.hpMax * 0.42 && dist > 2.15 && f.cd <= 0) {
      f.chain = 0;
      f.state = "drink";
      f.t = 0;
      f.swung = false;
      return;
    }
    if (f.cd <= 0 && dist < 2.05) {
      f.move = "cleave";
      f.state = "telegraph";
      f.t = 0;
      f.span = 0.38;
      f.swung = false;
      return;
    }
    if (f.cd <= 0 && dist > 3.15 && dist < 6.5) {
      f.move = "rush";
      f.state = "telegraph";
      f.t = 0;
      f.span = 0.42;
      f.swung = false;
      return;
    }
    const side = Math.sin(f.t * 2.4) * 0.9;
    const sp = dist > 2.3 ? f.speed : f.speed * 0.45;
    const c = clampWorld(
      f.x + ((dx / dist) * 0.8 + (-dz / dist) * side) * sp * dt,
      f.z + ((dz / dist) * 0.8 + (dx / dist) * side) * sp * dt,
      f.r,
      "north",
    );
    f.x = c.x;
    f.z = c.z;
  }

  function summonDemon() {
    const demon = foes[4];
    if (!demon || demon.aggro || demon.state === "dead") return;
    const c = clampWorld(
      player.x + Math.sin(player.yaw) * 4.4,
      player.z + Math.cos(player.yaw) * 4.4,
      demon.r,
      "north",
    );
    demon.x = c.x;
    demon.z = c.z;
    demon.yaw = Math.atan2(-(player.x - demon.x), -(player.z - demon.z));
    demon.hp = demon.hpMax;
    demon.aggro = true;
    demon.state = "roar";
    demon.t = 0;
    demon.span = 0.9;
    demon.move = "overhead";
    demon.chain = 1;
    demon.cd = 0.3;
    demon.swung = false;
    say("線上惡魔 紅契 侵入了");
    tone(78, 0.4, "sawtooth", 0.06);
    shake = Math.max(shake, 0.22);
  }

  function stepFoe(f: Foe, dt: number) {
    f.flash = Math.max(0, f.flash - dt);
    f.cd = Math.max(0, f.cd - dt);
    if (f.state === "dead") {
      f.t += dt;
      return;
    }
    if (f.hp <= 0) {
      f.state = "dead";
      f.t = 0;
      ash += f.kind === "duke" ? 420 : f.kind === "demon" ? 200 : 80;
      burst(f.x, 0.8, f.z);
      if (lockId === f.id) lockId = null;
      tone(70, 0.25, "square", 0.04);
      if (f.kind === "duke") winArm = 1.15;
      if (f.kind === "demon") say("紅契被逐回線上");
      return;
    }

    const dx = player.x - f.x;
    const dz = player.z - f.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    if (f.kind === "demon") {
      if (!f.aggro) return;
      stepDemon(f, dt, dx, dz, dist);
      return;
    }
    const canSee = f.kind === "hollow" || (gateOpen && player.z < GATE_Z + 0.15);
    if (!f.aggro && canSee && dist < f.aggroR) {
      f.aggro = true;
      if (f.kind === "duke") {
        f.state = "roar";
        f.t = 0;
        f.span = 1.05;
        f.move = "overhead";
        say("煤灰公爵醒來了");
      } else {
        f.state = "chase";
        if (!warnedHollow) {
          warnedHollow = true;
          say("灰殼看見你了");
        }
      }
    }
    if (!f.aggro) {
      f.yaw = f.baseYaw + Math.sin(performance.now() / 700 + f.id) * 0.12;
      return;
    }
    if (f.kind === "duke") {
      stepDuke(f, dt, dx, dz, dist);
      return;
    }

    const face = Math.atan2(-dx, -dz);
    f.yaw = dampAngle(f.yaw, face, 6.5, dt);

    if (f.state === "hurt") {
      f.t += dt;
      if (f.t > 0.2) f.state = "chase";
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
      if (!f.swung && f.t > 0.04) {
        f.swung = true;
        const fx = -Math.sin(f.yaw);
        const fz = -Math.cos(f.yaw);
        const dot = (fx * dx + fz * dz) / dist;
        if (dist < f.range + 0.2 && dot > 0.2) hurtPlayer(f.dmg);
      }
      if (f.t > 0.24) {
        f.state = "recover";
        f.t = 0;
        f.span = 0.42;
      }
      return;
    }
    if (f.state === "recover") {
      f.t += dt;
      if (f.t > 0.42) {
        f.state = "chase";
        f.cd = 0.5;
      }
      return;
    }

    if (dist <= f.range && f.cd <= 0) {
      f.state = "telegraph";
      f.t = 0;
      f.span = f.windup;
      f.move = "cleave";
      return;
    }
    if (dist > f.range * 0.82) {
      const nx = f.x + (dx / dist) * f.speed * dt;
      const nz = f.z + (dz / dist) * f.speed * dt;
      const c = clampWorld(nx, nz, f.r, "north");
      f.x = c.x;
      f.z = c.z;
    }
  }

  function step(dt: number) {
    if (phase !== "play") return;
    player.invuln = Math.max(0, player.invuln - dt);
    hurtV = Math.max(0, hurtV - dt * 1.6);
    if (toastT > 0) toastT -= dt;
    if (winArm > 0) {
      winArm -= dt;
      if (winArm <= 0) {
        phase = "win";
        clears += 1;
        frozenRun = performance.now() - runStart;
        if (bestMs == null || frozenRun < bestMs) bestMs = frozenRun;
        save();
        say("庭院安靜了");
        emit(true);
        return;
      }
    }

    if (player.act !== "free") {
      player.actT += dt;
      if (player.act === "drink" && !player.healed && player.actT > 0.34) {
        player.hp = Math.min(player.hpMax, player.hp + 48);
        player.healed = true;
      }
      if (player.act === "attack" && !player.hitDone && player.actT > 0.2 && player.actT < 0.38) {
        player.hitDone = true;
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        let any = false;
        for (const f of foes) {
          if (f.state === "dead") continue;
          const dx = f.x - player.x;
          const dz = f.z - player.z;
          const dist = Math.hypot(dx, dz) || 0.0001;
          const reach = 2.15 + f.r * 0.35;
          const dot = (fx * dx + fz * dz) / dist;
          if (dist < reach && dot > 0.22) {
            f.hp = Math.max(0, f.hp - 34);
            f.flash = 0.12;
            if (f.state !== "telegraph" && f.state !== "swing" && f.state !== "roar") {
              f.state = "hurt";
              f.t = 0;
            }
            burst(f.x, 0.9, f.z);
            any = true;
          }
        }
        if (any) {
          shake = Math.max(shake, 0.16);
          hitstop = Math.max(hitstop, 0.045);
          tone(160, 0.09, "square", 0.05);
        }
      }
      const end =
        player.act === "attack" ? 0.52 : player.act === "dodge" ? 0.46 : player.act === "drink" ? 0.82 : 0.3;
      if (player.actT >= end) {
        player.act = "free";
        player.actT = 0;
      }
    } else if (player.staDelay > 0) {
      player.staDelay -= dt;
    } else {
      player.sta = Math.min(STA_MAX, player.sta + 36 * dt);
    }

    const locked = lockFoe();
    const { ix, iz, mag } = wishDir();
    if (player.act === "free" && locked) {
      player.yaw = dampAngle(
        player.yaw,
        Math.atan2(-(locked.x - player.x), -(locked.z - player.z)),
        12,
        dt,
      );
    } else if (player.act === "free" && mag > 0.18) {
      player.yaw = dampAngle(player.yaw, Math.atan2(-ix, -iz), 12, dt);
    } else if (player.act === "attack" && locked) {
      player.yaw = dampAngle(
        player.yaw,
        Math.atan2(-(locked.x - player.x), -(locked.z - player.z)),
        10,
        dt,
      );
    }

    if (player.act === "free") {
      const scale = mag > 1 ? 1 / mag : 1;
      player.vx = ix * scale * WALK;
      player.vz = iz * scale * WALK;
    } else if (player.act === "dodge") {
      const u = player.actT / 0.4;
      const curve = u < 1 ? Math.sin(Math.min(1, u) * Math.PI) : 0;
      player.vx = player.dodgeX * 8.4 * curve;
      player.vz = player.dodgeZ * 8.4 * curve;
    } else if (player.act === "attack") {
      const lung = player.actT > 0.16 && player.actT < 0.36 ? 4.2 : 0;
      player.vx = -Math.sin(player.yaw) * lung;
      player.vz = -Math.cos(player.yaw) * lung;
    } else {
      player.vx = 0;
      player.vz = 0;
    }

    let moved = clampWorld(player.x + player.vx * dt, player.z + player.vz * dt, 0.38, "any");
    player.x = moved.x;
    player.z = moved.z;

    for (const f of foes) stepFoe(f, dt);
    const away = Math.hypot(player.x - FIRE.x, player.z - FIRE.z) > 2.5;
    const dukeBusy = foes[3]!.aggro && foes[3]!.state !== "dead";
    if (away && !dukeBusy && player.hp > 0) {
      invadeIn -= dt;
      if (invadeIn <= 0) summonDemon();
    }

    for (const f of foes) {
      if (f.state === "dead") continue;
      const sep = separate(player.x, player.z, 0.38, f.x, f.z, f.r);
      const c = clampWorld(sep.x, sep.z, 0.38, "any");
      player.x = c.x;
      player.z = c.z;
    }
    for (let i = 0; i < foes.length; i++) {
      for (let j = i + 1; j < foes.length; j++) {
        const a = foes[i]!;
        const b = foes[j]!;
        if (a.state === "dead" || b.state === "dead") continue;
        const sep = separate(a.x, a.z, a.r, b.x, b.z, b.r);
        const side = a.kind === "duke" ? "south" : "north";
        const c = clampWorld(sep.x, sep.z, a.r, side);
        a.x = c.x;
        a.z = c.z;
      }
    }

    if (dropped && Math.hypot(player.x - dropped.x, player.z - dropped.z) < 1.15) {
      ash += dropped.n;
      dropped = null;
      say("取回灰燼");
    }

    const hollowsAlive = foes.some((f) => f.kind === "hollow" && f.state !== "dead");
    if (!hollowsAlive && !gateOpen) {
      gateOpen = true;
      say("拱門散了");
    }

    if (locked) {
      const face = Math.atan2(-(locked.x - player.x), -(locked.z - player.z));
      camYaw = dampAngle(camYaw, face, 7, dt);
    }

    emitAcc += dt;
    if (emitAcc > 0.12) {
      emitAcc = 0;
      emit(false);
    }
  }

  function draw(time: number) {
    const titleDrift = phase === "title" ? Math.sin(time * 0.28) * 0.35 : 0;
    const yaw = camYaw + titleDrift;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const sh = shake > 0 ? Math.sin(time * 70) * shake * 0.18 : 0;
    const sv = shake > 0 ? Math.cos(time * 53) * shake * 0.1 : 0;
    camera.position.set(player.x - fx * camDist + sh, camHeight + sv, player.z - fz * camDist);
    camera.lookAt(player.x, 1.05, player.z);

    const moving =
      player.act === "free" && Math.hypot(player.vx, player.vz) > 0.4 ? 1 : 0;
    const blink = player.invuln > 0 && Math.sin(time * 28) > 0;
    playerRig.root.visible = !blink;
    playerRig.root.position.set(player.x, 0, player.z);
    playerRig.root.rotation.y = player.yaw + Math.PI;
    playerRig.root.rotation.x = 0;
    poseKnight(playerRig, time, moving, player.act, player.actT);
    const pf = player.act === "hurt" ? 0.45 : 0;
    if (playerRig.root.userData.mallow) flashMallow(playerRig.root, pf);
    else {
      playerRig.armorMat.emissive.setRGB(pf, pf * 0.4, pf * 0.3);
      playerRig.furMat.emissive.setRGB(pf * 0.3, pf * 0.15, pf * 0.1);
    }

    foes.forEach((f, i) => {
      const rig = foeRigs[i]!;
      const dead = f.state === "dead";
      const ring = rings[i]!;
      if (f.kind === "demon" && !f.aggro && !(dead && f.t < 1.5)) {
        rig.root.visible = false;
        ring.visible = false;
        return;
      }
      rig.root.visible = !(f.kind === "demon" && dead && f.t >= 1.5);
      const bob =
        dead ? -Math.min(0.45, f.t * 0.25) : f.kind === "duke" && f.state === "roar" ? Math.sin(f.t * 18) * 0.04 : 0;
      rig.root.position.set(f.x, bob, f.z);
      rig.root.rotation.y = f.yaw + Math.PI;
      rig.root.rotation.x = dead ? Math.min(1.2, f.t * 1.4) : 0;
      if (f.kind === "duke") rig.root.scale.setScalar(f.enraged ? 1.62 : 1.5);
      if (f.kind === "demon") rig.root.scale.setScalar(1.08);
      const mv = f.aggro && (f.state === "chase" || f.state === "idle") && !dead ? 1 : 0;
      const telling = f.state === "telegraph" || f.state === "swing" || f.state === "recover" || f.state === "roar";
      const act = dead || f.state === "hurt" ? "hurt" : f.state === "drink" ? "drink" : f.state === "dodge" ? "dodge" : "free";
      const actT = f.state === "hurt" || f.state === "drink" || f.state === "dodge" ? f.t : 0;
      poseKnight(
        rig,
        time + f.id,
        mv,
        act,
        actT,
        telling
          ? {
              state: f.state,
              move: f.move,
              u: f.span > 0 ? f.t / f.span : 0,
              boss: f.kind === "duke",
              phase2: f.enraged,
            }
          : undefined,
      );
      const fl = f.flash > 0 ? 0.7 : 0;
      rig.armorMat.emissive.setRGB(fl, fl * 0.5, fl * 0.3);
      rig.furMat.emissive.setRGB(fl * 0.4, fl * 0.2, fl * 0.15);
      if (f.kind === "duke" && f.enraged) {
        rig.eyeMat.emissive.setHex(0xff4d2e);
        rig.eyeMat.emissiveIntensity = 1.1 + Math.sin(time * 9) * 0.35;
      }
      if (f.kind === "demon") {
        const pulse = 0.7 + Math.sin(time * 7) * 0.2;
        rig.armorMat.emissive.setRGB(pulse, 0.08, 0.1);
        rig.furMat.emissive.setRGB(0.28, 0.04, 0.05);
        rig.eyeMat.emissive.setHex(0xff2430);
        rig.eyeMat.emissiveIntensity = 1.35;
      }
      const showRing = f.state === "telegraph" || f.state === "swing" || (f.kind === "demon" && f.aggro && !dead);
      ring.visible = showRing;
      ring.position.set(f.x, 0.04, f.z);
      const mat = ring.material as THREE.MeshBasicMaterial;
      const u = f.span > 0 ? f.t / f.span : 0;
      if (f.kind === "duke") {
        const warn = f.move === "shock" ? 0xff4d2e : f.move === "overhead" ? 0xf4d35e : f.move === "rush" ? 0xf6efe4 : 0xe85d04;
        mat.color.setHex(f.state === "swing" ? 0x9b2335 : warn);
        mat.opacity = f.state === "swing" ? 0.7 : 0.45;
        const sc = f.move === "shock" ? (f.state === "swing" ? 0.8 + u * 2.4 : 1.15 + u * 0.35) : f.state === "swing" ? 1.35 : 1.05 + u * 0.45;
        ring.scale.setScalar(sc);
      } else if (f.kind === "demon") {
        mat.color.setHex(f.state === "swing" ? 0xff4d4d : 0x9b2335);
        mat.opacity = f.state === "telegraph" || f.state === "swing" ? 0.7 : 0.4;
        ring.scale.setScalar(f.state === "swing" ? 1.2 : 0.95);
      } else {
        mat.color.setHex(0x9b2335);
        mat.opacity = 0.45;
        ring.scale.setScalar(f.state === "swing" ? 1.15 : 0.85 + u * 0.4);
      }
    });

    const locked = lockFoe();
    gem.visible = !!locked && phase === "play";
    if (locked) {
      gem.position.set(locked.x, 2.15 + Math.sin(time * 3) * 0.06, locked.z);
      gem.rotation.y = time * 2;
    }

    stain.visible = !!dropped;
    if (dropped) {
      stain.position.set(dropped.x, 0.35 + Math.sin(time * 3) * 0.06, dropped.z);
      stain.rotation.y = time;
    }

    fogMat.opacity = gateOpen ? Math.max(0, fogMat.opacity - 0.02) : 0.38;
    fogWall.visible = fogMat.opacity > 0.02;

    const flick = 0.85 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.05;
    flame.scale.set(1, flick, 1);
    core.scale.set(1, 0.85 + Math.sin(time * 11) * 0.1, 1);
    bonfireLight.intensity = 16 + Math.sin(time * 9) * 3;
    keyLight.position.set(player.x + 1.1, 2.3, player.z + 1.4);

    for (let i = 0; i < 18; i++) {
      const y = (time * 0.33 + hash(i)) % 1;
      const ang = hash(i + 2) * Math.PI * 2;
      const rad = (0.08 + hash(i + 4) * 0.32) * (1 - y);
      emberPos[i * 3] = FIRE.x + Math.cos(ang) * rad;
      emberPos[i * 3 + 1] = 0.2 + y * 1.25;
      emberPos[i * 3 + 2] = FIRE.z + Math.sin(ang) * rad;
    }
    emberGeo.attributes.position!.needsUpdate = true;

    for (let i = 0; i < 28; i++) {
      if (sparkLife[i]! <= 0) {
        sparkPos[i * 3 + 1] = -30;
        continue;
      }
      sparkLife[i] = (sparkLife[i] ?? 0) - 0.016;
      sparkPos[i * 3] = (sparkPos[i * 3] ?? 0) + (sparkVel[i * 3] ?? 0) * 0.016;
      sparkPos[i * 3 + 1] = (sparkPos[i * 3 + 1] ?? 0) + (sparkVel[i * 3 + 1] ?? 0) * 0.016;
      sparkPos[i * 3 + 2] = (sparkPos[i * 3 + 2] ?? 0) + (sparkVel[i * 3 + 2] ?? 0) * 0.016;
      sparkVel[i * 3 + 1] = (sparkVel[i * 3 + 1] ?? 0) - 6 * 0.016;
    }
    sparkGeo.attributes.position!.needsUpdate = true;

    if (shake > 0) shake = Math.max(0, shake - 0.016);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch" || e.button === 2 || e.button === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      if (e.button === 0) tryAttack();
    },
    { signal },
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (phase === "play" && Math.abs(dx) + Math.abs(dy) > 0) {
        if (Math.abs(dx) > 3) lockId = null;
        camYaw -= dx * 0.005;
        camHeight = Math.max(1.25, Math.min(3.5, camHeight - dy * 0.008));
      }
    },
    { signal },
  );
  window.addEventListener("pointerup", () => { dragging = false; }, { signal });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      camDist = Math.max(3.6, Math.min(8, camDist + Math.sign(e.deltaY) * 0.28));
    },
    { signal, passive: false },
  );

  window.addEventListener(
    "keydown",
    (e) => {
      keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat || phase !== "play") return;
      if (e.code === "Space") tryDodge();
      if (e.code === "KeyJ" || e.code === "KeyK") tryAttack();
      if (e.code === "KeyQ") tryLock();
      if (e.code === "KeyR") tryFlask();
      if (e.code === "KeyE") rest();
      if (e.code === "KeyF") temper();
    },
    { signal },
  );
  window.addEventListener("keyup", (e) => keys.delete(e.code), { signal });
  window.addEventListener("blur", () => keys.clear(), { signal });

  window.__controlsTest = {
    getYaw: () => player.yaw,
    getSpeed: () => Math.hypot(player.vx, player.vz),
    setKeys: (codes: string[]) => {
      qa = new Set(codes);
    },
    setSteer: (v: number) => {
      stickX = -v;
      stickY = 1;
    },
    getHp: () => player.hp,
    strike: () => tryAttack(),
    lockOn: () => tryLock(),
    foeSummary: () =>
      foes.map((f) => ({
        id: f.id,
        hp: Math.round(f.hp),
        state: f.state,
        d: Math.round(Math.hypot(f.x - player.x, f.z - player.z) * 10) / 10,
      })),
    getDebug: () => ({
      x: Math.round(player.x * 10) / 10,
      z: Math.round(player.z * 10) / 10,
      speed: Math.round(Math.hypot(player.vx, player.vz) * 10) / 10,
      err: simError,
      phase,
    }),
    tick: (n: number) => {
      for (let i = 0; i < n; i++) step(STEP);
    },
  };

  let acc = 0;
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    if (disposed) return;
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (hitstop > 0) {
      hitstop -= dt;
      dt *= 0.08;
    }
    if (phase === "play") {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        try {
          step(STEP);
        } catch (err) {
          simError = err instanceof Error ? err.message : String(err);
          acc = 0;
          break;
        }
        acc -= STEP;
        n++;
      }
    }
    draw(now / 1000);
  });

  emit(true);

  function begin() {
    if (phase === "play") return;
    phase = "play";
    camYaw = 0;
    player.yaw = 0;
    player.x = SPAWN.x;
    player.z = SPAWN.z;
    player.vx = 0;
    player.vz = 0;
    player.act = "free";
    runStart = performance.now();
    say("往拱門走。翻滾有短暫無敵。");
    emit(true);
  }

  function rise() {
    resetFoes();
    placeAtBonfire();
    phase = "play";
    runStart = performance.now();
    say("火芯把你拉回來了");
    emit(true);
  }

  function again() {
    resetFoes();
    ash = 0;
    dropped = null;
    placeAtBonfire();
    phase = "play";
    runStart = performance.now();
    emit(true);
  }

  function toggleMute() {
    muted = !muted;
    if (!muted) {
      const AC = window.AudioContext;
      audioCtx ??= new AC();
      void audioCtx.resume();
      tone(220, 0.12, "sine", 0.04);
    }
    emit(true);
  }

  function dispose() {
    disposed = true;
    abort.abort();
    ro.disconnect();
    renderer.setAnimationLoop(null);
    if (window.__controlsTest) delete window.__controlsTest;
    disposeObject(scene);
    stoneTex?.dispose();
    renderer.dispose();
  }

  return {
    begin,
    rise,
    again,
    rest,
    temper,
    attack: tryAttack,
    dodge: tryDodge,
    lock: tryLock,
    flask: tryFlask,
    toggleMute,
    setStick: (x, y) => {
      stickX = x;
      stickY = y;
    },
    dispose,
  };
}

function disposeObject(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) geos.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => mats.add(m));
    else if (material) mats.add(material);
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
}

function makeStoneTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#2a2622";
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const h = hash(x * 17 + y * 9);
      const shade = 36 + Math.floor(h * 30);
      g.fillStyle = `rgb(${shade + 10}, ${shade + 4}, ${shade - 2})`;
      const jx = (hash(x + y * 3) - 0.5) * 10;
      const jy = (hash(y * 4 + x) - 0.5) * 10;
      g.fillRect(x * 64 + 3 + jx, y * 64 + 3 + jy, 56, 56);
      g.strokeStyle = "#1a1614";
      g.strokeRect(x * 64 + 3 + jx, y * 64 + 3 + jy, 56, 56);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noop(): GameApi {
  return {
    begin: () => {},
    rise: () => {},
    again: () => {},
    rest: () => {},
    temper: () => {},
    attack: () => {},
    dodge: () => {},
    lock: () => {},
    flask: () => {},
    toggleMute: () => {},
    setStick: () => {},
    dispose: () => {},
  };
}

import * as THREE from "three";
import { makeKnight, poseKnight, type KnightRig } from "@/game/knightMesh";
import { flashMallow, loadMallowRig } from "@/game/mallowRig";
import { applyCamera, stepCamera } from "@/game/camera";
import { INITIAL_HUD, type GameApi, type HudSnap, type Phase } from "@/game/hud";
import {
  FIRE,
  FLASK_MAX,
  GATE_Z,
  MAX_X,
  MAX_Z,
  MIN_X,
  MIN_Z,
  MOVE,
  PILLARS,
  RUN,
  SAVE_KEY,
  SPAWN,
  STA_MAX,
  STEP,
  WALK,
  dampAngle,
  dukeTell,
  hash,
  template,
  type Act,
  type DukeMove,
  type Foe,
} from "@/game/moves";

export type { GameApi, HudSnap, Phase };
export { INITIAL_HUD };

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
  scene.background = new THREE.Color(0x2a221c);
  scene.fog = new THREE.FogExp2(0x3a3128, 0.045);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);

  const hemi = new THREE.HemisphereLight(0xf0d7b8, 0x2c241e, 1.25);
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
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.4, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x8a3d42, roughness: 0.9, side: THREE.DoubleSide }),
  );
  cloth.position.set(0, 1.7, GATE_Z + 0.08);
  scene.add(cloth);
  let clothDrop = 0;
  for (const sx of [-1, 1]) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.3, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 1 }),
    );
    crack.position.set(sx * 2.15, 1.1, GATE_Z + 0.28);
    crack.rotation.z = sx * 0.18;
    scene.add(crack);
  }
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 8.2),
    new THREE.MeshStandardMaterial({ color: 0x3c342e, roughness: 1 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(-1.2, 0.018, -3.6);
  scene.add(path);
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x4a433c, roughness: 1 });
  for (let i = 0; i < 7; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + hash(i) * 0.18, 0), rubbleMat);
    rock.position.set(-2.4 + hash(i + 2) * 4.8, 0.08, -2.2 + hash(i + 5) * 3.4);
    rock.rotation.set(hash(i) * 2, hash(i + 1) * 2, 0);
    rock.castShadow = true;
    scene.add(rock);
  }
  const ashPile = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 1 }),
  );
  ashPile.rotation.x = -Math.PI / 2;
  ashPile.position.set(FIRE.x + 0.2, 0.02, FIRE.z + 0.15);
  scene.add(ashPile);

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
  const ringStone = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.08, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0x4e463f, roughness: 0.95 }),
  );
  ringStone.rotation.x = Math.PI / 2;
  ringStone.position.set(FIRE.x, 0.08, FIRE.z);
  scene.add(ringStone);
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + hash(i + 8) * 0.04, 0), coalMat);
    const a = (i / 6) * Math.PI * 2;
    coal.position.set(FIRE.x + Math.cos(a) * 0.22, 0.05, FIRE.z + Math.sin(a) * 0.22);
    scene.add(coal);
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
  const tongue = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.28, 5),
    new THREE.MeshBasicMaterial({ color: 0xffb35c }),
  );
  tongue.position.set(FIRE.x + 0.05, 0.55, FIRE.z);
  scene.add(flame, core, tongue);

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

  const MOTES = 72;
  const motePos = new Float32Array(MOTES * 3);
  const moteCol = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = -10 + hash(i) * 20;
    motePos[i * 3 + 1] = 0.3 + hash(i + 3) * 3.4;
    motePos[i * 3 + 2] = -16 + hash(i + 7) * 22;
    moteSeed[i] = hash(i + 11) * Math.PI * 2;
    const warm = hash(i + 13) > 0.45;
    moteCol[i * 3] = warm ? 1 : 0.78;
    moteCol[i * 3 + 1] = warm ? 0.62 : 0.7;
    moteCol[i * 3 + 2] = warm ? 0.28 : 0.62;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute("color", new THREE.BufferAttribute(moteCol, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(motes);

  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xf3d7b0,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const shafts = [0, 1].map((i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 7.5), shaftMat.clone());
    mesh.position.set(i === 0 ? -4.2 : 3.6, 3.4, i === 0 ? -6.5 : -11);
    mesh.rotation.y = i === 0 ? 0.4 : -0.55;
    mesh.rotation.z = i === 0 ? 0.18 : -0.12;
    scene.add(mesh);
    return mesh;
  });

  const SPARKS = 96;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkCol = new Float32Array(SPARKS * 3);
  sparkPos.fill(-20);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      size: 0.11,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(sparks);
  const dustRing = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.58, 36),
    new THREE.MeshBasicMaterial({
      color: 0xd7c4a4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  dustRing.rotation.x = -Math.PI / 2;
  dustRing.visible = false;
  scene.add(dustRing);
  let dustT = 0;

  const slashMat = new THREE.MeshBasicMaterial({
    color: 0xffe7c2,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slashes = Array.from({ length: 4 }, () => {
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.35, 1.15, 18, 1, 0.2, 1.7), slashMat.clone());
    arc.visible = false;
    arc.userData.life = 0;
    scene.add(arc);
    return arc;
  });
  let slashCursor = 0;
  let hitFlash = 0;

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
    if (f.id === 3) {
      rig.root.scale.set(0.84, 1.04, 0.8);
      rig.weapon.scale.set(0.72, 0.7, 0.72);
    } else if (f.kind === "hollow") {
      rig.root.scale.set(1.14, 0.98, 1.16);
      const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.045, 8),
        new THREE.MeshStandardMaterial({ color: 0x6e675f, roughness: 0.7, metalness: 0.35 }),
      );
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.32, 0.86, 0.16);
      const boss = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xc6a15b, metalness: 0.6, roughness: 0.35 }),
      );
      boss.position.set(-0.34, 0.86, 0.2);
      rig.bob.add(shield, boss);
    } else if (f.kind === "duke") {
      rig.root.scale.set(1.55, 1.78, 1.55);
      rig.bob.traverse((o) => {
        if (o.position.y > 0.95 && o.position.x !== 0) o.scale.multiplyScalar(1.25);
      });
    } else {
      rig.root.scale.setScalar(1.08);
    }
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
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({ color: 0xf6efe4, transparent: true, opacity: 0.95, depthTest: false }),
  );
  gem.scale.set(1, 1.35, 1);
  const lockRing = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 4),
    new THREE.MeshBasicMaterial({ color: 0xe7a0b0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }),
  );
  lockRing.rotation.x = -Math.PI / 2;
  lockRing.rotation.z = Math.PI / 4;
  gem.add(lockRing);
  gem.visible = false;
  scene.add(gem);
  let gemX = SPAWN.x;
  let gemZ = SPAWN.z;

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
  const blockArc = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.86, 10, 1, -0.7, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xf3efe7, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  blockArc.rotation.x = -Math.PI / 2;
  blockArc.visible = false;
  scene.add(blockArc);

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
    atk: "light" as "light" | "heavy",
    combo: 0,
  };

  let ash = 0;
  let deaths = 0;
  let bestMs: number | null = null;
  let clears = 0;
  let phase: Phase = "title";
  let menuOpen = false;
  let camYaw = 0.15;
  let camDist = 6.1;
  let camHeight = 2.2;
  let camX = SPAWN.x;
  let camY = 2.2;
  let camZ = SPAWN.z + 6;
  let camKick = 0;
  let camPush = 0;
  let camRoll = 0;
  let fovKick = 0;
  let hurtDip = 0;
  let lastCamT = 0;
  let gateOpen = false;
  let lockId: number | null = null;
  let dropped: { x: number; z: number; n: number } | null = null;
  let toast = "";
  let toastT = 0;
  let banner = "";
  let bannerT = 0;
  let hurtV = 0;
  let guardV = 0;
  let staFlash = 0;
  let floaterId = 1;
  const floaters: { id: number; x: number; y: number; z: number; text: string; kind: string; life: number }[] = [];
  const floaterLayer = document.createElement("div");
  floaterLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:12;overflow:hidden;";
  (canvas.parentElement ?? document.body).appendChild(floaterLayer);
  const tellBars = new Map<number, THREE.Mesh>();
  let shake = 0;
  let hitstop = 0;
  let winArm = 0;
  let swingHits = new Set<number>();
  let invadeIn = 16;
  let heardSteel = false;
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
      poise: locked ? Math.max(0, locked.poiseMax - locked.poise) : null,
      poiseMax: locked ? locked.poiseMax : 1,
      punish: !!locked && (locked.state === "recover" || locked.state === "hurt"),
      banner: bannerT > 0 ? banner : "",
      nearFire: phase === "play" && nearFire(),
      canTemper: phase === "play" && nearFire() && ash >= 200 && player.hpMax < 180,
      toast: toastT > 0 ? toast : "",
      hurt: hurtV,
      guard: guardV,
      staFlash,
      muted,
      gateOpen,
      menuOpen,
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
      snap.banner,
      snap.nearFire ? 1 : 0,
      snap.canTemper ? 1 : 0,
      snap.toast,
      snap.muted ? 1 : 0,
      snap.gateOpen ? 1 : 0,
      snap.menuOpen ? 1 : 0,
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

  const SPARK_RGB: Record<string, [number, number, number]> = {
    steel: [0.96, 0.88, 0.72],
    pink: [1, 0.48, 0.68],
    ash: [1, 0.52, 0.18],
    dust: [0.78, 0.7, 0.6],
    demon: [1, 0.22, 0.24],
  };

  function popNum(x: number, y: number, z: number, text: string, kind: string) {
    floaters.push({ id: floaterId++, x, y, z, text, kind, life: 0.72 });
    if (floaters.length > 10) floaters.shift();
  }

  function burst(
    x: number,
    y: number,
    z: number,
    power = 1,
    dx = 0,
    dz = 0,
    kind: keyof typeof SPARK_RGB = "steel",
  ) {
    const n = power > 1.3 ? 20 : 12;
    const rgb = SPARK_RGB[kind];
    for (let i = 0; i < n; i++) {
      const k = sparkCursor % SPARKS;
      sparkCursor++;
      sparkPos[k * 3] = x + (hash(k + 3) - 0.5) * 0.2;
      sparkPos[k * 3 + 1] = y;
      sparkPos[k * 3 + 2] = z + (hash(k + 7) - 0.5) * 0.2;
      const spread = (hash(k + sparkCursor) - 0.5) * 3.2;
      const lift = kind === "dust" ? 0.35 : kind === "ash" ? 2.2 : 1.4;
      sparkVel[k * 3] = dx * (2.4 + power) + spread;
      sparkVel[k * 3 + 1] = lift + hash(k + 5) * (kind === "dust" ? 1.2 : 3.2) * power;
      sparkVel[k * 3 + 2] = dz * (2.4 + power) + (hash(k + 9) - 0.5) * 3.2;
      sparkLife[k] = (kind === "ash" ? 0.38 : 0.22) + hash(k) * 0.22;
      sparkCol[k * 3] = rgb[0];
      sparkCol[k * 3 + 1] = rgb[1];
      sparkCol[k * 3 + 2] = rgb[2];
    }
    sparkGeo.attributes.color!.needsUpdate = true;
  }

  function shockDust(x: number, z: number) {
    dustT = 0.48;
    dustRing.visible = true;
    dustRing.position.set(x, 0.05, z);
    dustRing.scale.setScalar(0.4);
    (dustRing.material as THREE.MeshBasicMaterial).opacity = 0.62;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const k = sparkCursor % SPARKS;
      sparkCursor++;
      sparkPos[k * 3] = x + Math.cos(a) * 0.45;
      sparkPos[k * 3 + 1] = 0.12;
      sparkPos[k * 3 + 2] = z + Math.sin(a) * 0.45;
      sparkVel[k * 3] = Math.cos(a) * 3.4;
      sparkVel[k * 3 + 1] = 0.4 + hash(k) * 0.8;
      sparkVel[k * 3 + 2] = Math.sin(a) * 3.4;
      sparkLife[k] = 0.36;
      sparkCol[k * 3] = 0.78;
      sparkCol[k * 3 + 1] = 0.68;
      sparkCol[k * 3 + 2] = 0.52;
    }
    sparkGeo.attributes.color!.needsUpdate = true;
  }

  function slash(x: number, y: number, z: number, yaw: number, heavy: boolean) {
    const arc = slashes[slashCursor % slashes.length]!;
    slashCursor++;
    arc.visible = true;
    arc.userData.life = heavy ? 0.16 : 0.11;
    arc.position.set(x, y, z);
    arc.rotation.set(0.4, yaw, heavy ? -0.6 : 0.35);
    arc.scale.setScalar(heavy ? 1.35 : 0.95);
    const mat = arc.material as THREE.MeshBasicMaterial;
    mat.color.setHex(heavy ? 0xfff1d2 : 0xffd7ea);
    mat.opacity = 0.9;
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

  function noise(dur: number, gain: number) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(audioCtx.destination);
    src.start(t0);
  }

  function clang(heavy: boolean) {
    noise(heavy ? 0.09 : 0.05, heavy ? 0.2 : 0.12);
    tone(heavy ? 168 : 246, heavy ? 0.14 : 0.08, "square", heavy ? 0.07 : 0.05);
    tone(heavy ? 92 : 140, 0.16, "triangle", 0.05);
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
    invadeIn = 16;
    swingHits = new Set();
  }

  function breakPoise(f: Foe) {
    f.poise += 0;
    if (f.poise < f.poiseMax || f.state === "dead") return;
    f.poise = 0;
    f.state = "hurt";
    f.t = 0;
    f.stagger = 1.05;
    f.hp = Math.max(0, f.hp - 16);
    say("架勢崩了");
    hitstop = Math.max(hitstop, 0.16);
    shake = Math.max(shake, 0.55);
    hitFlash = 1;
    burst(f.x, 1.1, f.z, 1.8, 0, 0, "pink");
    slash(f.x, 1.05, f.z, f.yaw, true);
    clang(true);
    tone(70, 0.22, "sawtooth", 0.06);
  }

  function strikeCamera(from: Foe | undefined, amount: number, blocked = false) {
    const power = Math.min(1.4, amount / 28);
    const scale = blocked ? 0.4 : 1;
    camPush = Math.max(camPush, (0.9 + power * 0.75) * scale);
    fovKick = Math.max(fovKick, (blocked ? 1.1 : 2.4 + power * 1.6));
    shake = Math.max(shake, (blocked ? 0.24 : 0.46 + power * 0.22));
    hitstop = Math.max(hitstop, blocked ? 0.05 : 0.09 + power * 0.04);
    hurtDip = Math.max(hurtDip, blocked ? 0.08 : 0.24);
    if (from) {
      const side = Math.sin(Math.atan2(from.x - player.x, from.z - player.z) - camYaw);
      camRoll = (side >= 0 ? 1 : -1) * (blocked ? 0.028 : 0.07) * (0.7 + power);
      camYaw += side * (blocked ? 0.035 : 0.08);
    } else {
      camRoll = blocked ? 0.02 : 0.05;
    }
  }

  function hurtPlayer(amount: number, from?: Foe) {
    if (phase !== "play" || player.hp <= 0 || player.invuln > 0) return;
    if (player.act === "dodge" && player.actT > 0.04 && player.actT < 0.34) return;
    if (player.act === "block" && from) {
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      const dx = from.x - player.x;
      const dz = from.z - player.z;
      const nd = Math.hypot(dx, dz) || 0.0001;
      if ((fx * dx + fz * dz) / nd > 0.1 && player.sta >= 14) {
        player.sta = Math.max(0, player.sta - 16);
        player.staDelay = 0.4;
        player.hp = Math.max(0, player.hp - Math.max(1, Math.round(amount * 0.18)));
        from.poise += 22;
        breakPoise(from);
        strikeCamera(from, amount, true);
        guardV = 1;
        popNum(player.x, 1.45, player.z, "格", "guard");
        burst((player.x + from.x) * 0.5, 1.05, (player.z + from.z) * 0.5, 1.1, 0, 0, "steel");
        noise(0.04, 0.1);
        tone(210, 0.07, "square", 0.05);
        if (player.hp <= 0) die();
        else if (player.sta <= 0) {
          player.act = "hurt";
          player.actT = 0;
          say("架勢破了");
        }
        emit(true);
        return;
      }
    }
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.62;
    hurtV = 1;
    popNum(player.x, 1.5, player.z, String(amount), "hurt");
    strikeCamera(from, amount, false);
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
    burst(player.x, 0.7, player.z, 1.4, 0, 0, "ash");
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
    staFlash = 1;
    return true;
  }

  function livingFoe(f: Foe) {
    if (f.state === "dead" || f.hp <= 0) return false;
    if (f.kind === "demon" && !f.aggro) return false;
    if (f.kind === "duke" && !gateOpen) return false;
    return true;
  }

  function nearestFoe(maxDist: number) {
    let best: Foe | null = null;
    let bestD = maxDist;
    for (const f of foes) {
      if (!livingFoe(f)) continue;
      const d = Math.hypot(f.x - player.x, f.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  function faceTarget() {
    const target = lockFoe() ?? nearestFoe(3.6);
    if (target) player.yaw = Math.atan2(-(target.x - player.x), -(target.z - player.z));
    else player.yaw = camYaw;
  }

  function tryAttack(kind: "light" | "heavy" = "light") {
    if (phase !== "play") return;
    if (player.act !== "free" && player.act !== "block") return;
    const cost = kind === "heavy" ? MOVE.heavyCost : MOVE.lightCost;
    if (!spendSta(cost)) {
      say("氣力不夠");
      return;
    }
    faceTarget();
    camKick = Math.max(camKick, kind === "heavy" ? 0.32 : 0.16);
    player.act = "attack";
    player.actT = 0;
    player.hitDone = false;
    player.atk = kind;
    player.combo = 0;
    swingHits = new Set();
    tone(kind === "heavy" ? 120 : 196, 0.1, "sawtooth", 0.035);
    noise(0.04, kind === "heavy" ? 0.06 : 0.035);
  }

  function tryDodge() {
    if (phase !== "play" || (player.act !== "free" && player.act !== "block")) return;
    if (!spendSta(MOVE.dodgeCost)) return;
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
    burst(player.x, 0.2, player.z, 0.6, -player.dodgeX, -player.dodgeZ, "dust");
    const face = Math.atan2(-player.dodgeX, -player.dodgeZ);
    player.yaw = face;
    noise(0.06, 0.05);
    tone(180, 0.07, "sine", 0.03);
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
    f.span = dukeTell(move, p2);
  }

  function stepDuke(f: Foe, dt: number, dx: number, dz: number, dist: number) {
    const p2 = f.hp < f.hpMax * 0.5;
    if (p2 && !f.enraged) {
      f.enraged = true;
      banner = "第二階段";
      bannerT = 1.8;
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
          hurtPlayer(28, f);
        }
      } else if (f.move === "shock") {
        if (!f.swung && f.t > 0.4) {
          f.swung = true;
          shockDust(f.x, f.z);
          if (Math.hypot(player.x - f.x, player.z - f.z) < 2.9) {
            hurtPlayer(32, f);
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
          if (nd < reach && dot > (f.move === "overhead" ? 0.28 : 0.12)) hurtPlayer(f.move === "overhead" ? 40 : 24, f);
        }
      }
      if (f.t >= f.span) {
        f.state = "recover";
        f.t = 0;
        f.span =
          f.chain > 0 ? 0.2 : f.move === "overhead" ? 1.12 : f.move === "shock" ? 1.22 : f.move === "rush" ? (p2 ? 1.28 : 0.92) : 0.8;
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
          hurtPlayer(22, f);
        }
      } else if (!f.swung && f.t > 0.04) {
        f.swung = true;
        const fx = -Math.sin(f.yaw);
        const fz = -Math.cos(f.yaw);
        const px = player.x - f.x;
        const pz = player.z - f.z;
        const nd = Math.hypot(px, pz) || 0.0001;
        if (nd < 2.05 && (fx * px + fz * pz) / nd > 0.15) hurtPlayer(16, f);
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
    burst(demon.x, 1.2, demon.z, 1.7, 0, 0, "demon");
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
      if (f.kind === "duke") winArm = 1.6;
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
        if (f.id === 3) say("路中灰殼。輕擊，再滾");
        else if (!warnedHollow) {
          warnedHollow = true;
          say("側翼很重。按住格擋");
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
      if (!f.swung && f.t > 0.04) {
        f.swung = true;
        const fx = -Math.sin(f.yaw);
        const fz = -Math.cos(f.yaw);
        const dot = (fx * dx + fz * dz) / dist;
        if (dist < f.range + 0.2 && dot > 0.2) hurtPlayer(f.dmg, f);
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
      if (f.t > 0.55) {
        f.state = "chase";
        f.cd = 0.62;
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
    guardV = Math.max(0, guardV - dt * 2.4);
    staFlash = Math.max(0, staFlash - dt * 2.2);
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i]!.life -= dt;
      if (floaters[i]!.life <= 0) floaters.splice(i, 1);
    }
    if (toastT > 0) toastT -= dt;
    if (bannerT > 0) bannerT -= dt;
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

    if (player.act !== "free" && player.act !== "block") {
      player.actT += dt;
      if (player.act === "drink" && !player.healed && player.actT > 0.34) {
        player.hp = Math.min(player.hpMax, player.hp + 48);
        player.healed = true;
        burst(player.x, 0.8, player.z, 1.1, 0, 0, "pink");
      }
      if (player.act === "attack") {
        const heavy = player.atk === "heavy";
        const open = heavy ? MOVE.heavyOpen : MOVE.lightOpen;
        const shut = heavy ? MOVE.heavyShut : MOVE.lightShut;
        if (player.actT > open && player.actT < shut) {
          const fx = -Math.sin(player.yaw);
          const fz = -Math.cos(player.yaw);
          const dmg = heavy ? MOVE.heavyDmg : MOVE.lightDmg;
          let any = false;
          for (const f of foes) {
            if (!livingFoe(f) || swingHits.has(f.id)) continue;
            const dx = f.x - player.x;
            const dz = f.z - player.z;
            const dist = Math.hypot(dx, dz) || 0.0001;
            const reach = (heavy ? 2.15 : 1.8) + f.r * 0.45;
            const dot = (fx * dx + fz * dz) / dist;
            if (dist < reach && dot > (heavy ? 0.28 : 0.16)) {
              swingHits.add(f.id);
              const posture = heavy ? 34 : 12;
              f.poise += posture;
              const broken = f.poise >= f.poiseMax;
              f.hp = Math.max(0, f.hp - Math.round(dmg * (broken ? 1.5 : 1)));
              f.flash = 0.12;
              if (broken) {
                f.poise = 0;
                f.state = "hurt";
                f.t = 0;
                f.stagger = 1.05;
                say("架勢崩了");
              } else {
                const armored = f.state === "swing" || f.state === "roar" || (f.state === "telegraph" && !(heavy && f.kind !== "duke"));
                if (!armored) {
                  f.state = "hurt";
                  f.t = 0;
                }
              }
              burst(f.x, 1.05, f.z, heavy ? 1.6 : 1, fx, fz, heavy ? "pink" : "steel");
              slash(f.x, 1.05, f.z, player.yaw, heavy);
              any = true;
            }
          }
          if (any && !player.hitDone) {
            player.hitDone = true;
            if (muted && !heardSteel) {
              muted = false;
              say("刀聲開了");
            }
            heardSteel = true;
            shake = Math.max(shake, heavy ? 0.48 : 0.28);
            hitstop = Math.max(hitstop, heavy ? 0.12 : 0.07);
            hitFlash = heavy ? 0.85 : 0.45;
            camKick = Math.max(camKick, heavy ? 0.72 : 0.4);
            fovKick = Math.max(fovKick, heavy ? 3.4 : 1.7);
            camRoll = (heavy ? 0.04 : 0.022) * (Math.random() < 0.5 ? -1 : 1);
            clang(heavy);
            popNum(f.x, 1.6, f.z, String(heavy ? 46 : 20), heavy ? "heavy" : "light");
          }
        }
      }
      const end =
        player.act === "attack"
          ? player.atk === "heavy"
            ? MOVE.heavyEnd
            : MOVE.lightEnd
          : player.act === "dodge"
            ? 0.46
            : player.act === "drink"
              ? 0.82
              : player.act === "hurt"
                ? 0.34
                : 0.3;
      if (player.actT >= end) {
        player.act = "free";
        player.actT = 0;
      }
    } else if (player.act === "block") {
      player.sta = Math.max(0, player.sta - 12 * dt);
      player.staDelay = 0.2;
      if (player.sta <= 0) player.act = "free";
    } else if (player.staDelay > 0) {
      player.staDelay -= dt;
    } else {
      player.sta = Math.min(STA_MAX, player.sta + 36 * dt);
    }

    const locked = lockFoe();
    const { ix, iz, mag } = wishDir();
    if ((player.act === "free" || player.act === "block") && locked) {
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

    const wantBlock = held("KeyC") && player.sta > 6;
    if (player.act === "free" && wantBlock) player.act = "block";
    else if (player.act === "block" && !held("KeyC")) player.act = "free";

    const running =
      player.act === "free" &&
      (held("ShiftLeft") || held("ShiftRight")) &&
      mag > 0.18 &&
      player.sta > 8;
    if (player.act === "free") {
      const scale = mag > 1 ? 1 / mag : 1;
      const speed = running ? RUN : WALK;
      player.vx = ix * scale * speed;
      player.vz = iz * scale * speed;
      if (running) {
        player.sta = Math.max(0, player.sta - 20 * dt);
        player.staDelay = 0.28;
      }
    } else if (player.act === "block") {
      player.vx = ix * 0.35 * WALK;
      player.vz = iz * 0.35 * WALK;
    } else if (player.act === "dodge") {
      const u = player.actT / 0.4;
      const curve = u < 1 ? Math.sin(Math.min(1, u) * Math.PI) : 0;
      player.vx = player.dodgeX * 11 * curve;
      player.vz = player.dodgeZ * 11 * curve;
    } else if (player.act === "attack") {
      const heavy = player.atk === "heavy";
      const lung = heavy
        ? player.actT > 0.3 && player.actT < 0.48
          ? 5.4
          : 0
        : player.actT > 0.12 && player.actT < 0.28
          ? 3.4
          : 0;
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
    autoThink(dt);
    if (autoPanel) paintAuto();
    const roadClear = foes[2]!.state === "dead";
    const away = Math.hypot(player.x - FIRE.x, player.z - FIRE.z) > 6.5;
    const dukeBusy = foes[3]!.aggro && foes[3]!.state !== "dead";
    if (roadClear && away && !dukeBusy && player.hp > 0) {
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
      popNum(dropped.x, 0.8, dropped.z, `+${dropped.n}`, "ash");
      burst(dropped.x, 0.4, dropped.z, 1.2, 0, 0, "ash");
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
      camYaw = dampAngle(camYaw, face, 3.1, dt);
    }

    emitAcc += dt;
    if (emitAcc > 0.12) {
      emitAcc = 0;
      emit(false);
    }
  }

  function draw(time: number) {
    const dt = lastCamT === 0 ? 0.016 : Math.min(0.05, time - lastCamT);
    lastCamT = time;
    renderer.toneMappingExposure = 1.28 + hitFlash * 0.55;
    const look = lockFoe();
    const nextCam = stepCamera(
      { x: camX, y: camY, z: camZ, kick: camKick, push: camPush, roll: camRoll, fovKick, dip: hurtDip },
      {
        dt,
        time,
        phase,
        yaw: camYaw,
        dist: camDist,
        height: camHeight,
        shake,
        playerX: player.x,
        playerZ: player.z,
        act: player.act,
        actT: player.actT,
        heavy: player.atk === "heavy",
        lookX: look ? look.x : null,
        lookZ: look ? look.z : null,
      },
    );
    camX = nextCam.x;
    camY = nextCam.y;
    camZ = nextCam.z;
    camKick = nextCam.kick;
    camPush = nextCam.push;
    camRoll = nextCam.roll;
    fovKick = nextCam.fovKick;
    hurtDip = nextCam.dip;
    applyCamera(camera, nextCam);

    const speed = Math.hypot(player.vx, player.vz);
    const moving = player.act === "free" || player.act === "block" ? Math.min(1, speed / RUN) : 0;
    const blink = player.invuln > 0 && Math.sin(time * 28) > 0;
    playerRig.root.visible = !blink;
    playerRig.root.position.set(player.x, 0, player.z);
    playerRig.root.rotation.y = player.yaw + Math.PI;
    blockArc.visible = player.act === "block" && phase === "play";
    if (blockArc.visible) {
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      blockArc.position.set(player.x + fx * 0.55, 0.05, player.z + fz * 0.55);
      blockArc.rotation.z = -player.yaw;
      (blockArc.material as THREE.MeshBasicMaterial).opacity = player.sta < 20 ? 0.28 : 0.55;
    }
    playerRig.root.rotation.x = 0;
    const poseAct = player.act === "attack" && player.atk === "heavy" ? "heavy" : player.act;
    poseKnight(playerRig, time, moving, poseAct, player.actT);
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
      if (f.kind === "duke") rig.root.scale.set(1.55, f.enraged ? 1.86 : 1.78, 1.55);
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
        rig.armorMat.emissive.setRGB(0.55, 0.12, 0.05);
      }
      if (f.kind === "demon") {
        const pulse = 0.7 + Math.sin(time * 7) * 0.2;
        rig.armorMat.emissive.setRGB(pulse, 0.08, 0.1);
        rig.furMat.emissive.setRGB(0.28, 0.04, 0.05);
        rig.eyeMat.emissive.setHex(0xff2430);
        rig.eyeMat.emissiveIntensity = 1.35;
      }
      const punish = f.state === "recover" || f.state === "hurt";
      const showRing = f.state === "telegraph" || f.state === "swing" || punish || (f.kind === "demon" && f.aggro && !dead);
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
        mat.color.setHex(punish ? 0xf3efe7 : 0x9b2335);
        mat.opacity = punish ? 0.7 : 0.45;
        ring.scale.setScalar(punish ? 1.25 : f.state === "swing" ? 1.15 : 0.85 + u * 0.4);
      }
      if (punish && f.kind === "duke") {
        mat.color.setHex(0xf3efe7);
        mat.opacity = 0.75;
        ring.scale.setScalar(1.45);
      }
    });

    const locked = lockFoe();
    gem.visible = !!locked && phase === "play";
    if (locked) {
      const k = 1 - Math.exp(-dt * 10);
      gemX += (locked.x - gemX) * k;
      gemZ += (locked.z - gemZ) * k;
      const h = locked.kind === "duke" ? 3.05 : 2.15;
      gem.position.set(gemX, h + Math.sin(time * 3) * 0.06, gemZ);
      gem.rotation.y = time * 2.2;
      lockRing.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
    } else {
      gemX = player.x;
      gemZ = player.z;
    }

    stain.visible = !!dropped;
    if (dropped) {
      stain.position.set(dropped.x, 0.35 + Math.sin(time * 3) * 0.06, dropped.z);
      stain.rotation.y = time;
    }

    fogMat.opacity = gateOpen ? Math.max(0, fogMat.opacity - 0.02) : 0.38;
    fogWall.visible = fogMat.opacity > 0.02;
    if (gateOpen) clothDrop = Math.min(1, clothDrop + 0.012);
    cloth.position.y = 1.7 - clothDrop * 1.35;
    cloth.rotation.x = clothDrop * 1.15;
    cloth.rotation.z = clothDrop * 0.35;

    const flick = 0.85 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.05;
    flame.scale.set(1, flick, 1);
    core.scale.set(1, 0.85 + Math.sin(time * 11) * 0.1, 1);
    tongue.scale.set(1, 0.7 + Math.sin(time * 13) * 0.2, 1);
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

    for (let i = 0; i < MOTES; i++) {
      const drift = time * (0.12 + hash(i) * 0.08);
      motePos[i * 3] = -10 + ((hash(i) * 20 + Math.sin(drift + moteSeed[i]) * 0.8) % 20);
      motePos[i * 3 + 1] = 0.25 + ((hash(i + 3) * 3.4 + drift * 0.35) % 3.6);
      motePos[i * 3 + 2] = -16 + ((hash(i + 7) * 22 + Math.cos(drift * 0.7) * 0.6) % 22);
    }
    moteGeo.attributes.position!.needsUpdate = true;
    shafts.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.035 + Math.sin(time * 0.6 + i) * 0.02;
      mesh.rotation.y += Math.sin(time * 0.2 + i) * 0.0004;
    });

    for (const arc of slashes) {
      const life = Number(arc.userData.life ?? 0);
      if (life <= 0) {
        arc.visible = false;
        continue;
      }
      arc.userData.life = life - 0.016;
      arc.scale.multiplyScalar(1.04);
      (arc.material as THREE.MeshBasicMaterial).opacity = Math.max(0, life * 5);
    }
    if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - 0.05);

    if (dustT > 0) {
      dustT = Math.max(0, dustT - 0.016);
      const u = 1 - dustT / 0.48;
      dustRing.scale.setScalar(0.4 + u * 6.2);
      (dustRing.material as THREE.MeshBasicMaterial).opacity = 0.62 * (1 - u);
      dustRing.visible = dustT > 0;
    }
    for (let i = 0; i < SPARKS; i++) {
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
    sparkGeo.attributes.color!.needsUpdate = true;

    if (shake > 0) shake = Math.max(0, shake - 0.016);
    const tmp = new THREE.Vector3();
    floaterLayer.replaceChildren();
    for (const f of floaters) {
      tmp.set(f.x, f.y + (0.72 - f.life) * 0.8, f.z);
      tmp.project(camera);
      if (tmp.z > 1) continue;
      const el = document.createElement("p");
      const color = f.kind === "pink" ? "#ff7aa2" : f.kind === "heavy" ? "#fff1d2" : f.kind === "hurt" ? "#e23b3b" : f.kind === "guard" ? "#f3efe7" : "#f0d2a4";
      const size = f.kind === "heavy" || f.kind === "pink" ? 22 : 16;
      el.textContent = f.text;
      el.style.cssText = `position:absolute;left:${(tmp.x * 0.5 + 0.5) * 100}%;top:${(-tmp.y * 0.5 + 0.5) * 100}%;transform:translate(-50%,-50%);color:${color};font:700 ${size}px sans-serif;text-shadow:0 1px 2px #1b1714;opacity:${Math.max(0, f.life / 0.72)};`;
      floaterLayer.appendChild(el);
    }
    for (const f of foes) {
      const telling = f.state === "telegraph" || f.state === "swing";
      let bar = tellBars.get(f.id);
      if (!telling || f.state === "dead") {
        if (bar) bar.visible = false;
        continue;
      }
      if (!bar) {
        bar = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.06),
          new THREE.MeshBasicMaterial({ color: 0xf4d35e, transparent: true, opacity: 0.9, depthTest: false }),
        );
        scene.add(bar);
        tellBars.set(f.id, bar);
      }
      const u = f.span > 0 ? Math.max(0, Math.min(1, f.t / f.span)) : 0;
      const hue = f.move === "shock" ? 0xff4d2e : f.move === "overhead" ? 0xf4d35e : f.move === "rush" ? 0xf6efe4 : 0xe85d04;
      (bar.material as THREE.MeshBasicMaterial).color.setHex(f.state === "swing" ? 0x9b2335 : hue);
      bar.visible = true;
      bar.position.set(f.x, f.kind === "duke" ? 2.7 : 2.05, f.z);
      bar.scale.x = 0.15 + u * 0.85;
      bar.lookAt(camera.position);
    }
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
      if (e.pointerType === "touch" || e.button === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      if (e.button === 2) {
        e.preventDefault();
        tryAttack("heavy");
        return;
      }
      if (e.button === 0) tryAttack("light");
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
      if (e.code === "Escape") {
        e.preventDefault();
        if (!e.repeat && phase !== "title") {
          menuOpen = !menuOpen;
          emit(true);
        }
        return;
      }
      if (!e.repeat && e.key.length === 1) {
        codeBuf = (codeBuf + e.key.toLowerCase()).slice(-16);
        if (codeBuf.endsWith(DEBUG_CODE)) {
          codeBuf = "";
          toggleAutoFromGesture();
        }
      }
      if (e.repeat || phase !== "play" || autoOn) return;
      if (e.code === "Space") {
        noteGesture("R");
        tryDodge();
      }
      if (e.code === "KeyQ") noteGesture("L");
      if (e.code === "KeyJ") tryAttack("light");
      if (e.code === "KeyK") tryAttack("heavy");
      if (e.code === "KeyQ") tryLock();
      if (e.code === "KeyR") tryFlask();
      if (e.code === "KeyE") rest();
      if (e.code === "KeyF") temper();
    },
    { signal },
  );
  window.addEventListener("keyup", (e) => keys.delete(e.code), { signal });

  const DEBUG_CODE = "vowdebug";
  const TOUCH_CODE = "LLLLLLRLLL";
  let codeBuf = "";
  let gesture = "";
  let gestureAt = 0;
  let autoOn = false;
  let autoCd = 0;
  let autoPanel: HTMLDivElement | null = null;
  const autoStatus = document.createElement("p");

  function paintAuto() {
    if (!autoPanel) return;
    const foe = foes.find((f) => f.state !== "dead" && (f.kind !== "demon" || f.aggro));
    autoStatus.textContent = autoOn
      ? `自動中 · ${phase} · HP ${Math.round(player.hp)} · ${foe ? foe.name + " " + foe.state : "無目標"}`
      : "已解鎖。自動戰鬥還沒開。";
  }

  function unlockAuto() {
    if (autoPanel) return;
    const host = canvas.parentElement ?? document.body;
    const panel = document.createElement("div");
    panel.dataset.qa = "mallow-auto";
    panel.style.cssText = "position:absolute;left:8px;bottom:8px;z-index:60;max-width:220px;padding:8px;background:#1b1714ee;color:#f3efe7;border:1px solid #8a5a3a;font:12px/1.4 sans-serif;";
    const title = document.createElement("p");
    title.textContent = "QA · 騎士貓自動";
    title.style.margin = "0 0 6px";
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";
    const mk = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "min-height:32px;padding:0 8px;background:#e85d04;color:#1b1714;border:0;";
      b.addEventListener("click", fn);
      return b;
    };
    row.append(
      mk("自動", () => {
        autoOn = !autoOn;
        if (autoOn && phase === "title") begin();
        paintAuto();
      }),
      mk("再起", () => {
        if (phase === "dead" || phase === "win") rise();
        else if (phase === "title") begin();
      }),
      mk("關", () => {
        autoOn = false;
        panel.remove();
        autoPanel = null;
        sessionStorage.removeItem("mallow-qa");
      }),
    );
    autoStatus.style.margin = "6px 0 0";
    panel.append(title, row, autoStatus);
    host.appendChild(panel);
    autoPanel = panel;
    sessionStorage.setItem("mallow-qa", "1");
    paintAuto();
    say("測試通道開了");
  }

  function toggleAutoFromGesture() {
    if (!autoPanel) unlockAuto();
    autoOn = !autoOn;
    if (autoOn && phase === "title") begin();
    say(autoOn ? "自動測試開了" : "自動測試關了");
    paintAuto();
  }

  function noteGesture(kind: "L" | "R") {
    const now = performance.now();
    if (now - gestureAt > 4000) gesture = "";
    gestureAt = now;
    gesture = (gesture + kind).slice(-12);
    if (gesture.endsWith(TOUCH_CODE)) {
      gesture = "";
      toggleAutoFromGesture();
    }
  }

  function autoThink(dt: number) {
    if (!autoOn || menuOpen) return;
    autoCd = Math.max(0, autoCd - dt);
    if (phase === "title") {
      begin();
      return;
    }
    if (phase === "dead" || phase === "win") {
      if (autoCd <= 0) {
        if (phase === "dead") rise();
        else again();
        autoCd = 1.1;
      }
      return;
    }
    if (player.act === "hurt" || player.act === "drink" || player.act === "dodge") return;
    const foe = nearestFoe(18) ?? foes.find((f) => f.kind === "hollow" && f.state !== "dead") ?? null;
    if (!foe) return;
    if (lockId !== foe.id) lockId = foe.id;
    const dx = foe.x - player.x;
    const dz = foe.z - player.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    const forward = (dx * fx + dz * fz) / dist;
    const right = (dx * rx + dz * rz) / dist;
    keys.delete("KeyW");
    keys.delete("KeyA");
    keys.delete("KeyS");
    keys.delete("KeyD");
    keys.delete("ShiftLeft");
    const danger = foe.state === "telegraph" || foe.state === "swing";
    if (danger && dist < 3.4 && autoCd <= 0 && player.act === "free") {
      keys.add(right > 0 ? "KeyD" : "KeyA");
      tryDodge();
      autoCd = foe.move === "shock" ? 0.7 : 0.42;
      return;
    }
    if (player.hp < 42 && player.flasks > 0 && dist > 2.4 && player.act === "free" && autoCd <= 0) {
      tryFlask();
      autoCd = 0.9;
      return;
    }
    if ((foe.state === "recover" || foe.state === "hurt" || foe.stagger > 0) && dist < 2.35 && autoCd <= 0) {
      tryAttack(foe.state === "hurt" || foe.stagger > 0 ? "heavy" : "light");
      autoCd = 0.38;
      return;
    }
    if (dist > 1.65) {
      if (forward > 0.15) keys.add("KeyW");
      else if (forward < -0.15) keys.add("KeyS");
      if (right > 0.15) keys.add("KeyD");
      else if (right < -0.15) keys.add("KeyA");
      if (dist > 3.2) keys.add("ShiftLeft");
    }
  }

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
  if (sessionStorage.getItem("mallow-qa") === "1") unlockAuto();

  function begin() {
    if (phase === "play") return;
    phase = "play";
    menuOpen = false;
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
    autoPanel?.remove();
    floaterLayer.remove();
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
    attack: () => tryAttack("light"),
    heavy: () => tryAttack("heavy"),
    dodge: () => {
      noteGesture("R");
      tryDodge();
    },
    lock: () => {
      noteGesture("L");
      tryLock();
    },
    flask: tryFlask,
    toggleMute,
    closeMenu: () => {
      menuOpen = false;
      emit(true);
    },
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
    heavy: () => {},
    dodge: () => {},
    lock: () => {},
    flask: () => {},
    toggleMute: () => {},
    closeMenu: () => {},
    setStick: () => {},
    dispose: () => {},
  };
}

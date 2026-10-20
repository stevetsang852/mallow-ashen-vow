import * as THREE from "three";
import { makeKnight, poseKnight, type KnightRig } from "@/game/knightMesh";
import { makeHollow, makeDuke, makeDemon } from "@/game/enemyMesh";
import { loadEnemyRig } from "@/game/enemyRig";
import { flashMallow, loadMallowRig } from "@/game/mallowRig";
import { applyCamera, stepCamera } from "@/game/camera";
import { ITEMS_ENABLED } from "@/game/items";
import {
  chooseDemonIntent,
  chooseDukeMove,
  chooseHollowIntent,
  dukeRecoverSpan,
  dukeSwingSpan,
  shouldDukeCommit,
} from "@/game/ai";
import { actionEnd, DEFLECT, hitWindow, inIFrame, inRecover, inWindup, resolveGuardHit } from "@/game/player";
import { applyDeflectBounce } from "@/game/foes";
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
  SPAWN,
  STA_MAX,
  STEP,
  WALK,
  beginLightComboHit,
  breakLightCombo,
  canStartLightCombo,
  createLightComboState,
  dampAngle,
  dukeTell,
  finishLightComboHit,
  hash,
  lightComboDamage,
  template,
  tickLightCombo,
  type Act,
  type DukeMove,
  type Foe,
  type LightComboState,
} from "@/game/moves";
import { createCombatFeelBus } from "@/game/combatFeel";
import {
  createHarnessSession,
  decideAutoThink,
  harnessWanted,
  withLearnerView,
  type AutoThinkAction,
} from "@/game/autoHarness";
import { createPlayerLearner } from "@/game/playerLearner";
import { GAME_VERSION } from "@/game/version";
import { SAVE_SCHEMA, createSaveManager } from "@/game/saveManager";
import { createAudio } from "@/game/audio";
import { createParticles } from "@/game/particles";
import {
  connectSwingFeedback,
  resolveBreakPoise,
  resolveSwingHitOnFoe,
  strikeCameraImpulse,
} from "@/game/hitPath";
import {
  EXPLOSIVE_AOE_RADIUS,
  EXPLOSIVE_DAMAGE,
  HEAL_HERB_AMOUNT,
  ITEM_LABEL,
  TORCH_LIGHT_DISTANCE,
  applyExplosiveAoe,
  applyHealHerb,
  clampHotbarSelected,
  defaultWorldPickups,
  emptyInventory,
  findNearestPickup,
  hotbarFilledFlags,
  hotbarUseKind,
  resetItems,
  tryCollectNearest,
  tryConsumeExplosive,
  tryConsumeHealHerb,
  type InventoryFlags,
  type WorldPickup,
} from "@/game/items";

export type { GameApi, HudSnap, Phase };
export { INITIAL_HUD };

/** P1-H: shared bow-pink (#e8a0b8) — matches CSS --color-bow; do not use for ember primary. */
const COLOR_BOW = 0xe8a0b8;

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
      /** Combat feel recent buffer + counts (Plan A). */
      feelRecent?: () => import("@/game/combatFeel").CombatFeelEvent[];
      feelCounts?: () => import("@/game/combatFeel").CombatFeelCounts;
      /** AI-vs-AI harness session summary / toggle (+ learner ε／episodes, 0.8.31). */
      harness?: () => import("@/game/autoHarness").HarnessWithLearnerView;
      setHarness?: (on: boolean) => void;
      setAuto?: (on: boolean) => void;
      /** Learning player policy summary (harness). */
      learner?: () => import("@/game/playerLearner").LearnerSummary;
      resetLearner?: () => void;
      /** Export / import learner Q + ε schedule snapshot (0.8.10). */
      learnerSnapshot?: () => import("@/game/playerLearner").LearnerSnapshot;
      importLearnerSnapshot?: (raw: unknown) => void;
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
    hooks.onHud({ ...INITIAL_HUD, webgl: false, ready: true, loadPct: 100 });
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
  
  // Enhanced ambient light for better illumination
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  const rim = new THREE.DirectionalLight(0xffc9a0, 0.7);
  rim.position.set(-2, 6, -10);
  scene.add(rim);
  const keyLight = new THREE.PointLight(0xffe2c4, 10, 10, 2);
  scene.add(keyLight);

  // P2-K win-phase quiet lighting — cooler ambient ~7%; play baselines untouched.
  const coolRef = new THREE.Color(0x9eb0c8);
  const baseBg = new THREE.Color(0x2a221c);
  const baseFog = new THREE.Color(0x3a3128);
  const baseHemiSky = new THREE.Color(0xf0d7b8);
  const baseHemiGround = new THREE.Color(0x2c241e);
  const baseMoon = new THREE.Color(0xd5e0ee);
  const baseAmbient = new THREE.Color(0x404040);
  const baseRim = new THREE.Color(0xffc9a0);
  const quietBg = baseBg.clone().lerp(coolRef, 0.07);
  const quietFog = baseFog.clone().lerp(coolRef, 0.07);
  const quietHemiSky = baseHemiSky.clone().lerp(coolRef, 0.07);
  const quietHemiGround = baseHemiGround.clone().lerp(coolRef, 0.06);
  const quietMoon = baseMoon.clone().lerp(new THREE.Color(0xb8c8e8), 0.08);
  const quietAmbient = baseAmbient.clone().lerp(coolRef, 0.07);
  const quietRim = baseRim.clone().lerp(coolRef, 0.05);
  let quietBlend = 0;

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
  let clothVelocity = 0; // Physics simulation for cloth
  // Enhanced cracks with more detail
  const cracks: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    // Main crack
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.5, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 1, transparent: true, opacity: 0 }),
    );
    crack.position.set(sx * 2.15, 1.1, GATE_Z + 0.28);
    crack.rotation.z = sx * 0.18;
    scene.add(crack);
    cracks.push(crack);
    
    // Secondary crack branches
    for (let j = 0; j < 3; j++) {
      const branch = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.4 + hash(j + 10) * 0.3, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 1, transparent: true, opacity: 0 }),
      );
      branch.position.set(
        sx * 2.15 + (j % 2 === 0 ? 0.1 : -0.1) * (1 + j * 0.3),
        0.5 + j * 0.4,
        GATE_Z + 0.32
      );
      branch.rotation.z = sx * (0.18 + j * 0.15);
      scene.add(branch);
      cracks.push(branch);
    }
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
  // Enhanced flame with dynamic vertices for more natural movement
  const flameGeo = new THREE.ConeGeometry(0.16, 0.5, 7, 4);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xe85d04, side: THREE.DoubleSide });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(FIRE.x, 0.48, FIRE.z);
  
  const coreGeo = new THREE.ConeGeometry(0.07, 0.32, 6, 3);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xf6efe4, side: THREE.DoubleSide });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(FIRE.x, 0.42, FIRE.z);
  
  const tongueGeo = new THREE.ConeGeometry(0.08, 0.28, 5, 3);
  const tongueMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, side: THREE.DoubleSide });
  const tongue = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.position.set(FIRE.x + 0.05, 0.55, FIRE.z);
  scene.add(flame, core, tongue);

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
    mesh.visible = ITEMS_ENABLED;
    scene.add(mesh);
    return mesh;
  });

  const particles = createParticles();
  scene.add(particles.points, particles.embers, particles.motes);
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
  /** Research P2-J: outer softer shorter dust halo (mesh-only). */
  const dustRingSoft = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.88, 36),
    new THREE.MeshBasicMaterial({
      color: 0xcbb89a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  dustRingSoft.rotation.x = -Math.PI / 2;
  dustRingSoft.visible = false;
  scene.add(dustRingSoft);
  const pickupRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.32, 20),
    new THREE.MeshBasicMaterial({ color: 0xe85d04, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  pickupRing.rotation.x = -Math.PI / 2;
  pickupRing.visible = false;
  scene.add(pickupRing);
  let pickupT = 0;

  /** P1 world pickup stubs (ash-token / flask-shard / torch / explosive / healHerb). */
  const worldPickups: WorldPickup[] = defaultWorldPickups();
  const inventory: InventoryFlags = emptyInventory();
  /** P1 0.8.15 hotbar — selected slot 0..3 (Key1–4). */
  let hotbarSelected = 0;
  const itemMeshes: THREE.Mesh[] = worldPickups.map((p) => {
    const color =
      p.id === "ash-token"
        ? 0xe85d04
        : p.id === "flask-shard"
          ? 0x7ec8e3
          : p.id === "torch"
            ? 0xffb347
            : p.id === "healHerb"
              ? 0x4caf50
              : 0xc23b22;
    const mesh = new THREE.Mesh(
      p.id === "explosive"
        ? new THREE.BoxGeometry(0.28, 0.28, 0.28)
        : new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.45,
        roughness: 0.55,
        metalness: 0.15,
      }),
    );
    mesh.position.set(p.x, 0.42, p.z);
    mesh.userData.itemId = p.id;
    scene.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.04, p.z);
    ring.visible = ITEMS_ENABLED;
    scene.add(ring);
    mesh.userData.ring = ring;
    return mesh;
  });
  function syncItemMeshes() {
    for (let i = 0; i < itemMeshes.length; i++) {
      const mesh = itemMeshes[i]!;
      const p = worldPickups[i]!;
      const on = ITEMS_ENABLED && p.active && !inventory[p.id];
      mesh.visible = on;
      const ring = mesh.userData.ring as THREE.Mesh | undefined;
      if (ring) ring.visible = on;
    }
  }
  syncItemMeshes();

  /** P1 0.8.6 held torch — small PointLight on the player (performant). */
  const torchLight = new THREE.PointLight(0xff9a3c, 0, TORCH_LIGHT_DISTANCE, 2);
  torchLight.position.set(0, 1.35, 0);
  scene.add(torchLight);
  function syncTorchLight() {
    const on = ITEMS_ENABLED && !!inventory.torch && phase === "play";
    torchLight.intensity = on ? 7.5 : 0;
    if (on) {
      torchLight.position.set(player.x + 0.15, 1.35, player.z + 0.1);
    }
  }

  let dustT = 0;
  let dustSoftT = 0;

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
    fur: 0xe8a05a,
    armor: 0xb8c0c8,
    bow: false,
    helm: false,
    cape: true,
    eye: 0x241c18,
  });
  playerRig.root.rotation.order = "YXZ";
  scene.add(playerRig.root);
  let loaded = 0;
  let loadPct = 0;
  let assetsReady = false;
  let pendingBegin = false;
  const loadTotal = 6;
  function noteLoad() {
    loaded += 1;
    loadPct = Math.min(100, Math.round((loaded / loadTotal) * 100));
    if (loaded >= loadTotal) {
      assetsReady = true;
      loadPct = 100;
      if (pendingBegin) begin();
      else emit(true);
      return;
    }
    emit(true);
  }
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
    })
    .finally(noteLoad);

  const foeRigs: KnightRig[] = [];
  const foes = template();
  for (const f of foes) {
    const proc =
      f.kind === "hollow" ? makeHollow(f.id === 3 ? "road" : "side") :
      f.kind === "duke" ? makeDuke() :
      makeDemon();
    proc.root.rotation.order = "YXZ";
    proc.root.visible = f.kind !== "demon";
    scene.add(proc.root);
    foeRigs.push(proc);

    loadEnemyRig(f.kind as "hollow" | "duke" | "demon", f.id === 3 ? "road" : "side")
      .then((rig) => {
        const idx = foes.indexOf(f);
        const prev = foeRigs[idx];
        if (prev && prev !== rig) {
          scene.remove(prev.root);
          rig.root.rotation.order = "YXZ";
          rig.root.visible = f.kind !== "demon";
          scene.add(rig.root);
          foeRigs[idx] = rig;
        }
      })
      .catch(() => {})
      .finally(noteLoad);
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

  // P1-G: lock diamond = thin pink outline + center pink dot (visual only; no hit blocking)
  const gem = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 8),
    new THREE.MeshBasicMaterial({ color: COLOR_BOW, transparent: true, opacity: 0.95, depthTest: false }),
  );
  gem.raycast = () => {};
  const lockRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.52, 4),
    new THREE.MeshBasicMaterial({
      color: COLOR_BOW,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  lockRing.rotation.x = -Math.PI / 2;
  lockRing.rotation.z = Math.PI / 4;
  lockRing.raycast = () => {};
  // Outer cue ring: punish/recover window only (1.0→1.08 ping-pong)
  const lockPulse = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.6, 4),
    new THREE.MeshBasicMaterial({
      color: COLOR_BOW,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  lockPulse.rotation.x = -Math.PI / 2;
  lockPulse.rotation.z = Math.PI / 4;
  lockPulse.visible = false;
  lockPulse.raycast = () => {};
  gem.add(lockRing);
  gem.add(lockPulse);
  gem.visible = false;
  gem.renderOrder = 10;
  lockRing.renderOrder = 10;
  lockPulse.renderOrder = 10;
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
  const iframeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0xf6efe4, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  iframeRing.rotation.x = -Math.PI / 2;
  iframeRing.visible = false;
  scene.add(iframeRing);
  const recoverRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.58, 12),
    new THREE.MeshBasicMaterial({ color: COLOR_BOW, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  recoverRing.rotation.x = -Math.PI / 2;
  recoverRing.visible = false;
  scene.add(recoverRing);
  const windupRing = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.7, 14),
    new THREE.MeshBasicMaterial({ color: 0xe85d04, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  windupRing.rotation.x = -Math.PI / 2;
  windupRing.visible = false;
  scene.add(windupRing);

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

  let lightCombo: LightComboState = createLightComboState();
  /** Seconds since entering block; used for DEFLECT.window press timing. */
  let blockAge = 0;
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
  const feel = createCombatFeelBus();
  const harness = createHarnessSession();
  const learner = createPlayerLearner({ gameVersion: GAME_VERSION });
  feel.on((ev) => {
    harness.noteFeel(ev);
    if (harness.enabled) learner.noteFeel(ev);
  });
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
  let warnedHollow = false;
  let stickX = 0;
  let stickY = 0;
  let qa: Set<string> | null = null;
  let emitAcc = 0;
  let lastKey = "";
  let simError = "";
  let disposed = false;

  const saveMgr = createSaveManager();
  const audio = createAudio();
  {
    const s = saveMgr.load();
    deaths = s.deaths;
    clears = s.clears;
    bestMs = s.bestMs;
    player.hpMax = s.hpMax;
    player.hp = player.hpMax;
  }

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

  /** HUD light-combo count (1..3). 0 hides plate for normal play. */
  function lightComboHudCount(): number {
    if (phase !== "play") return 0;
    if (player.act === "attack" && player.atk === "light") return player.combo + 1;
    if (lightCombo.phase === "window" && lightCombo.completedHits > 0) return lightCombo.completedHits;
    return 0;
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
      muted: audio.isMuted(),
      gateOpen,
      menuOpen,
      ready: assetsReady,
      loadPct,
      demonShown: demon.aggro && demon.state !== "dead" && phase === "play",
      demonName: demon.name,
      demonHp: demon.hp,
      demonMax: demon.hpMax,
      hasAshToken: inventory["ash-token"],
      hasFlaskShard: inventory["flask-shard"],
      hasTorch: inventory.torch,
      hasExplosive: inventory.explosive,
      hasHealHerb: inventory.healHerb,
      nearItem:
        phase === "play"
          ? (() => {
              const n = findNearestPickup(player.x, player.z, worldPickups);
              return n ? ITEM_LABEL[n.id] : "";
            })()
          : "",
      lightCombo: lightComboHudCount(),
      hotbarSelected,
      hotbarFilled: hotbarFilledFlags(inventory),
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
      snap.ready ? 1 : 0,
      snap.loadPct,
      snap.demonShown ? Math.round(snap.demonHp ?? 0) : "-",
      snap.clears,
      snap.bestMs ?? "",
      snap.hasAshToken ? 1 : 0,
      snap.hasFlaskShard ? 1 : 0,
      snap.hasTorch ? 1 : 0,
      snap.hasExplosive ? 1 : 0,
      snap.hasHealHerb ? 1 : 0,
      snap.nearItem,
      snap.lightCombo,
      snap.hotbarSelected,
      snap.hotbarFilled.map((f) => (f ? 1 : 0)).join(""),
    ].join("|");
    if (!force && key === lastKey) return;
    lastKey = key;
    hooks.onHud(snap);
  }

  function save() {
    saveMgr.write({
      v: SAVE_SCHEMA,
      deaths,
      hpMax: player.hpMax,
      bestMs,
      clears,
    });
  }

  function popNum(_x: number, _y: number, _z: number, _text: string, _kind: string) {
    // Numbers stay off the normal player UI.
  }

  const burst = particles.burst;

  function shockDust(x: number, z: number) {
    dustT = 0.48;
    dustRing.visible = true;
    dustRing.position.set(x, 0.05, z);
    dustRing.scale.setScalar(0.4);
    (dustRing.material as THREE.MeshBasicMaterial).opacity = 0.62;
    dustSoftT = 0.3;
    dustRingSoft.visible = true;
    dustRingSoft.position.set(x, 0.05, z);
    dustRingSoft.scale.setScalar(0.55);
    (dustRingSoft.material as THREE.MeshBasicMaterial).opacity = 0.32;
    particles.ringDust(x, z);
  }

  function slash(x: number, y: number, z: number, yaw: number, heavy: boolean, finisher = false) {
    const arc = slashes[slashCursor % slashes.length]!;
    slashCursor++;
    arc.visible = true;
    arc.userData.life = finisher ? 0.2 : heavy ? 0.16 : 0.11;
    arc.position.set(x, y, z);
    arc.rotation.set(0.4, yaw, heavy ? -0.6 : 0.35);
    arc.scale.setScalar(finisher ? 1.55 : heavy ? 1.35 : 0.95);
    const mat = arc.material as THREE.MeshBasicMaterial;
    mat.color.setHex(finisher ? 0xffb3d0 : heavy ? 0xfff1d2 : 0xffd7ea);
    mat.opacity = 0.92;
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
    player.combo = 0;
    lightCombo = createLightComboState();
    blockAge = 0;
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

  /** amount on stance-break = poise damage that triggered the break (unified). */
  function breakPoise(f: Foe, poiseHit = 22) {
    f.poise += 0;
    const resolved = resolveBreakPoise(f, poiseHit);
    if (!resolved) return;
    f.poise = 0;
    f.state = resolved.nextState;
    f.t = 0;
    f.stagger = resolved.stagger;
    f.hp = resolved.nextHp;
    say("架勢崩了");
    hitstop = Math.max(hitstop, resolved.hitstop);
    shake = Math.max(shake, resolved.shake);
    hitFlash = 1;
    burst(f.x, 1.1, f.z, resolved.sparkMul, 0, 0, "pink", resolved.sparkMul);
    slash(f.x, 1.05, f.z, f.yaw, true);
    audio.clang(true);
    audio.tone(70, 0.22, "sawtooth", 0.06);
    feel.emit({ kind: "stance-break", foeId: f.id, foeKind: f.kind, amount: resolved.poiseHit });
  }

  function strikeCamera(from: Foe | undefined, amount: number, blocked = false) {
    const impulse = strikeCameraImpulse(amount, blocked);
    camPush = Math.max(camPush, impulse.camPush);
    fovKick = Math.max(fovKick, impulse.fovKick);
    shake = Math.max(shake, impulse.shake);
    hitstop = Math.max(hitstop, impulse.hitstop);
    hurtDip = Math.max(hurtDip, impulse.hurtDip);
    if (from) {
      const side = Math.sin(Math.atan2(from.x - player.x, from.z - player.z) - camYaw);
      camRoll = (side >= 0 ? 1 : -1) * impulse.camRollAbs;
      camYaw += side * impulse.camYawKick;
    } else {
      camRoll = impulse.camRollFallback;
    }
  }

  function hurtPlayer(amount: number, from?: Foe) {
    if (phase !== "play" || player.hp <= 0 || player.invuln > 0) return;
    if (inIFrame(player.act, player.actT)) return;
    if (player.act === "block" && from) {
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      const dx = from.x - player.x;
      const dz = from.z - player.z;
      const nd = Math.hypot(dx, dz) || 0.0001;
      const facingDot = (fx * dx + fz * dz) / nd;
      const guard = resolveGuardHit({
        blocking: true,
        blockAge,
        facingDot,
        stamina: player.sta,
      });
      if (guard === "deflect") {
        player.sta = Math.max(0, player.sta - DEFLECT.staCost);
        player.staDelay = 0.35;
        from.poise += DEFLECT.poise;
        applyDeflectBounce(from, player.x, player.z);
        {
          const side = from.kind === "demon" ? "north" : from.kind === "duke" ? "south" : "any";
          const c = clampWorld(from.x, from.z, from.r, side);
          from.x = c.x;
          from.z = c.z;
        }
        breakPoise(from, DEFLECT.poise);
        strikeCamera(from, amount, true);
        guardV = 1;
        hitFlash = Math.max(hitFlash, 0.9);
        hitstop = Math.max(hitstop, 0.14);
        shake = Math.max(shake, 0.42);
        feel.emit({ kind: "deflect", amount, foeId: from.id, foeKind: from.kind });
        burst((player.x + from.x) * 0.5, 1.1, (player.z + from.z) * 0.5, 1.6, 0, 0, "steel", 1.4);
        slash(from.x, 1.05, from.z, player.yaw, false);
        audio.clang(true);
        audio.tone(320, 0.09, "square", 0.07);
        say("招架！");
        if (from.hp <= 0) {
          from.state = "dead";
          from.t = 0;
        }
        emit(true);
        return;
      }
      if (guard === "block") {
        player.sta = Math.max(0, player.sta - 16);
        player.staDelay = 0.4;
        player.hp = Math.max(0, player.hp - Math.max(1, Math.round(amount * 0.18)));
        from.poise += 22;
        breakPoise(from);
        strikeCamera(from, amount, true);
        guardV = 1;
        feel.emit({ kind: "block", amount, foeId: from.id, foeKind: from.kind });
        burst((player.x + from.x) * 0.5, 1.05, (player.z + from.z) * 0.5, 1.1, 0, 0, "steel");
        audio.noise(0.04, 0.1);
        audio.tone(210, 0.07, "square", 0.05);
        if (player.hp <= 0) die();
        else if (player.sta <= 0) {
          lightCombo = breakLightCombo();
          player.combo = 0;
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
    feel.emit({
      kind: "hurt",
      amount,
      foeId: from?.id,
      foeKind: from?.kind,
    });
    strikeCamera(from, amount, false);
    audio.tone(90, 0.2, "sawtooth", 0.05);
    if (player.hp <= 0) {
      die();
      return;
    }
    lightCombo = breakLightCombo();
    player.combo = 0;
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
    harness.onPhase("dead");
    if (harness.enabled) learner.endEpisode("loss");
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
    feel.emit({ kind: "stamina", amount: cost });
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
    if (!canStartLightCombo(lightCombo)) return;
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
    if (kind === "light") {
      const started = beginLightComboHit(lightCombo);
      lightCombo = started.state;
      player.combo = started.hitIndex;
    } else {
      lightCombo = breakLightCombo();
      player.combo = 0;
    }
    swingHits = new Set();
    audio.swing(kind === "heavy");
  }

  function tryDodge() {
    if (phase !== "play" || (player.act !== "free" && player.act !== "block")) return;
    if (!spendSta(MOVE.dodgeCost)) return;
    lightCombo = breakLightCombo();
    player.combo = 0;
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
    audio.noise(0.06, 0.05);
    audio.tone(180, 0.07, "sine", 0.03);
  }

  function tryInteract() {
    if (phase !== "play") return false;
    const id = tryCollectNearest(player.x, player.z, worldPickups, inventory);
    if (!id) return false;
    syncItemMeshes();
    syncTorchLight();
    audio.tone(380, 0.1, "sine", 0.05);
    audio.tone(520, 0.16, "triangle", 0.04);
    say(`拾取 · ${ITEM_LABEL[id]}`);
    emit(true);
    return true;
  }

  /** P1 0.8.9 — detonate held explosive at player feet (AoE stub). */
  function tryDetonateExplosive() {
    if (phase !== "play") return false;
    if (!tryConsumeExplosive(inventory)) return false;
    const living = foes.filter((f) => livingFoe(f));
    const hit = applyExplosiveAoe(player.x, player.z, living, EXPLOSIVE_AOE_RADIUS, EXPLOSIVE_DAMAGE);
    for (const f of hit) {
      f.flash = 0.16;
    }
    shockDust(player.x, player.z);
    burst(player.x, 0.55, player.z, 1.6, 0, 0, "pink");
    shake = Math.max(shake, 0.28);
    audio.tone(90, 0.22, "square", 0.07);
    audio.noise(0.12, 0.08);
    say(hit.length ? `炸藥 · ${hit.length} 命中` : "炸藥 · 空爆");
    emit(true);
    return true;
  }

  /** P1 0.8.12 — use held heal herb for instant HP (one-shot; skip at full HP). */
  function tryUseHealHerb() {
    if (phase !== "play") return false;
    if (!inventory.healHerb) return false;
    if (player.hp >= player.hpMax) return false;
    if (!tryConsumeHealHerb(inventory)) return false;
    const before = player.hp;
    player.hp = applyHealHerb(player.hp, player.hpMax, HEAL_HERB_AMOUNT);
    const gained = Math.round(player.hp - before);
    audio.tone(360, 0.12, "sine", 0.045);
    audio.tone(480, 0.16, "triangle", 0.035);
    say(`恢復藥草 · +${gained}`);
    emit(true);
    return true;
  }

  /**
   * P1 0.8.15 — Key1–4: select slot, then attempt use if held.
   * torch → reaffirm equip · explosive → detonate · healHerb → heal · flask-shard → select only.
   */
  function tryHotbar(slot: number) {
    if (phase !== "play") return;
    hotbarSelected = clampHotbarSelected(slot);
    const kind = hotbarUseKind(inventory, hotbarSelected);
    if (kind === "torch") {
      syncTorchLight();
      say("火炬 · 已裝備");
      emit(true);
      return;
    }
    if (kind === "explosive") {
      if (tryDetonateExplosive()) return;
      emit(true);
      return;
    }
    if (kind === "healHerb") {
      if (tryUseHealHerb()) return;
      // empty use (full HP / already consumed race) — still select
      emit(true);
      return;
    }
    emit(true);
  }

  function tryFlask() {
    if (phase !== "play" || player.act !== "free") return;
    if (player.flasks <= 0 || player.hp >= player.hpMax) return;
    player.flasks -= 1;
    player.act = "drink";
    player.actT = 0;
    player.healed = false;
    audio.tone(320, 0.18, "sine", 0.04);
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
    audio.tone(180, 0.3, "sine", 0.05);
    say("火芯承認你了");
  }

  function temper() {
    if (phase !== "play" || !nearFire()) return;
    if (player.hpMax >= 180) {
      say("生命已經鍛滿");
      return;
    }
    if (ash < 200) {
      say("灰還不夠");
      return;
    }
    ash -= 200;
    player.hpMax += 12;
    player.hp = player.hpMax;
    save();
    audio.tone(240, 0.22, "triangle", 0.05);
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
    const picked = chooseDukeMove(dist, p2);
    const move = picked.move;
    f.move = move;
    f.chain = picked.chain;
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
      audio.tone(70, 0.4, "sawtooth", 0.06);
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
        f.span = dukeSwingSpan(f.move);
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
            audio.tone(52, 0.3, "square", 0.06);
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
        f.span = dukeRecoverSpan(f.move, p2, f.chain);
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

    if (shouldDukeCommit(dist, f.cd)) {
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
    const intent = chooseDemonIntent({
      dist,
      cd: f.cd,
      hp: f.hp,
      hpMax: f.hpMax,
      chain: f.chain,
      threatened,
      t: f.t,
    });
    if (intent.type === "dodge") {
      f.aimX = (-dz / dist) * intent.side;
      f.aimZ = (dx / dist) * intent.side;
      f.state = "dodge";
      f.t = 0;
      f.span = 0.28;
      return;
    }
    if (intent.type === "drink") {
      f.chain = 0;
      f.state = "drink";
      f.t = 0;
      f.swung = false;
      return;
    }
    if (intent.type === "telegraph") {
      f.move = intent.move;
      f.state = "telegraph";
      f.t = 0;
      f.span = intent.span;
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
    audio.tone(78, 0.4, "sawtooth", 0.06);
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
      audio.tone(70, 0.25, "square", 0.04);
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

    const hollowIntent = chooseHollowIntent(dist, f.range, f.cd);
    if (hollowIntent === "telegraph") {
      f.state = "telegraph";
      f.t = 0;
      f.span = f.windup;
      f.move = "cleave";
      return;
    }
    if (hollowIntent === "chase") {
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
        harness.onPhase("win");
        if (harness.enabled) learner.endEpisode("win");
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
        const { open, shut } = hitWindow(heavy);
        if (player.actT > open && player.actT < shut) {
          const fx = -Math.sin(player.yaw);
          const fz = -Math.cos(player.yaw);
          const dmg = heavy ? MOVE.heavyDmg : lightComboDamage(player.combo);
          let any = false;
          for (const f of foes) {
            if (!livingFoe(f) || swingHits.has(f.id)) continue;
            const dx = f.x - player.x;
            const dz = f.z - player.z;
            const dist = Math.hypot(dx, dz) || 0.0001;
            const dot = (fx * dx + fz * dz) / dist;
            const resolved = resolveSwingHitOnFoe({
              heavy,
              baseDmg: dmg,
              torchHeld: inventory.torch,
              foe: {
                id: f.id,
                kind: f.kind,
                state: f.state,
                poise: f.poise,
                poiseMax: f.poiseMax,
                hp: f.hp,
                r: f.r,
              },
              dist,
              dot,
            });
            if (resolved.hit) {
              swingHits.add(f.id);
              f.poise = resolved.nextPoise;
              f.hp = resolved.nextHp;
              f.flash = 0.12;
              if (resolved.nextState !== f.state || resolved.broken) {
                f.state = resolved.nextState as Foe["state"];
                if (resolved.broken || resolved.nextState === "hurt") f.t = 0;
              }
              if (resolved.broken) {
                f.stagger = resolved.nextStagger;
                say("架勢崩了");
              }
              burst(
                f.x,
                1.05,
                f.z,
                resolved.sparkMul,
                fx,
                fz,
                resolved.sparkKind,
                resolved.sparkMul,
              );
              const finisher = !heavy && player.combo === 2;
              slash(f.x, 1.05, f.z, player.yaw, heavy || finisher, finisher);
              feel.emit({
                kind: resolved.feelKind,
                amount: resolved.hitDmg,
                foeId: f.id,
                foeKind: f.kind,
                heavy,
              });
              if (resolved.broken) {
                feel.emit({
                  kind: "stance-break",
                  foeId: f.id,
                  foeKind: f.kind,
                  amount: resolved.posture,
                });
              }
              any = true;
            }
          }
          if (any && !player.hitDone) {
            player.hitDone = true;
            if (audio.isMuted() && !heardSteel) {
              audio.setMuted(false);
              say("刀聲開了");
            }
            heardSteel = true;
            {
              const fb = connectSwingFeedback(heavy);
              const finisher = !heavy && player.combo === 2;
              shake = Math.max(shake, fb.shake + (finisher ? 0.16 : 0));
              hitstop = Math.max(hitstop, fb.hitstop + (finisher ? 0.07 : 0));
              hitFlash = fb.hitFlash + (finisher ? 0.2 : 0);
              camKick = Math.max(camKick, fb.camKick + (finisher ? 0.28 : 0));
              fovKick = Math.max(fovKick, fb.fovKick + (finisher ? 1.1 : 0));
              camRoll = fb.camRoll * (Math.random() < 0.5 ? -1 : 1);
            }
            audio.clang(heavy);
          }
        }
      }
      const end = actionEnd(player.act, player.atk === "heavy");
      if (player.actT >= end) {
        if (player.act === "attack" && player.atk === "light") {
          lightCombo = finishLightComboHit(lightCombo);
        } else if (player.act === "attack") {
          lightCombo = breakLightCombo();
          player.combo = 0;
        }
        player.act = "free";
        player.actT = 0;
      }
    } else {
      if (lightCombo.phase === "window" || lightCombo.phase === "recover") {
        lightCombo = tickLightCombo(lightCombo, dt);
        if (lightCombo.phase === "idle") player.combo = 0;
      }
      if (player.act === "block") {
        player.sta = Math.max(0, player.sta - 12 * dt);
        player.staDelay = 0.2;
        if (player.sta <= 0) {
          player.act = "free";
          blockAge = 0;
          say("氣力空了");
          shake = Math.max(shake, 0.18);
          camPush = Math.max(camPush, 0.25);
        }
      } else if (player.staDelay > 0) {
        player.staDelay -= dt;
      } else {
        player.sta = Math.min(STA_MAX, player.sta + 36 * dt);
      }
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
    if (player.act === "free" && wantBlock) {
      player.act = "block";
      blockAge = 0;
    } else if (player.act === "block" && !held("KeyC")) {
      player.act = "free";
      blockAge = 0;
    } else if (player.act === "block") {
      blockAge += dt;
    }

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
      burst(dropped.x, 0.55, dropped.z, 1.8, 0, 0, "ash");
      burst(dropped.x, 0.2, dropped.z, 1.1, 0, 0, "pink");
      pickupRing.position.set(dropped.x, 0.06, dropped.z);
      pickupRing.visible = true;
      pickupRing.scale.setScalar(0.4);
      (pickupRing.material as THREE.MeshBasicMaterial).opacity = 0.8;
      pickupT = 0.45;
      audio.tone(420, 0.12, "sine", 0.05);
      audio.tone(640, 0.18, "triangle", 0.04);
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
    if (phase === "play") audio.footstep(moving, dt);
    const blink = player.invuln > 0 && Math.sin(time * 28) > 0;
    playerRig.root.visible = !blink;
    playerRig.root.position.set(player.x, 0, player.z);
    playerRig.root.rotation.y = player.yaw + Math.PI;
    const rolling = inIFrame(player.act, player.actT);
    iframeRing.visible = rolling && phase === "play";
    if (iframeRing.visible) {
      iframeRing.position.set(player.x, 0.04, player.z);
      iframeRing.scale.setScalar(1 + player.actT * 1.4);
    }
    const winding = inWindup(player.act, player.actT, player.atk === "heavy");
    windupRing.visible = winding && phase === "play";
    if (windupRing.visible) {
      const heavy = player.atk === "heavy";
      const open = heavy ? MOVE.heavyOpen : MOVE.lightOpen;
      const u = Math.max(0, Math.min(1, player.actT / open));
      windupRing.position.set(player.x, 0.05, player.z);
      windupRing.scale.setScalar((heavy ? 1.15 : 0.85) + u * (heavy ? 0.7 : 0.35));
      const mat = windupRing.material as THREE.MeshBasicMaterial;
      mat.color.setHex(heavy ? 0xff7a2f : 0xe85d04);
      mat.opacity = 0.35 + u * 0.55;
    }
    const recovering = inRecover(player.act, player.actT, player.atk === "heavy");
    recoverRing.visible = recovering && phase === "play";
    if (recoverRing.visible) recoverRing.position.set(player.x, 0.045, player.z);
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
      if (f.kind === "duke") rig.root.scale.set(1.62, f.enraged ? 2.05 : 1.96, 1.62);
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
        const late = f.state === "telegraph" && u > 0.7;
        mat.opacity = f.state === "swing" ? 0.75 : late ? 0.85 : 0.45;
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
      if (punish) {
        const left = f.span > 0 ? Math.max(0.25, 1 - f.t / f.span) : 1;
        mat.color.setHex(0xf3efe7);
        mat.opacity = 0.75;
        ring.scale.setScalar((f.kind === "duke" ? 1.45 : 1.25) * left);
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
      gem.rotation.y = time * 1.6;
      // Steady thin diamond; pulse only during punish/recover (收招窗)
      lockRing.scale.setScalar(1);
      const punishCue = locked.state === "recover" || locked.state === "hurt";
      lockPulse.visible = punishCue;
      if (punishCue) {
        // ping-pong 1.0 → 1.08
        const pulse = 1 + 0.11 * (1 + Math.sin(time * 7));
        lockPulse.scale.setScalar(pulse);
        (lockPulse.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(time * 7));
      } else {
        lockPulse.scale.setScalar(1);
      }
    } else {
      gemX = player.x;
      gemZ = player.z;
      lockPulse.visible = false;
    }

    if (pickupT > 0) {
      pickupT = Math.max(0, pickupT - 0.016);
      pickupRing.scale.setScalar(0.4 + (0.45 - pickupT) * 4.2);
      (pickupRing.material as THREE.MeshBasicMaterial).opacity = pickupT * 1.6;
      pickupRing.visible = pickupT > 0;
    }
    for (const mesh of itemMeshes) {
      if (!mesh.visible) continue;
      mesh.rotation.y += 0.02;
      mesh.position.y = 0.42 + Math.sin(time * 2.4 + mesh.position.x) * 0.06;
    }
    stain.visible = !!dropped;
    if (dropped) {
      stain.position.set(dropped.x, 0.35 + Math.sin(time * 3) * 0.06, dropped.z);
      stain.rotation.y = time;
    }

    fogMat.opacity = gateOpen ? Math.max(0, fogMat.opacity - 0.02) : 0.38;
    fogWall.visible = fogMat.opacity > 0.02;
    if (gateOpen) {
      // Enhanced physics simulation for cloth
      clothVelocity += 0.002; // Gravity
      clothVelocity *= 0.95; // Damping
      clothDrop = Math.min(1, clothDrop + clothVelocity);
      
      // Non-linear drop with easing
      const dropFactor = clothDrop * clothDrop * (3 - 2 * clothDrop); // Smoothstep
      cloth.position.y = 1.7 - dropFactor * 1.35;
      
      // Dynamic rotation based on velocity
      cloth.rotation.x = dropFactor * 1.15 + Math.sin(time * 3) * clothVelocity * 0.2;
      cloth.rotation.z = dropFactor * 0.35 + Math.cos(time * 2.5) * clothVelocity * 0.1;
      
      // Expand cloth as it drops
      cloth.scale.set(1 + dropFactor * 0.3, 1, 1 + dropFactor * 0.2);
    }
    
    // Dynamic crack expansion
    cracks.forEach((crack, i) => {
      if (gateOpen) {
        const expand = Math.sin(time * 2 + i) * 0.02 + 0.02;
        crack.scale.x = 1 + expand * clothDrop;
        (crack.material as THREE.MeshStandardMaterial).opacity = Math.min(1, clothDrop * 1.5);
      }
    });

    const flick = 0.85 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.05;
    flame.scale.set(1, flick, 1);
    core.scale.set(1, 0.85 + Math.sin(time * 11) * 0.1, 1);
    tongue.scale.set(1, 0.7 + Math.sin(time * 13) * 0.2, 1);
    
    // P2-K: win-phase quiet lighting linear lerp (~0.8s); restore baselines when not win.
    const quietTarget = phase === "win" ? 1 : 0;
    if (quietBlend < quietTarget) quietBlend = Math.min(quietTarget, quietBlend + dt / 0.8);
    else if (quietBlend > quietTarget) quietBlend = Math.max(quietTarget, quietBlend - dt / 0.8);
    (scene.background as THREE.Color).copy(baseBg).lerp(quietBg, quietBlend);
    (scene.fog as THREE.FogExp2).color.copy(baseFog).lerp(quietFog, quietBlend);
    hemi.color.copy(baseHemiSky).lerp(quietHemiSky, quietBlend);
    hemi.groundColor.copy(baseHemiGround).lerp(quietHemiGround, quietBlend);
    moon.color.copy(baseMoon).lerp(quietMoon, quietBlend);
    ambientLight.color.copy(baseAmbient).lerp(quietAmbient, quietBlend);
    rim.color.copy(baseRim).lerp(quietRim, quietBlend);

    // Enhanced dynamic lighting
    const lightFlicker = 18 + Math.sin(time * 9) * 4 + Math.sin(time * 23) * 2;
    // Optional quieter bonfire on win (~12% down); warm hue retained.
    bonfireLight.intensity = lightFlicker * (1 - quietBlend * 0.12);
    bonfireLight.color.setHSL(0.07, 0.9, 0.5 + Math.sin(time * 5) * 0.05);
    keyLight.position.set(player.x + 1.1, 2.3, player.z + 1.4);
    syncTorchLight();
    if (inventory.torch && phase === "play") {
      const flick = 7.2 + Math.sin(time * 11) * 0.9 + Math.sin(time * 29) * 0.4;
      torchLight.intensity = flick;
    }

    // P1-H breath + P2-K quietScale (~0.6 at full win); spark update() untouched
    const quietScale = 1 - quietBlend * 0.4; // 1 → 0.6
    particles.updateAmbient(
      time,
      phase === "title" || menuOpen ? 0.12 : 0,
      quietScale,
    );
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
    if (dustSoftT > 0) {
      dustSoftT = Math.max(0, dustSoftT - 0.016);
      const uSoft = 1 - dustSoftT / 0.3;
      dustRingSoft.scale.setScalar(0.55 + uSoft * 7.5);
      (dustRingSoft.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - uSoft);
      dustRingSoft.visible = dustSoftT > 0;
    }
    particles.update();

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
      if (e.code === "KeyE") {
        if (!ITEMS_ENABLED || (!tryInteract() && !tryDetonateExplosive() && !tryUseHealHerb())) tryFlask();
      }
      if (ITEMS_ENABLED) {
        if (e.code === "Digit1" || e.code === "Numpad1") tryHotbar(0);
        if (e.code === "Digit2" || e.code === "Numpad2") tryHotbar(1);
        if (e.code === "Digit3" || e.code === "Numpad3") tryHotbar(2);
        if (e.code === "Digit4" || e.code === "Numpad4") tryHotbar(3);
      }
      if (e.code === "KeyG") rest();
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
    const h = harness.summary();
    const base = autoOn
      ? `自動中 · ${phase} · HP ${Math.round(player.hp)} · ${foe ? foe.name + " " + foe.state : "無目標"}`
      : "已解鎖。自動戰鬥還沒開。";
    const L = learner.summary();
    const loop = h.enabled
      ? ` · 循環 ${h.wins}W/${h.losses}L · 學 ${L.wins}W/${L.losses}L ε${L.epsilon} · feel h${h.feelTotals.hit}/H${h.feelTotals.heavy}/b${h.feelTotals.block}/u${h.feelTotals.hurt}`
      : "";
    autoStatus.textContent = base + loop;
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
    const setHarnessOn = (on: boolean) => {
      harness.setEnabled(on);
      if (on) {
        autoOn = true;
        if (phase === "title") begin();
        else if (phase === "play") harness.onPhase("play");
      }
      paintAuto();
    };
    row.append(
      mk("自動", () => {
        autoOn = !autoOn;
        if (autoOn && phase === "title") begin();
        paintAuto();
      }),
      mk("循環", () => {
        setHarnessOn(!harness.enabled);
        say(harness.enabled ? "AI 循環開了" : "AI 循環關了");
      }),
      mk("再起", () => {
        if (phase === "dead" || phase === "win") rise();
        else if (phase === "title") begin();
      }),
      mk("關", () => {
        autoOn = false;
        harness.setEnabled(false);
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

  function applyAutoAction(action: AutoThinkAction) {
    autoCd = action.autoCd;
    if (action.type === "noop") return;
    if (action.type === "begin") {
      begin();
      return;
    }
    if (action.type === "rise") {
      rise();
      return;
    }
    if (action.type === "again") {
      again();
      return;
    }
    if ("lockId" in action) lockId = action.lockId;
    if (action.type === "dodge") {
      keys.delete("KeyW");
      keys.delete("KeyA");
      keys.delete("KeyS");
      keys.delete("KeyD");
      keys.delete("ShiftLeft");
      keys.add(action.side === "right" ? "KeyD" : "KeyA");
      tryDodge();
      return;
    }
    if (action.type === "flask") {
      tryFlask();
      return;
    }
    if (action.type === "attack") {
      tryAttack(action.heavy ? "heavy" : "light");
      return;
    }
    if (action.type === "move") {
      keys.delete("KeyW");
      keys.delete("KeyA");
      keys.delete("KeyS");
      keys.delete("KeyD");
      keys.delete("ShiftLeft");
      for (const code of action.keys) keys.add(code);
    }
  }

  function autoThink(dt: number) {
    if (!autoOn || menuOpen) return;
    const ctx = {
      phase,
      menuOpen,
      autoCd,
      camYaw,
      lockId,
      gateOpen,
      player: {
        x: player.x,
        z: player.z,
        hp: player.hp,
        flasks: player.flasks,
        act: player.act,
      },
      foes: foes.map((f) => ({
        id: f.id,
        x: f.x,
        z: f.z,
        kind: f.kind,
        state: f.state,
        move: f.move,
        aggro: f.aggro,
        stagger: f.stagger,
        phase2: f.enraged,
      })),
    };
    const action = harness.enabled ? learner.decide(ctx, dt) : decideAutoThink(ctx, dt);
    applyAutoAction(action);
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
    feelRecent: () => feel.recent(),
    feelCounts: () => feel.counts(),
    harness: () =>
      withLearnerView(harness.summary(), {
        epsilon: learner.epsilon,
        episodes: learner.summary().episodes,
      }),
    setHarness: (on: boolean) => {
      unlockAuto();
      harness.setEnabled(on);
      if (on) {
        autoOn = true;
        if (phase === "title") begin();
        else if (phase === "play") harness.onPhase("play");
      }
      paintAuto();
    },
    setAuto: (on: boolean) => {
      unlockAuto();
      autoOn = on;
      if (on && phase === "title") begin();
      paintAuto();
    },
    learner: () => learner.summary(),
    resetLearner: () => {
      learner.reset();
      paintAuto();
    },
    learnerSnapshot: () => learner.exportSnapshot({ gameVersion: GAME_VERSION }),
    importLearnerSnapshot: (raw: unknown) => {
      learner.importSnapshot(raw);
      paintAuto();
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
  if (harnessWanted()) {
    unlockAuto();
    harness.setEnabled(true);
    autoOn = true;
    paintAuto();
  }

  function begin() {
    if (phase === "play") return;
    if (!assetsReady) {
      pendingBegin = true;
      emit(true);
      return;
    }
    pendingBegin = false;
    phase = "play";
    harness.onPhase("play");
    menuOpen = false;
    camYaw = 0;
    player.yaw = 0;
    player.x = SPAWN.x;
    player.z = SPAWN.z;
    player.vx = 0;
    player.vz = 0;
    player.act = "free";
    resetItems(worldPickups, inventory);
    hotbarSelected = 0;
    syncItemMeshes();
    syncTorchLight();
    runStart = performance.now();
    audio.startAmbient();
    say("往拱門走。翻滾有短暫無敵。");
    emit(true);
  }

  function rise() {
    resetFoes();
    placeAtBonfire();
    phase = "play";
    harness.onPhase("play");
    runStart = performance.now();
    audio.startAmbient();
    say("火芯把你拉回來了");
    emit(true);
  }

  function again() {
    resetFoes();
    ash = 0;
    dropped = null;
    resetItems(worldPickups, inventory);
    hotbarSelected = 0;
    syncItemMeshes();
    syncTorchLight();
    placeAtBonfire();
    phase = "play";
    harness.onPhase("play");
    runStart = performance.now();
    audio.startAmbient();
    emit(true);
  }

  function toggleMute() {
    audio.toggleMute();
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
    interact: () => {
      if (!tryInteract() && !tryDetonateExplosive()) tryUseHealHerb();
    },
    hotbar: tryHotbar,
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
    interact: () => {},
    hotbar: () => {},
    toggleMute: () => {},
    closeMenu: () => {},
    setStick: () => {},
    dispose: () => {},
  };
}

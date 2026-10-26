import * as THREE from "three";
import { makeKnight, type KnightRig } from "@/game/knightMesh";
import { createClipMixer, type ClipMixer } from "@/previs/clips";
import { beatAt, sampleFrame, SET, SHOT, type CueSample } from "@/previs/shot";
import { markVfxHook } from "@/previs/vfxHooks";

export type PrevisFrame = {
  /** 0..1 position in the A–G loop. */
  u: number;
  seconds: number;
  label: string;
};

export type PrevisHandle = {
  setPaused: (paused: boolean) => void;
  dispose: () => void;
};

export type PrevisOptions = {
  onFrame?: (frame: PrevisFrame) => void;
};

const WARM = new THREE.Color(0xd9c3ae);
const NEUTRAL = new THREE.Color(0xc8c3bb);
const COOL = new THREE.Color(0x8ea4b8);

/**
 * Greybox player for storyboard shots A–G.
 * Procedural poses come from the AnimationMixer in `clips.ts`.
 * Ring meshes carry orange telegraph / pink recover / white i-frame.
 * VFX particles stay stubs — see `vfxHooks.ts`.
 */
export function createPrevis(canvas: HTMLCanvasElement, options: PrevisOptions = {}): PrevisHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch {
    return null;
  }
  if (!renderer.getContext()) {
    renderer.dispose();
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xc8c3bb, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = NEUTRAL.clone();
  scene.fog = new THREE.Fog(0xc8c3bb, 16, 36);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 80);

  const hemi = new THREE.HemisphereLight(0xf7f4ef, 0x9a948c, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6ee, 2.6);
  sun.position.set(-7, 11, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 32;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  scene.add(sun);

  buildCourtyard(scene);
  const fire = buildFire();
  fire.group.position.set(SET.fire.x, SET.fire.y, SET.fire.z);
  scene.add(fire.group);

  const cloth = buildCloth();
  scene.add(cloth);

  const duke = buildDukeBlock();
  duke.group.position.set(SET.duke.x, SET.duke.y, SET.duke.z);
  duke.group.rotation.y = SET.duke.yaw;
  scene.add(duke.group);

  const shells = {
    lean: buildShell("lean"),
    shield: buildShell("shield"),
    hood: buildShell("hood"),
  };
  scene.add(shells.lean, shells.shield, shells.hood);

  const ash = buildAsh();
  scene.add(ash.group);

  const rig = makeKnight({
    fur: 0xc4a574,
    armor: 0xc5ced8,
    bow: true,
    helm: false,
    cape: true,
    eye: 0x241c18,
  });
  rig.root.name = "mallow-previs";
  scene.add(rig.root);

  const clips = createClipMixer();
  scene.add(clips.proxies.root);

  const rings = {
    orange: cueMarker(0xff5a00),
    pink: cueMarker(0xff4fa3),
    white: cueMarker(0xffffff),
  };
  rings.orange.name = "orange-telegraph";
  rings.pink.name = "pink-recover";
  rings.white.name = "white-iframe";
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({ color: 0xff4f93, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  diamond.name = "pink-diamond";
  scene.add(rings.orange, rings.pink, rings.white, diamond);

  let paused = false;
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let disposed = false;
  let lastCue: CueSample["kind"] = "none";
  let ashMarked = false;

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) elapsed += dt;
    const loop = ((elapsed % SHOT.seconds) + SHOT.seconds) % SHOT.seconds;
    const u = loop / SHOT.seconds;
    const frame = sampleFrame(u);

    clips.apply(frame.clips);
    applyMallow(rig, frame.pose, clips, elapsed);
    applyDuke(duke, frame.stage.dukeWake, clips);
    applyShells(shells, frame.stage, clips, elapsed);
    applyCloth(cloth, frame.stage.cloth);
    applyAsh(ash, frame.stage, elapsed);
    applyCue(rings, diamond, frame.cue, rig.root, shells.lean, duke.group, elapsed);
    applyGrade(scene, renderer, hemi, sun, frame.grade);

    camera.fov = frame.camera.fov;
    camera.updateProjectionMatrix();
    camera.position.set(frame.camera.pos.x, frame.camera.pos.y, frame.camera.pos.z);
    camera.lookAt(frame.camera.look.x, frame.camera.look.y, frame.camera.look.z);

    const flick = 0.86 + Math.sin(elapsed * 11.5) * 0.08 + Math.sin(elapsed * 17.2) * 0.05;
    fire.flames.forEach((flame, i) => {
      flame.scale.y = flick * (1 + i * 0.05) * (0.75 + frame.grade.fire * 0.25);
    });
    fire.light.intensity = (16 + Math.sin(elapsed * 9) * 3) * frame.grade.fire;

    noteHooks(frame.cue.kind, frame.shot, frame.stage.shellAlive);
    renderer.render(scene, camera);
    options.onFrame?.({ u, seconds: u * SHOT.seconds, label: beatAt(u) });
  };

  function noteHooks(kind: CueSample["kind"], shot: string, shellAlive: number) {
    if (kind !== lastCue) {
      if (lastCue === "orange" && kind === "pink") markVfxHook("steel_points_on_hit");
      if (kind === "pink" && shot === "C") markVfxHook("pink_burst_on_heavy");
      if (kind === "white") markVfxHook("dust_on_roll");
      // `red_intrude` stays on the mixer for Act III. Graphics later:
      // markVfxHook("red_flame_on_intrude") when that beat is staged.
      lastCue = kind;
    }
    if (shot === "A") ashMarked = false;
    if (!ashMarked && shellAlive < 0.45) {
      ashMarked = true;
      markVfxHook("ash_on_death");
    }
  }

  raf = requestAnimationFrame(tick);

  return {
    setPaused(next: boolean) {
      paused = next;
      last = performance.now();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      clips.dispose();
      disposeScene(scene);
      renderer.dispose();
    },
  };
}

function applyMallow(
  rig: KnightRig,
  pose: ReturnType<typeof sampleFrame>["pose"],
  clips: ClipMixer,
  elapsed: number,
) {
  const channel = clips.proxies.mallow;
  const sheath = pose.sheath;
  let swordX = channel.position.x;
  let swordZ = channel.position.y;
  let bow = channel.rotation.z;
  if (sheath > 0) {
    swordX = swordX + (0.55 - swordX) * sheath;
    swordZ = swordZ + (0.95 - swordZ) * sheath;
    bow *= 1 - sheath;
  }
  const settle = 1.45 - 0.6 * pose.settle;
  const breath = Math.sin(elapsed * 1.7) * 0.012 * (1 - sheath);
  const bodyDrop = channel.scale.y || 1;

  rig.root.position.set(pose.x, 0, pose.z);
  rig.root.rotation.set(0, pose.yaw, 0);
  rig.bob.position.y = breath - pose.crouch * 0.16 - (1 - bodyDrop) * 0.14;
  rig.bob.rotation.z = channel.scale.z * 0.85;
  rig.legL.rotation.x = channel.scale.x;
  rig.legR.rotation.x = -channel.scale.x * 0.65;
  rig.weapon.rotation.set(swordX, 0, swordZ);
  rig.head.rotation.set(channel.rotation.x, channel.rotation.y + pose.earFlick, 0);
  if (typeof rig.head.userData.baseY !== "number") rig.head.userData.baseY = rig.head.position.y;
  rig.head.position.y = (rig.head.userData.baseY as number) + bow;
  rig.cape.rotation.x = channel.position.z * settle;
  rig.cape.rotation.z = Math.sin(elapsed * 1.1) * 0.03 * (1 - sheath);
  rig.tail.rotation.set(0.1, Math.sin(elapsed * 2.3) * 0.28 * (1 - sheath * 0.7), 0);
}

function applyDuke(
  duke: ReturnType<typeof buildDukeBlock>,
  wake: number,
  clips: ClipMixer,
) {
  const channel = clips.proxies.duke;
  const sunk = (1 - wake) * -2.35;
  duke.group.position.set(
    SET.duke.x + channel.position.y,
    SET.duke.y + sunk,
    SET.duke.z + channel.position.z,
  );
  duke.group.rotation.set(channel.position.x * 0.65, SET.duke.yaw + channel.rotation.y, 0);
  duke.horn.emissiveIntensity = 0.15 + wake * 0.85;
}

function applyShells(
  shells: { lean: THREE.Group; shield: THREE.Group; hood: THREE.Group },
  stage: ReturnType<typeof sampleFrame>["stage"],
  clips: ClipMixer,
  elapsed: number,
) {
  const sway = Math.sin(elapsed * 1.4) * 0.04;
  placeShell(shells.shield, stage.shellShield, sway);
  placeShell(shells.hood, stage.shellHood, -sway);
  placeShell(shells.lean, stage.shellLean, sway * 0.5);
  const alive = stage.shellAlive;
  shells.lean.scale.y = 0.18 + 0.82 * alive;
  shells.lean.rotation.x = (1 - alive) * 1.2 + clips.proxies.shell.position.x * 0.15;
  shells.lean.position.y = (1 - alive) * 0.02;
}

function placeShell(group: THREE.Group, at: { x: number; z: number }, sway: number) {
  group.position.x = at.x;
  group.position.z = at.z;
  group.rotation.y = Math.PI + sway;
}

function applyCloth(cloth: THREE.Mesh, drop: number) {
  cloth.position.y = 2.65 + (0.12 - 2.65) * drop;
  cloth.rotation.x = -1.25 * drop;
  cloth.position.z = SET.arch.z - 0.42 - drop * 0.35;
}

function applyAsh(
  ash: ReturnType<typeof buildAsh>,
  stage: ReturnType<typeof sampleFrame>["stage"],
  elapsed: number,
) {
  const show = stage.ash > 0.02;
  ash.group.visible = show;
  if (!show) return;
  ash.group.position.set(stage.shellLean.x, 0, stage.shellLean.z);
  const ring = 0.25 + stage.ashRing * 2.6;
  ash.ring.scale.setScalar(ring);
  ash.ring.material.opacity = 0.15 + (1 - Math.min(1, stage.ashRing)) * 0.75;
  const flick = 0.7 + Math.sin(elapsed * 9) * 0.2;
  ash.flames.forEach((flame, i) => {
    flame.visible = stage.shellAlive < 0.85;
    flame.scale.y = flick * (1 - stage.ash * 0.45) * (1 + i * 0.08);
  });
}

function applyCue(
  rings: { orange: THREE.Group; pink: THREE.Group; white: THREE.Group },
  diamond: THREE.Mesh,
  cue: CueSample,
  mallow: THREE.Object3D,
  shell: THREE.Object3D,
  duke: THREE.Object3D,
  elapsed: number,
) {
  rings.orange.visible = cue.kind === "orange";
  rings.pink.visible = cue.kind === "pink";
  rings.white.visible = cue.kind === "white";
  diamond.visible = cue.kind === "diamond";
  const anchor = cue.anchor === "duke" ? duke : cue.anchor === "shell" ? shell : mallow;
  const ring = cue.kind === "orange" ? rings.orange : cue.kind === "pink" ? rings.pink : rings.white;
  if (cue.kind === "orange" || cue.kind === "pink" || cue.kind === "white") {
    ring.position.set(anchor.position.x, 0.05, anchor.position.z);
    ring.scale.setScalar(cue.scale);
    ring.rotation.y = elapsed * 0.6;
  }
  if (cue.kind === "diamond") {
    diamond.position.set(shell.position.x, 2.05, shell.position.z);
    diamond.scale.setScalar(cue.scale);
    diamond.rotation.y = elapsed * 2.2;
  }
}

function applyGrade(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  hemi: THREE.HemisphereLight,
  sun: THREE.DirectionalLight,
  grade: ReturnType<typeof sampleFrame>["grade"],
) {
  const fog = scene.fog as THREE.Fog;
  if (grade.warm >= 0.5) fog.color.copy(NEUTRAL).lerp(WARM, (grade.warm - 0.5) * 2);
  else fog.color.copy(NEUTRAL).lerp(COOL, (0.5 - grade.warm) * 2);
  if (scene.background instanceof THREE.Color) scene.background.copy(fog.color);
  renderer.setClearColor(fog.color, 1);
  renderer.toneMappingExposure = grade.exposure;
  hemi.color.setHex(grade.warm > 0.4 ? 0xf4efe8 : 0xc5d5e2);
  sun.intensity = 1.15 + grade.warm * 1.5;
}

function cueMarker(color: number) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ground = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.78, 40), mat);
  ground.rotation.x = -Math.PI / 2;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 6, 28), mat);
  hoop.position.y = 0.72;
  group.add(ground, hoop);
  group.visible = false;
  return group;
}

function buildShell(kind: "lean" | "shield" | "hood") {
  const group = new THREE.Group();
  group.name = `shell-${kind}`;
  const body = greyMat(kind === "hood" ? 0x4a4744 : kind === "shield" ? 0x5c5854 : 0x6a6560, 0.96);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(kind === "shield" ? 0.46 : 0.32, 0.7, 0.28), body);
  torso.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.26), body);
  head.position.y = 1.28;
  group.add(torso, head);
  if (kind === "lean") {
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), greyMat(0x8d887f, 0.7));
    sword.position.set(0.22, 0.85, 0.16);
    sword.rotation.z = -0.4;
    group.add(sword);
  }
  if (kind === "shield") {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.42), greyMat(0x8a8680, 0.8));
    shield.position.set(-0.32, 0.85, 0.12);
    group.add(shield);
  }
  if (kind === "hood") {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 4), greyMat(0x3a3836, 1));
    hood.position.y = 1.5;
    group.add(hood);
  }
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });
  return group;
}

function buildCloth() {
  const mat = greyMat(0x3a3836, 1);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 2.15, 1, 4), mat);
  mesh.name = "arch-cloth";
  mesh.position.set(0, 2.65, SET.arch.z - 0.42);
  mesh.castShadow = true;
  return mesh;
}

function buildAsh() {
  const group = new THREE.Group();
  group.name = "ash-pickup";
  const flakes: THREE.Mesh[] = [];
  const flakeMat = greyMat(0x9a938c, 1);
  for (let i = 0; i < 6; i += 1) {
    const flake = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), flakeMat);
    const a = (i / 6) * Math.PI * 2;
    flake.position.set(Math.cos(a) * 0.22, 0.05, Math.sin(a) * 0.22);
    flakes.push(flake);
    group.add(flake);
  }
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffb15a,
    emissive: 0xff6a1a,
    emissiveIntensity: 0.8,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i += 1) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28 + i * 0.08, 5), flameMat);
    flame.position.y = 0.22 + i * 0.06;
    flames.push(flame);
    group.add(flame);
  }
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffb089,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.48, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  group.visible = false;
  return { group, flames, ring };
}

function buildCourtyard(scene: THREE.Scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), greyMat(0xdcd7d0, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(24, 24, 0x8d877f, 0xc2bbb2);
  grid.position.y = 0.012;
  scene.add(grid);

  for (let i = 0; i < 8; i += 1) {
    scene.add(box(0.62, 0.035, 0.62, 0xc9c3ba, 0, 0.02, 0.9 + i * 1.2));
  }

  for (const z of [0.2, 3.1, 6.0, 8.7]) {
    scene.add(box(0.4, 2.7, 0.4, 0xb3ada6, -3.35, 1.35, z));
    scene.add(box(0.4, 2.7, 0.4, 0xb3ada6, 3.35, 1.35, z));
  }

  const archZ = SET.arch.z;
  scene.add(box(0.46, 3.5, 0.46, 0x9c968f, -1.75, 1.75, archZ));
  scene.add(box(0.46, 3.5, 0.46, 0x9c968f, 1.75, 1.75, archZ));
  scene.add(box(4.1, 0.36, 0.5, 0x9c968f, 0, 3.55, archZ));
  scene.add(box(8.2, 4.2, 0.28, 0xa8a29a, 0, 2.1, 12.35));
}

function buildFire(): { group: THREE.Group; flames: THREE.Mesh[]; light: THREE.PointLight } {
  const group = new THREE.Group();
  group.name = "fire-core";
  const stone = greyMat(0xb7b2aa, 0.96);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.09, 5, 12), stone);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  const coal = new THREE.MeshStandardMaterial({
    color: 0x2c2622,
    roughness: 1,
    metalness: 0,
    emissive: 0x6a2c12,
    emissiveIntensity: 0.45,
    flatShading: true,
  });
  for (let i = 0; i < 5; i += 1) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), coal);
    const a = (i / 5) * Math.PI * 2;
    chunk.position.set(Math.cos(a) * 0.22, 0.14, Math.sin(a) * 0.22);
    chunk.castShadow = true;
    group.add(chunk);
  }

  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffb15a,
    emissive: 0xff6a1a,
    emissiveIntensity: 1.35,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i += 1) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14 - i * 0.025, 0.5 + i * 0.16, 5), flameMat);
    flame.position.y = 0.48 + i * 0.08;
    flames.push(flame);
    group.add(flame);
  }

  const light = new THREE.PointLight(0xff7a2e, 18, 11, 1.4);
  light.position.y = 0.7;
  group.add(light);
  return { group, flames, light };
}

/** Far stand-in. A block silhouette, not a combat actor. */
function buildDukeBlock() {
  const group = new THREE.Group();
  group.name = "duke-block";
  const bodyMat = greyMat(0x4e4a46, 0.94);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.4, 0.46), bodyMat);
  body.position.y = 1.18;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.5), bodyMat);
  helm.position.y = 2.12;
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0x2a2826,
    roughness: 0.8,
    metalness: 0.1,
    emissive: 0xfff4e0,
    emissiveIntensity: 0.15,
    flatShading: true,
  });
  const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
  const leftHorn = new THREE.Mesh(hornGeo, hornMat);
  leftHorn.position.set(-0.14, 2.48, 0);
  leftHorn.rotation.z = 0.28;
  const rightHorn = new THREE.Mesh(hornGeo, hornMat);
  rightHorn.position.set(0.14, 2.48, 0);
  rightHorn.rotation.z = -0.28;
  const capeMat = greyMat(0x3c3936, 1);
  capeMat.side = THREE.DoubleSide;
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.45), capeMat);
  cape.position.set(0, 1.25, -0.28);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), greyMat(0x2a2826, 1));
  visor.position.set(0, 2.12, 0.26);
  group.add(body, helm, leftHorn, rightHorn, cape, visor);
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });
  return { group, horn: hornMat };
}

function greyMat(color: number, roughness: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading: true,
  });
}

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), greyMat(color, 0.96));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function disposeScene(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) geos.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const mat of list) mats.add(mat);
  });
  for (const geo of geos) geo.dispose();
  for (const mat of mats) mat.dispose();
}

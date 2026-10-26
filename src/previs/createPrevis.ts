import * as THREE from "three";
import { makeKnight, type KnightRig } from "@/game/knightMesh";
import { beatAt, sampleCamera, samplePose, SET, SHOT, type PoseSample } from "@/previs/shot";

export type PrevisFrame = {
  /** 0..1 position in the loop. */
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

/**
 * Greybox player. Blocking + camera path only — no combat, no video plate.
 * Appearance (textures, concept lookdev) does not belong here; time the shot
 * in `shot.ts`.
 */
export function createPrevis(
  canvas: HTMLCanvasElement,
  options: PrevisOptions = {},
): PrevisHandle | null {
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
  scene.background = new THREE.Color(0xc8c3bb);
  scene.fog = new THREE.Fog(0xc8c3bb, 16, 34);

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

  const duke = buildDukeBlock();
  duke.position.set(SET.duke.x, SET.duke.y, SET.duke.z);
  duke.rotation.y = SET.duke.yaw;
  scene.add(duke);

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

  let paused = false;
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let disposed = false;

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
    const cam = sampleCamera(u);
    camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
    camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
    applyBlockingPose(rig, samplePose(u), elapsed);
    const flick = 0.86 + Math.sin(elapsed * 11.5) * 0.08 + Math.sin(elapsed * 17.2) * 0.05;
    fire.flames.forEach((flame, i) => {
      flame.scale.y = flick * (1 + i * 0.05);
    });
    fire.light.intensity = 16 + Math.sin(elapsed * 9) * 3;
    duke.rotation.y = SET.duke.yaw + Math.sin(elapsed * 0.65) * 0.06;
    renderer.render(scene, camera);
    options.onFrame?.({ u, seconds: u * SHOT.seconds, label: beatAt(u) });
  };
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
      disposeScene(scene);
      renderer.dispose();
    },
  };
}

/** Secondary motion only. Blocking keys stay in shot.ts. */
function applyBlockingPose(rig: KnightRig, pose: PoseSample, elapsed: number) {
  const breath = Math.sin(elapsed * 1.7) * 0.012;
  const bob = Math.abs(Math.sin(elapsed * Math.PI * 2 * 1.55)) * 0.04 * pose.stride;
  rig.root.position.set(pose.x, 0, pose.z);
  rig.root.rotation.set(0, pose.yaw, 0);
  rig.bob.position.y = breath + bob;
  rig.bob.rotation.set(Math.sin(elapsed * 1.5) * 0.02, pose.step * 0.08, 0);
  rig.legL.rotation.x = pose.step;
  rig.legR.rotation.x = -pose.step;
  rig.weapon.rotation.set(pose.swordX, 0, pose.swordZ);
  rig.head.rotation.set(pose.headPitch, pose.headYaw, 0);
  rig.tail.rotation.set(0.1, Math.sin(elapsed * 2.3) * 0.28, 0);
  rig.cape.rotation.x = 0.2 + Math.sin(elapsed * 1.45) * 0.045 * (0.4 + pose.stride);
  rig.cape.rotation.z = Math.sin(elapsed * 1.1) * 0.03;
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

  const archZ = 11.15;
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
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14 - i * 0.025, 0.5 + i * 0.16, 5),
      flameMat,
    );
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
function buildDukeBlock(): THREE.Group {
  const group = new THREE.Group();
  group.name = "duke-block";
  const bodyMat = greyMat(0x4e4a46, 0.94);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.4, 0.46), bodyMat);
  body.position.y = 1.18;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.5), bodyMat);
  helm.position.y = 2.12;
  const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
  const leftHorn = new THREE.Mesh(hornGeo, bodyMat);
  leftHorn.position.set(-0.14, 2.48, 0);
  leftHorn.rotation.z = 0.28;
  const rightHorn = new THREE.Mesh(hornGeo, bodyMat);
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
  return group;
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

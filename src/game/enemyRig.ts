import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { KnightRig } from "@/game/knightMesh";
import { makeHollow, makeDuke, makeDemon } from "@/game/enemyMesh";

const MODELS: Record<string, string> = {
  hollow: "/models/hollow.glb",
  duke: "/models/duke.glb",
  demon: "/models/demon.glb",
};

function groupAt(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function makeSimpleRigFromScene(scene: THREE.Object3D, scale = 1): KnightRig {
  const root = new THREE.Group();
  root.userData.baked = true;
  const bob = new THREE.Group();
  root.add(bob);

  // Center and scale the imported model
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  scene.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fit = 1.6 / maxDim;
  scene.scale.setScalar(fit * scale);
  scene.position.y += size.y * fit * scale * 0.5;

  bob.add(scene);

  const head = groupAt(bob, 0, 0.55, 0);
  const weapon = groupAt(bob, 0.25, 0.4, 0.1);
  const cape = groupAt(bob, 0, 0.4, -0.15);
  const legL = groupAt(bob, -0.12, 0.2, 0);
  const legR = groupAt(bob, 0.12, 0.2, 0);
  const tail = groupAt(bob, 0, 0.25, -0.2);

  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  const dummyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  return { root, bob, head, weapon, cape, legL, legR, tail, armorMat: dummyMat, furMat: dummyMat, eyeMat: dummyMat };
}

export function loadEnemyRig(kind: "hollow" | "duke" | "demon", role?: "road" | "side"): Promise<KnightRig> {
  const url = MODELS[kind];
  if (!url) return Promise.resolve(kind === "hollow" ? makeHollow(role) : kind === "duke" ? makeDuke() : makeDemon());

  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const scale = kind === "duke" ? 2.2 : kind === "demon" ? 1.4 : 1.5;
        console.info(`[enemy] loaded external ${kind} model`);
        resolve(makeSimpleRigFromScene(gltf.scene, scale));
      },
      undefined,
      (err) => {
        console.warn(`[enemy] failed to load ${url}, using procedural`, err);
        resolve(kind === "hollow" ? makeHollow(role) : kind === "duke" ? makeDuke() : makeDemon());
      },
    );
  });
}

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
  const head = groupAt(bob, 0, 0.4, 0);
  const weapon = groupAt(bob, 0.2, 0.3, 0.1);
  const cape = groupAt(bob, 0, 0.3, -0.1);
  const legL = groupAt(bob, -0.1, 0.15, 0);
  const legR = groupAt(bob, 0.1, 0.15, 0);
  const tail = groupAt(bob, 0, 0.2, -0.15);

  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      bob.add(o);
    }
  });
  root.scale.setScalar(scale);

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
        const scale = kind === "duke" ? 1.8 : kind === "demon" ? 1.1 : 1.2;
        resolve(makeSimpleRigFromScene(gltf.scene, scale));
      },
      undefined,
      () => {
        // fallback to procedural
        resolve(kind === "hollow" ? makeHollow(role) : kind === "duke" ? makeDuke() : makeDemon());
      },
    );
  });
}

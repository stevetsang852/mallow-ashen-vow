import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { KnightRig } from "@/game/knightMesh";

const MODEL = "/models/mallow-knight-cat.glb";

function groupAt(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function slotFor(meshName: string) {
  if (/^Sword_|^Armor_Gauntlet|^Armor_Thumb|^Armor_Vambrace/.test(meshName)) return "weapon";
  if (/^Cloth_Cape/.test(meshName)) return "cape";
  if (/BootL$|BootStrapL$|HockL$/.test(meshName)) return "legL";
  if (/BootR$|BootStrapR$|HockR$/.test(meshName)) return "legR";
  if (/^Fur_Tail/.test(meshName)) return "tail";
  if (
    /^(Fur_Head|Fur_Muzzle|Fur_Ear|Fur_Inner|Bow_|Eye_|Nose|Whisker_|Fur_Cheek)/.test(meshName)
  ) {
    return "head";
  }
  return "body";
}

function paintSlot(mesh: THREE.Mesh, name: string) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const matName = mats[0] && "name" in mats[0] ? String(mats[0].name) : "";
  mesh.userData.slot = /fur|eye|nose|inner|bow/i.test(matName)
    ? "fur"
    : /cape|leather/i.test(matName)
      ? "cloth"
      : "armor";
  mesh.userData.part = name;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
}

export function flashMallow(root: THREE.Object3D, amount: number) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      const base = m.userData.baseEmissive as THREE.Color | undefined;
      if (!base) continue;
      if (amount <= 0) {
        m.emissive.copy(base);
        continue;
      }
      if (o.userData.slot === "fur") m.emissive.setRGB(base.r + amount * 0.35, base.g + amount * 0.16, base.b + amount * 0.08);
      else if (o.userData.slot === "armor") m.emissive.setRGB(base.r + amount, base.g + amount * 0.45, base.b + amount * 0.28);
    }
  });
}

export function loadMallowRig(): Promise<KnightRig> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      MODEL,
      (gltf) => {
        const root = new THREE.Group();
        root.name = "Mallow";
        root.userData.baked = true;
        root.userData.mallow = true;
        const bob = new THREE.Group();
        root.add(bob);

        const head = groupAt(bob, 0, 0.3, 0.02);
        const weapon = groupAt(bob, -0.016, 0.19, 0.078);
        const cape = groupAt(bob, -0.02, 0.22, -0.05);
        cape.userData.baseX = 0;
        const legL = groupAt(bob, 0.04, 0.12, 0.01);
        const legR = groupAt(bob, -0.04, 0.12, 0.01);
        const tail = groupAt(bob, 0.03, 0.145, -0.03);
        const buckets: Record<string, THREE.Group> = {
          head,
          weapon,
          cape,
          legL,
          legR,
          tail,
          body: bob,
        };

        gltf.scene.updateMatrixWorld(true);
        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) meshes.push(o);
        });

        for (const mesh of meshes) {
          const name = mesh.name || mesh.parent?.name || "";
          mesh.name = name;
          mesh.geometry = mesh.geometry.clone();
          mesh.geometry.applyMatrix4(mesh.matrixWorld);
          mesh.position.set(0, 0, 0);
          mesh.quaternion.identity();
          mesh.scale.set(1, 1, 1);
          const slot = slotFor(name);
          const host = buckets[slot] ?? bob;
          paintSlot(mesh, name);
          if (host !== bob) mesh.position.sub(host.position);
          host.add(mesh);
        }

        root.scale.setScalar(3.15);

        let armorMat = new THREE.MeshStandardMaterial({ color: 0xc5ced8, metalness: 0.8, roughness: 0.3 });
        let furMat = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.8 });
        let eyeMat = new THREE.MeshStandardMaterial({ color: 0x241c18 });
        root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const list = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of list) {
            if (!(m instanceof THREE.MeshStandardMaterial)) continue;
            m.normalMap = null;
            m.metalness = o.userData.slot === "armor" ? 0.55 : 0.04;
            m.roughness = o.userData.slot === "armor" ? 0.4 : 0.72;
            m.emissive = new THREE.Color(o.userData.slot === "armor" ? 0x2a3138 : 0x3a2a1c);
            m.emissiveIntensity = o.userData.slot === "armor" ? 0.22 : 0.38;
            if (m.map && o.userData.slot !== "armor") {
              m.emissiveMap = m.map;
              m.emissiveIntensity = 0.28;
            }
            if (o.userData.slot === "cloth" || o.name.startsWith("Cloth_")) m.side = THREE.DoubleSide;
            m.userData.baseEmissive = m.emissive.clone();
          }
          o.geometry.computeVertexNormals();
          const m = list[0];
          if (!(m instanceof THREE.MeshStandardMaterial)) return;
          if (o.userData.slot === "armor") armorMat = m;
          else if (o.name.startsWith("Eye_")) eyeMat = m;
          else if (o.userData.slot === "fur") furMat = m;
        });

        resolve({ root, bob, head, weapon, cape, legL, legR, tail, armorMat, furMat, eyeMat });
      },
      undefined,
      (err) => reject(err),
    );
  });
}

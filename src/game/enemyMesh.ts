import * as THREE from "three";
import { makeKnight, type KnightRig, type KnightOpts } from "@/game/knightMesh";

function std(color: number, rough: number, metal: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
  });
}

function addCracks(mesh: THREE.Mesh, color = 0xe85d04, intensity = 0.6) {
  // Simple emissive overlay simulation via material clone for glow cracks
  const crackMat = mesh.material.clone() as THREE.MeshStandardMaterial;
  crackMat.emissive.setHex(color);
  crackMat.emissiveIntensity = intensity;
  crackMat.color.multiplyScalar(0.4);
  // In a real model this would be a separate mesh; here we just tint the base
  if (mesh.material instanceof THREE.MeshStandardMaterial) {
    mesh.material.emissive = crackMat.emissive;
    mesh.material.emissiveIntensity = intensity * 0.35;
  }
}

export function makeHollow(role: "road" | "side" = "side"): KnightRig {
  const opts: KnightOpts = {
    fur: 0x6e5b49,
    armor: 0x8d8680,
    bow: false,
    helm: true,
    cape: false,
    eye: 0x1a1412,
    eyeEmissive: 0xff6a2a,
  };
  const rig = makeBaseRig(opts, "hollow");

  // Ash-cracked armor plates
  const ashMat = std(0x5a524a, 0.85, 0.45);
  ashMat.emissive.setHex(0xe85d04);
  ashMat.emissiveIntensity = 0.18;
  const crackGeo = new THREE.BoxGeometry(0.06, 0.22, 0.01);
  for (let i = 0; i < 5; i++) {
    const crack = new THREE.Mesh(crackGeo, ashMat);
    crack.position.set((i - 2) * 0.08, 0.85, 0.22);
    crack.rotation.z = (i - 2) * 0.12;
    rig.bob.add(crack);
  }

  // Broken sword with ember glow
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.emissive.setHex(0xe85d04);
    blade.material.emissiveIntensity = 0.4;
    blade.scale.y = 0.75;
  }

  // Ash shield
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

  // Shield already added in createGame; enhance helm
  const helm = rig.head.children.find((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry);
  if (helm && helm instanceof THREE.Mesh && helm.material instanceof THREE.MeshStandardMaterial) {
    helm.material.roughness = 0.7;
    helm.material.metalness = 0.6;
    addCracks(helm, 0xff4d2e, 0.3);
  }

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.28, 0.36),
    std(0x3a342e, 0.8, 0.2),
  );
  hood.position.set(0, 0.08, 0.02);
  rig.head.add(hood);
  if (role === "road") {
    rig.weapon.scale.set(0.7, 0.62, 0.7);
    rig.root.scale.set(0.82, 1.08, 0.78);
    const shield = rig.bob.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.CylinderGeometry);
    if (shield) shield.visible = false;
  } else {
    rig.root.scale.set(1.18, 0.96, 1.22);
  }
  return rig;
}

export function makeDuke(): KnightRig {
  const opts: KnightOpts = {
    fur: 0x2c2624,
    armor: 0x3a342e,
    bow: false,
    helm: true,
    cape: true,
    eye: 0x2a0c08,
    eyeEmissive: 0xff4d2e,
  };
  const rig = makeBaseRig(opts, "duke");

  // Horned helm
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.38, 6),
      std(0x1c1816, 0.4, 0.8),
    );
    horn.position.set(sx * 0.18, 0.38, -0.02);
    horn.rotation.z = sx * -0.55;
    rig.head.add(horn);
  }

  // Glowing cracks on torso
  const plate = rig.bob.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (plate && plate instanceof THREE.Mesh && plate.material instanceof THREE.MeshStandardMaterial) {
    plate.material.color.setHex(0x2a241f);
    plate.material.emissive.setHex(0xe85d04);
    plate.material.emissiveIntensity = 0.55;
    plate.material.roughness = 0.55;
  }

  // Larger greatsword
  rig.weapon.scale.set(1.15, 1.35, 1.1);
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.emissive.setHex(0xff7a32);
    blade.material.emissiveIntensity = 0.7;
  }

  // Tattered cape already present; scale up
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.12),
    std(0x1c1816, 0.45, 0.7),
  );
  visor.position.set(0, 0.04, 0.22);
  rig.head.add(visor);
  rig.root.scale.set(1.62, 1.96, 1.62);
  return rig;
}

export function makeDemon(): KnightRig {
  const opts: KnightOpts = {
    fur: 0x3a1418,
    armor: 0x5a1c28,
    bow: false,
    helm: false,
    cape: true,
    eye: 0xff2430,
    eyeEmissive: 0xff2430,
  };
  const rig = makeBaseRig(opts, "demon");

  // Horns
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.32, 5),
      std(0x2a0c10, 0.5, 0.3),
    );
    horn.position.set(sx * 0.14, 0.32, 0);
    horn.rotation.z = sx * -0.4;
    rig.head.add(horn);
  }

  // Small wings / tattered cape already; add wing-like planes
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.7, 2, 3),
      std(0x4a1822, 0.9, 0.05),
    );
    wing.position.set(sx * 0.32, 0.9, -0.1);
    wing.rotation.y = sx * 0.6;
    wing.rotation.z = sx * -0.2;
    wing.material.side = THREE.DoubleSide;
    rig.bob.add(wing);
  }

  // Curved blade glow
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.color.setHex(0x8a2430);
    blade.material.emissive.setHex(0xff2430);
    blade.material.emissiveIntensity = 0.6;
    blade.scale.set(0.7, 0.85, 1);
  }

  rig.root.scale.setScalar(1.06);
  return rig;
}

// Shared base builder that mirrors makeKnight structure so poseKnight works
function makeBaseRig(opts: KnightOpts, _kind: string): KnightRig {
  return makeKnight(opts);
}

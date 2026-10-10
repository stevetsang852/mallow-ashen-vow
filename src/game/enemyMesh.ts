import * as THREE from "three";
import { makeKnight, type KnightRig, type KnightOpts } from "@/game/knightMesh";

function std(color: number, rough: number, metal: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
  });
}

function addSpikes(group: THREE.Group, count: number, color: number, scale = 1) {
  const mat = std(color, 0.6, 0.4);
  mat.emissive.setHex(0xe85d04);
  mat.emissiveIntensity = 0.25;
  for (let i = 0; i < count; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03 * scale, 0.22 * scale, 5), mat);
    const a = (i / count) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.18, 0.9 + (i % 3) * 0.08, Math.sin(a) * 0.12);
    spike.rotation.z = Math.sin(a) * 0.4;
    spike.rotation.x = Math.cos(a) * 0.3;
    group.add(spike);
  }
}

function addTentacles(group: THREE.Group, count: number, color: number) {
  const mat = std(color, 0.75, 0.05);
  mat.emissive.setHex(0xe85d04);
  mat.emissiveIntensity = 0.2;
  for (let i = 0; i < count; i++) {
    const tent = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.35, 4, 6), mat);
    const a = (i / count) * Math.PI * 2;
    tent.position.set(Math.cos(a) * 0.12, 0.65, Math.sin(a) * 0.1);
    tent.rotation.z = Math.sin(a) * 0.6;
    tent.rotation.x = Math.cos(a) * 0.4;
    group.add(tent);
  }
}

function addBones(group: THREE.Group) {
  const boneMat = std(0x4a4038, 0.85, 0.1);
  for (let i = 0; i < 4; i++) {
    const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.18, 3, 4), boneMat);
    bone.position.set((i - 1.5) * 0.08, 0.55, 0.15);
    bone.rotation.z = (i - 1.5) * 0.3;
    group.add(bone);
  }
}
  const mat = std(0x3a2418, 0.5, 0.2);
  for (let i = 0; i < 3; i++) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.14, 4), mat);
    claw.position.set(side * (0.22 + i * 0.04), 0.72, 0.18 + i * 0.03);
    claw.rotation.z = side * -0.8;
    claw.rotation.x = 0.4;
    group.add(claw);
  }
}

export function makeHollow(role: "road" | "side" = "side"): KnightRig {
  const opts: KnightOpts = {
    fur: 0x4a3a2a,
    armor: 0x5a4a3a,
    bow: false,
    helm: false,
    cape: false,
    foe: true,
    eye: 0x1a1008,
    eyeEmissive: 0xff6a2a,
  };
  const rig = makeKnight(opts);

  // Hide most knight armor plates
  rig.bob.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) {
      o.visible = false;
    }
  });

  // Ash-flesh body with irregular spikes
  const bodyMat = std(0x3a2a20, 0.9, 0.05);
  bodyMat.emissive.setHex(0xe85d04);
  bodyMat.emissiveIntensity = 0.15;
  const lump = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bodyMat);
  lump.scale.set(1.1, 0.85, 0.9);
  lump.position.y = 0.78;
  rig.bob.add(lump);

  addSpikes(rig.bob, 7, 0x2a1a12, 0.8);
  addClaws(rig.bob, -1);
  addClaws(rig.bob, 1);
  addTentacles(rig.bob, 5, 0x3a2a20);
  addBones(rig.bob);

  // Broken weapon remains glowing
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.emissive.setHex(0xe85d04);
    blade.material.emissiveIntensity = 0.55;
    blade.scale.set(0.6, 0.65, 0.6);
  }

  // Hollow head: more skull-like, glowing eyes only
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), std(0x2a2018, 0.8, 0.1));
  skull.position.y = 0.05;
  skull.scale.set(1.05, 0.9, 0.95);
  rig.head.add(skull);

  if (role === "road") {
    rig.root.scale.set(0.78, 1.12, 0.74);
    rig.weapon.scale.set(0.6, 0.55, 0.6);
  } else {
    rig.root.scale.set(1.22, 0.92, 1.28);
  }
  return rig;
}

export function makeDuke(): KnightRig {
  const opts: KnightOpts = {
    fur: 0x1a1210,
    armor: 0x2a1a16,
    bow: false,
    helm: false,
    cape: true,
    foe: true,
    eye: 0xff4d2e,
    eyeEmissive: 0xff4d2e,
  };
  const rig = makeKnight(opts);

  // Massive irregular ash-beast body
  rig.bob.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.geometry instanceof THREE.BoxGeometry || o.geometry instanceof THREE.CylinderGeometry)) {
      o.visible = false;
    }
  });

  const bulk = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), std(0x1c1410, 0.75, 0.15));
  bulk.scale.set(1.15, 0.95, 1.05);
  bulk.position.y = 0.82;
  bulk.material.emissive.setHex(0xe85d04);
  bulk.material.emissiveIntensity = 0.45;
  rig.bob.add(bulk);

  // Large horns and spikes
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 6), std(0x0c0806, 0.4, 0.6));
    horn.position.set(sx * 0.22, 0.48, -0.04);
    horn.rotation.z = sx * -0.7;
    rig.head.add(horn);
  }
  addSpikes(rig.bob, 9, 0x1a100c, 1.2);
  addTentacles(rig.bob, 6, 0x1c1410);
  addBones(rig.bob);

  // Oversized glowing weapon
  rig.weapon.scale.set(1.35, 1.55, 1.2);
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.emissive.setHex(0xff7a32);
    blade.material.emissiveIntensity = 0.85;
  }

  rig.root.scale.set(1.7, 2.05, 1.7);
  return rig;
}

export function makeDemon(): KnightRig {
  const opts: KnightOpts = {
    fur: 0x2a0c14,
    armor: 0x3a1018,
    bow: false,
    helm: false,
    cape: false,
    foe: true,
    eye: 0xff2430,
    eyeEmissive: 0xff2430,
  };
  const rig = makeKnight(opts);

  // Slim demonic form with wings and claws
  rig.bob.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) {
      o.visible = false;
    }
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), std(0x2a0c12, 0.85, 0.08));
  body.scale.set(0.9, 1.05, 0.85);
  body.position.y = 0.75;
  body.material.emissive.setHex(0xff2430);
  body.material.emissiveIntensity = 0.3;
  rig.bob.add(body);

  // Large horns
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 5), std(0x1a080c, 0.5, 0.25));
    horn.position.set(sx * 0.16, 0.38, 0.02);
    horn.rotation.z = sx * -0.55;
    rig.head.add(horn);
  }

  // Bat-like wings
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.85, 2, 3), std(0x3a1018, 0.9, 0.04));
    wing.position.set(sx * 0.38, 0.95, -0.08);
    wing.rotation.y = sx * 0.7;
    wing.rotation.z = sx * -0.25;
    wing.material.side = THREE.DoubleSide;
    wing.material.emissive.setHex(0xff2430);
    wing.material.emissiveIntensity = 0.2;
    rig.bob.add(wing);
  }

  addClaws(rig.bob, -1);
  addClaws(rig.bob, 1);

  // Curved glowing blade
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.color.setHex(0x8a2430);
    blade.material.emissive.setHex(0xff2430);
    blade.material.emissiveIntensity = 0.75;
    blade.scale.set(0.55, 0.7, 0.8);
  }

  rig.root.scale.setScalar(1.08);
  return rig;
}

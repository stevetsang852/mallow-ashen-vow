import * as THREE from "three";
import { makeKnight, type KnightRig, type KnightOpts } from "@/game/knightMesh";

function std(color: number, rough: number, metal: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    envMapIntensity: 0.35,
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

function addClaws(group: THREE.Group, side: number) {
  const mat = std(0x3a2418, 0.5, 0.2);
  for (let i = 0; i < 3; i++) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.14, 4), mat);
    claw.position.set(side * (0.22 + i * 0.04), 0.72, 0.18 + i * 0.03);
    claw.rotation.z = side * -0.8;
    claw.rotation.x = 0.4;
    group.add(claw);
  }
}

function addOnionArmor(group: THREE.Group, color: number) {
  const mat = std(color, 0.55, 0.45);
  mat.emissive.setHex(0xe85d04);
  mat.emissiveIntensity = 0.12;
  // Layered onion-style plates
  for (let i = 0; i < 4; i++) {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.22 - i * 0.03, 10, 6), mat);
    plate.scale.set(1.15, 0.45, 1.05);
    plate.position.y = 0.55 + i * 0.12;
    group.add(plate);
  }
  // Big chibi head plate
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), mat);
  helm.scale.set(1.05, 0.85, 1.05);
  helm.position.y = 1.15;
  group.add(helm);
}

export function makeHollow(role: "road" | "side" = "side"): KnightRig {
  const opts: KnightOpts = {
    fur: 0x4a3a2a,
    armor: 0x6a5a4a,
    bow: false,
    helm: false,
    cape: false,
    foe: true,
    eye: 0x1a1008,
    eyeEmissive: 0xff6a2a,
  };
  const rig = makeKnight(opts);

  // Hide original box armor
  rig.bob.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) {
      o.visible = false;
    }
  });

  // Chibi onion armor style (ash-toned)
  addOnionArmor(rig.bob, 0x5a4a3a);

  // Short chibi body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std(0x3a2a20, 0.85, 0.1));
  body.scale.set(1.1, 0.7, 1.0);
  body.position.y = 0.62;
  rig.bob.add(body);

  addSpikes(rig.bob, 4, 0x2a1a12, 0.6);
  addClaws(rig.bob, -1);
  addClaws(rig.bob, 1);

  // Bigger chibi head
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), std(0x2a2018, 0.75, 0.15));
  skull.position.y = 0.08;
  skull.scale.set(1.15, 0.95, 1.1);
  rig.head.add(skull);

  // Road hollow: thinner + shorter weapon (distinct silhouette).
  if (role === "road") {
    rig.root.scale.set(0.85, 0.82, 0.85);
    const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
    if (blade) blade.scale.set(0.6, 0.55, 0.7);
    // No shield on road hollow.
  } else {
    // Side hollow: wider body + round tower shield.
    rig.root.scale.set(1.18, 0.9, 1.14);
    const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
    if (blade) blade.scale.set(0.9, 0.9, 0.9);
    
    // Enhanced shield with damage details
    const shieldMat = std(0x4a3a2c, 0.65, 0.35); // More metallic
    const shield = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 24), // Slightly larger
      shieldMat,
    );
    shield.material.side = THREE.DoubleSide;
    shield.position.set(-0.36, 0.88, 0.24);
    shield.rotation.y = 0.5;
    
    // Shield boss (center bump)
    const boss = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 8), 
      std(0x2a1f18, 0.45, 0.55) // More metallic
    );
    boss.position.set(0, 0, 0.04);
    shield.add(boss);
    
    // Damage scratches on shield
    for (let i = 0; i < 4; i++) {
      const scratch = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.12 + hash(i + 20) * 0.08, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 0.9 }),
      );
      scratch.position.set(
        (hash(i + 30) - 0.5) * 0.25,
        (hash(i + 40) - 0.5) * 0.3,
        0.05
      );
      scratch.rotation.z = hash(i + 50) * 0.5;
      shield.add(scratch);
    }
    rig.bob.add(shield);
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

  // Duke height increase: +0.5 units (was 0.42, now 0.92)
  const bulk = new THREE.Mesh(new THREE.SphereGeometry(0.92, 14, 10), std(0x1c1410, 0.75, 0.15));
  bulk.scale.set(1.15, 0.95, 1.05);
  bulk.position.y = 0.82;
  bulk.material.emissive.setHex(0xe85d04);
  bulk.material.emissiveIntensity = 0.45;
  rig.bob.add(bulk);

  // Duke shoulder pads increase: 20% larger
  // Add shoulder pads as separate boxes
  const shoulderMat = std(0x1c1410, 0.75, 0.15);
  shoulderMat.emissive.setHex(0xe85d04);
  shoulderMat.emissiveIntensity = 0.45;
  
  const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.14), shoulderMat);
  leftShoulder.position.set(-0.25, 0.95, 0.05);
  rig.bob.add(leftShoulder);
  
  const rightShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.14), shoulderMat);
  rightShoulder.position.set(0.25, 0.95, 0.05);
  rig.bob.add(rightShoulder);

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

  // Phase 2 glow: enhanced eyes and chest emission
  // Increase eye glow intensity for phase 2
  rig.eyeMat.emissiveIntensity = 1.2; // Increased from default
  
  // Add chest glow indicator (visible in phase 2)
  const chestGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff4d2e,
      emissive: 0xff4d2e,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
    }),
  );
  chestGlow.position.set(0, 0.85, 0.25);
  chestGlow.name = "chestGlow";
  rig.bob.add(chestGlow);

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

  // Bat-like wings with more detail
  for (const sx of [-1, 1]) {
    // Main wing
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.95, 3, 4), std(0x3a1018, 0.85, 0.04));
    wing.position.set(sx * 0.4, 0.98, -0.1);
    wing.rotation.y = sx * 0.75;
    wing.rotation.z = sx * -0.28;
    wing.material.side = THREE.DoubleSide;
    wing.material.emissive.setHex(0xff2430);
    wing.material.emissiveIntensity = 0.25;
    rig.bob.add(wing);
    
    // Wing membrane (inner part)
    const membrane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.75, 2, 3),
      new THREE.MeshStandardMaterial({
        color: 0x2a0c12,
        roughness: 0.95,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    membrane.position.set(sx * 0.38, 0.95, -0.06);
    membrane.rotation.y = sx * 0.65;
    membrane.rotation.z = sx * -0.2;
    rig.bob.add(membrane);
    
    // Wing bones (structural detail)
    for (let i = 0; i < 3; i++) {
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.006, 0.5 + i * 0.1, 4),
        std(0x1a080c, 0.7, 0.1),
      );
      bone.position.set(
        sx * (0.25 + i * 0.12),
        0.85 + i * 0.15,
        -0.08
      );
      bone.rotation.z = sx * (0.3 + i * 0.15);
      rig.bob.add(bone);
    }
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

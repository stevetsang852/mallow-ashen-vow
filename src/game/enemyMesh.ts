import * as THREE from "three";
import { makeKnight, type KnightRig, type KnightOpts } from "@/game/knightMesh";
import { hash } from "@/game/moves";

function std(color: number, rough: number, metal: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    envMapIntensity: 0.45,
  });
}

function addWeatheredArmor(group: THREE.Group, baseColor: number, emissive = 0xe85d04) {
  const mat = std(baseColor, 0.75, 0.35);
  mat.emissive.setHex(emissive);
  mat.emissiveIntensity = 0.24;
  // Rounder cute layered plates with slight irregularity (cute + dark contrast)
  for (let i = 0; i < 4; i++) {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.26 - i * 0.03, 14, 10), mat);
    const scaleVar = 0.95 + hash(i) * 0.1;
    plate.scale.set(1.25 * scaleVar, 0.5, 1.15);
    plate.position.y = 0.42 + i * 0.13;
    group.add(plate);
  }
  // Oversized cute helm with glowing cracks
  const helmMat = std(baseColor, 0.7, 0.4);
  helmMat.emissive.setHex(emissive);
  helmMat.emissiveIntensity = 0.28;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), helmMat);
  helm.scale.set(1.1, 0.92, 1.1);
  helm.position.y = 1.22;
  group.add(helm);
  // Add crack glow lines on helm
  for (let i = 0; i < 3; i++) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.15 + hash(i) * 0.1, 0.01),
      new THREE.MeshStandardMaterial({
        color: emissive,
        emissive: emissive,
        emissiveIntensity: 0.8,
      }),
    );
    crack.position.set(
      (hash(i + 10) - 0.5) * 0.35,
      1.25 + hash(i + 20) * 0.15,
      0.28 + hash(i + 30) * 0.05,
    );
    crack.rotation.z = (hash(i + 40) - 0.5) * 0.5;
    group.add(crack);
  }
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

  // Weathered ash armor (Dark Souls-inspired: muted, cracked, glowing seams)
  addWeatheredArmor(rig.bob, 0x4a3a2c, 0xe85d04);

  // Dark Souls hollow: slouched, decayed posture
  rig.root.scale.set(0.88, 0.82, 0.88); // Lower, wider stance
  
  // Ashy, decayed body with ember glow from cracks
  const bodyMat = std(0x2a1a14, 0.92, 0.06);
  bodyMat.emissive.setHex(0xe85d04);
  bodyMat.emissiveIntensity = 0.15;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), bodyMat);
  body.scale.set(1.2, 0.68, 1.08); // Flatter, broader torso
  body.position.y = 0.52;
  rig.bob.add(body);
  
  // Add crack glow on body
  for (let i = 0; i < 5; i++) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.1 + hash(i + 50) * 0.08, 0.01),
      new THREE.MeshStandardMaterial({
        color: 0xe85d04,
        emissive: 0xe85d04,
        emissiveIntensity: 0.6 + hash(i + 60) * 0.4,
      }),
    );
    crack.position.set(
      (hash(i + 70) - 0.5) * 0.28,
      0.4 + hash(i + 80) * 0.3,
      0.22 + hash(i + 90) * 0.08,
    );
    crack.rotation.z = (hash(i + 100) - 0.5) * 0.8;
    rig.bob.add(crack);
  }

  addSpikes(rig.bob, 4, 0x2a1a12, 0.6);
  addClaws(rig.bob, -1);
  addClaws(rig.bob, 1);

  // Bigger chibi head
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), std(0x2a2018, 0.75, 0.15));
  skull.position.y = 0.08;
  skull.scale.set(1.15, 0.95, 1.1);
  rig.head.add(skull);

  // Road hollow: thinner + broken greatsword (distinct silhouette).
  if (role === "road") {
    rig.root.scale.set(0.78, 0.78, 0.78); // Even smaller, leaner
    // Broken greatsword - jagged blade
    const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
    if (blade) {
      blade.scale.set(0.45, 0.5, 0.6);
      // Jagged edge effect
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(
          new THREE.ConeGeometry(0.025, 0.08, 4),
          std(0x3a2a20, 0.75, 0.3),
        );
        shard.position.set(
          (hash(i + 110) - 0.5) * 0.04,
          0.08 + i * 0.03,
          0,
        );
        shard.rotation.z = (hash(i + 120) - 0.5) * 0.5;
        blade.add(shard);
      }
    }
    // No shield on road hollow.
  } else {
    // Side hollow: wider body + round tower shield with more damage marks
    rig.root.scale.set(1.22, 0.92, 1.18); // Broader stance
    // Heavier, notched greatsword
    const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
    if (blade) {
      blade.scale.set(1.0, 1.0, 1.0);
      // Notches along blade edge
      for (let i = 0; i < 4; i++) {
        const notch = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.02, 0.02),
          new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 0.95 }),
        );
        notch.position.set(
          0.06,
          -0.1 + i * 0.06,
          0,
        );
        blade.add(notch);
      }
    }
    
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
    fur: 0x0a0806,
    armor: 0x1a1210,
    bow: false,
    helm: false,
    cape: true,
    foe: true,
    eye: 0xff4d2e,
    eyeEmissive: 0xff4d2e,
  };
  const rig = makeKnight(opts);

  // Massive irregular ash-beast body - more layers
  rig.bob.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.geometry instanceof THREE.BoxGeometry || o.geometry instanceof THREE.CylinderGeometry)) {
      o.visible = false;
    }
  });

  // Multi-layered bulk body with crack glow
  for (let layer = 0; layer < 3; layer++) {
    const bulk = new THREE.Mesh(
      new THREE.SphereGeometry(0.92 - layer * 0.08, 14, 10),
      std(0x1c1410 - layer * 0x050505, 0.75, 0.15),
    );
    bulk.scale.set(1.15 + layer * 0.05, 0.95 - layer * 0.03, 1.05);
    bulk.position.y = 0.82 + layer * 0.06;
    bulk.material.emissive.setHex(0xe85d04);
    bulk.material.emissiveIntensity = 0.35 - layer * 0.08;
    rig.bob.add(bulk);
  }

  // Massive jagged shoulder pads
  for (const sx of [-1, 1]) {
    const shoulderMat = std(0x1c1410, 0.75, 0.15);
    shoulderMat.emissive.setHex(0xe85d04);
    shoulderMat.emissiveIntensity = 0.5;
    
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.18), shoulderMat);
    shoulder.position.set(sx * 0.3, 1.0, 0.08);
    shoulder.rotation.z = sx * 0.15;
    rig.bob.add(shoulder);
    
    // Extra spikes on shoulders
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.18, 5),
        std(0x0c0806, 0.5, 0.5),
      );
      spike.position.set(sx * (0.28 + i * 0.06), 1.12, 0.05);
      spike.rotation.z = sx * 0.3;
      rig.bob.add(spike);
    }
  }

  // Massive asymmetric horns
  for (let si = 0; si < 2; si++) {
    const sx = si === 0 ? -1 : 1;
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 - si * 0.015, 0.65 + si * 0.1, 6),
      std(0x0c0806, 0.4, 0.6),
    );
    horn.position.set(sx * (0.22 + si * 0.04), 0.52, -0.04);
    horn.rotation.z = sx * (0.6 + si * 0.15);
    rig.head.add(horn);
  }
  
  // Extra crown spikes
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI - Math.PI * 0.5;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.25, 4),
      std(0x0c0806, 0.5, 0.5),
    );
    spike.position.set(Math.cos(angle) * 0.18, 0.55 + Math.sin(angle) * 0.05, -0.08);
    spike.rotation.z = Math.sin(angle) * 0.4;
    rig.head.add(spike);
  }
  
  addSpikes(rig.bob, 12, 0x1a100c, 1.4);
  addTentacles(rig.bob, 8, 0x1c1410);
  addBones(rig.bob);

  // Oversized glowing greatsword with lava cracks
  rig.weapon.scale.set(1.5, 1.8, 1.3);
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.emissive.setHex(0xff7a32);
    blade.material.emissiveIntensity = 1.0;
    
    // Lava cracks on blade
    for (let i = 0; i < 6; i++) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.12 + hash(i + 200) * 0.08, 0.01),
        new THREE.MeshStandardMaterial({
          color: 0xff4d2e,
          emissive: 0xff4d2e,
          emissiveIntensity: 1.2,
        }),
      );
      crack.position.set(
        (hash(i + 210) - 0.5) * 0.15,
        -0.3 + i * 0.12,
        0.06,
      );
      crack.rotation.z = (hash(i + 220) - 0.5) * 0.3;
      blade.add(crack);
    }
  }

  // Phase 2 glow: enhanced eyes and chest emission
  rig.eyeMat.emissiveIntensity = 1.4;
  
  // Chest glow indicator (visible in phase 2)
  const chestGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff4d2e,
      emissive: 0xff4d2e,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.7,
    }),
  );
  chestGlow.position.set(0, 0.88, 0.28);
  chestGlow.name = "chestGlow";
  rig.bob.add(chestGlow);
  
  // Extra glow points on body
  for (let i = 0; i < 8; i++) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 4),
      new THREE.MeshStandardMaterial({
        color: 0xff4d2e,
        emissive: 0xff4d2e,
        emissiveIntensity: 0.8,
      }),
    );
    glow.position.set(
      (hash(i + 300) - 0.5) * 0.4,
      0.5 + hash(i + 310) * 0.5,
      0.2 + hash(i + 320) * 0.1,
    );
    rig.bob.add(glow);
  }

  rig.root.scale.set(1.75, 2.15, 1.75);
  return rig;
}

export function makeDemon(): KnightRig {
  const opts: KnightOpts = {
    fur: 0x1a080c,
    armor: 0x2a1018,
    bow: false,
    helm: false,
    cape: false,
    foe: true,
    eye: 0xff2430,
    eyeEmissive: 0xff2430,
  };
  const rig = makeKnight(opts);

  // Slim, twisted demonic form
  rig.bob.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) {
      o.visible = false;
    }
  });
  
  rig.root.scale.setScalar(0.95); // Slightly smaller, more agile

  // Twisted body with red glow
  const bodyMat = std(0x2a0c12, 0.88, 0.06);
  bodyMat.emissive.setHex(0xff2430);
  bodyMat.emissiveIntensity = 0.35;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat);
  body.scale.set(0.75, 1.15, 0.75); // Taller, thinner
  body.position.y = 0.78;
  rig.bob.add(body);
  
  // Red glow cracks on body
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.12 + hash(i + 400) * 0.06, 0.01),
      new THREE.MeshStandardMaterial({
        color: 0xff2430,
        emissive: 0xff2430,
        emissiveIntensity: 0.9,
      }),
    );
    crack.position.set(
      (hash(i + 410) - 0.5) * 0.2,
      0.5 + hash(i + 420) * 0.4,
      0.18 + hash(i + 430) * 0.06,
    );
    crack.rotation.z = (hash(i + 440) - 0.5) * 0.6;
    rig.bob.add(crack);
  }

  // Curved menacing horns
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.48, 5),
      std(0x1a080c, 0.5, 0.25),
    );
    horn.position.set(sx * 0.14, 0.42, 0.02);
    horn.rotation.z = sx * -0.65;
    rig.head.add(horn);
    
    // Extra small horns
    const smallHorn = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.2, 4),
      std(0x0a0408, 0.6, 0.3),
    );
    smallHorn.position.set(sx * 0.2, 0.35, -0.02);
    smallHorn.rotation.z = sx * -0.4;
    rig.head.add(smallHorn);
  }

  // Large bat-like wings with membrane
  for (const sx of [-1, 1]) {
    // Main wing frame
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 1.05, 4, 5),
      std(0x2a0c12, 0.9, 0.03),
    );
    wing.position.set(sx * 0.45, 0.95, -0.12);
    wing.rotation.y = sx * 0.85;
    wing.rotation.z = sx * -0.32;
    wing.material.side = THREE.DoubleSide;
    wing.material.emissive.setHex(0xff2430);
    wing.material.emissiveIntensity = 0.18;
    rig.bob.add(wing);
    
    // Inner membrane
    const membrane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.8, 3, 4),
      new THREE.MeshStandardMaterial({
        color: 0x1a080c,
        roughness: 0.95,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    membrane.position.set(sx * 0.42, 0.92, -0.08);
    membrane.rotation.y = sx * 0.7;
    membrane.rotation.z = sx * -0.25;
    rig.bob.add(membrane);
    
    // Wing bones
    for (let i = 0; i < 4; i++) {
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.005, 0.55 + i * 0.08, 4),
        std(0x0a0408, 0.75, 0.1),
      );
      bone.position.set(
        sx * (0.28 + i * 0.14),
        0.82 + i * 0.14,
        -0.1,
      );
      bone.rotation.z = sx * (0.35 + i * 0.12);
      rig.bob.add(bone);
    }
  }

  // Sharp claws
  addClaws(rig.bob, -1);
  addClaws(rig.bob, 1);
  
  // Floating bone ornaments
  for (let i = 0; i < 5; i++) {
    const bone = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.012, 0.15, 3, 4),
      std(0x3a1a1c, 0.7, 0.08),
    );
    bone.position.set(
      (hash(i + 500) - 0.5) * 0.35,
      0.6 + hash(i + 510) * 0.5,
      (hash(i + 520) - 0.5) * 0.2,
    );
    bone.rotation.z = (hash(i + 530) - 0.5) * 0.8;
    rig.bob.add(bone);
  }

  // Curved glowing scythe blade
  const blade = rig.weapon.children.find((c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
  if (blade && blade instanceof THREE.Mesh && blade.material instanceof THREE.MeshStandardMaterial) {
    blade.material.color.setHex(0x6a1420);
    blade.material.emissive.setHex(0xff2430);
    blade.material.emissiveIntensity = 0.9;
    blade.scale.set(0.45, 0.85, 0.7);
    
    // Crescent shape enhancement
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.1, 4),
        new THREE.MeshStandardMaterial({
          color: 0xff2430,
          emissive: 0xff2430,
          emissiveIntensity: 1.0,
        }),
      );
      shard.position.set(0.04, -0.15 + i * 0.08, 0.05);
      shard.rotation.z = 0.3;
      blade.add(shard);
    }
  }

  rig.root.scale.setScalar(1.05);
  return rig;
}

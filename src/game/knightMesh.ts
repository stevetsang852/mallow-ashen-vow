import * as THREE from "three";

export type KnightOpts = {
  fur: number;
  armor: number;
  bow: boolean;
  helm: boolean;
  cape: boolean;
  eye: number;
  eyeEmissive?: number;
};

export type KnightRig = {
  root: THREE.Group;
  bob: THREE.Group;
  head: THREE.Group;
  weapon: THREE.Group;
  cape: THREE.Object3D;
  legL: THREE.Group;
  legR: THREE.Group;
  tail: THREE.Group;
  armorMat: THREE.MeshStandardMaterial;
  furMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshStandardMaterial;
};

function std(color: number, rough: number, metal: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
  });
}

export function makeKnight(opts: KnightOpts): KnightRig {
  const root = new THREE.Group();
  const bob = new THREE.Group();
  root.add(bob);

  const furMat = std(opts.fur, 0.86, 0.02);
  const armorMat = std(opts.armor, 0.32, 0.88);
  const darkArmor = std(opts.armor, 0.46, 0.72);
  darkArmor.color.multiplyScalar(0.62);
  const leather = std(0x6b4630, 0.72, 0.12);
  const gold = std(0xc6a15b, 0.38, 0.78);
  const capeMat = std(0xe4d3bc, 0.94, 0);
  const bowMat = std(0xe7a0b0, 0.52, 0.04);
  const eyeMat = std(opts.eye, 0.28, 0.04);
  if (opts.eyeEmissive) {
    eyeMat.emissive.setHex(opts.eyeEmissive);
    eyeMat.emissiveIntensity = 0.85;
  }
  const steel = std(0xd9dee6, 0.2, 0.94);
  const noseMat = std(0xf0b6aa, 0.55, 0);
  const innerMat = std(0xf0c2b0, 0.7, 0);
  const catchMat = std(0xf7f4ee, 0.18, 0);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.13, 0.46, 0);
  legR.position.set(0.13, 0.46, 0);
  const thighGeo = new THREE.CapsuleGeometry(0.085, 0.14, 3, 6);
  const bootGeo = new THREE.BoxGeometry(0.16, 0.12, 0.22);
  const greaveGeo = new THREE.BoxGeometry(0.13, 0.16, 0.12);
  const addLeg = (g: THREE.Group) => {
    const thigh = new THREE.Mesh(thighGeo, furMat);
    thigh.position.y = -0.1;
    const greave = new THREE.Mesh(greaveGeo, armorMat);
    greave.position.y = -0.2;
    const boot = new THREE.Mesh(bootGeo, armorMat);
    boot.position.y = -0.32;
    g.add(thigh, greave, boot);
  };
  addLeg(legL);
  addLeg(legR);
  bob.add(legL, legR);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 0.24, 9, 1, true),
    armorMat,
  );
  skirt.position.y = 0.52;
  bob.add(skirt);

  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 5, 10), darkArmor);
  chain.rotation.x = Math.PI / 2;
  chain.position.y = 0.42;
  bob.add(chain);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), furMat);
  torso.scale.set(1.08, 0.92, 0.84);
  torso.position.y = 0.8;
  bob.add(torso);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.26), armorMat);
  plate.position.set(0, 0.84, 0.08);
  bob.add(plate);

  const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.025), gold);
  emblem.position.set(0, 0.86, 0.22);
  bob.add(emblem);

  const pGeo = new THREE.SphereGeometry(0.12, 10, 8);
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(pGeo, armorMat);
    pad.scale.set(1.35, 0.65, 1.05);
    pad.position.set(sx * 0.3, 1.02, 0.02);
    bob.add(pad);
  }

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.32), leather);
  belt.position.set(0, 0.64, 0.04);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), gold);
  buckle.position.set(0.1, 0.64, 0.21);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.04), leather);
  strap.position.set(0.02, 0.7, 0.2);
  strap.rotation.z = -0.55;
  bob.add(belt, buckle, strap);

  const head = new THREE.Group();
  head.position.y = 1.24;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 14), furMat);
  skull.scale.set(1.06, 0.96, 0.98);
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), furMat);
  muzzle.position.set(0, -0.06, 0.2);
  muzzle.scale.set(1.05, 0.72, 0.9);
  head.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), noseMat);
  nose.position.set(0, -0.04, 0.3);
  head.add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.055, 10, 8);
  const catchGeo = new THREE.SphereGeometry(0.016, 6, 4);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * 0.1, 0.03, 0.22);
    const catchL = new THREE.Mesh(catchGeo, catchMat);
    catchL.position.set(sx * 0.116, 0.048, 0.262);
    head.add(eye, catchL);
  }

  const earGeo = new THREE.ConeGeometry(0.085, 0.2, 7);
  const innerGeo = new THREE.ConeGeometry(0.04, 0.11, 6);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(sx * 0.15, 0.22, -0.02);
    ear.rotation.z = sx * -0.5;
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(sx * 0.15, 0.2, 0.02);
    inner.rotation.z = sx * -0.5;
    head.add(ear, inner);
  }

  if (opts.bow) {
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), bowMat);
    knot.position.set(0.18, 0.14, 0.04);
    const loopGeo = new THREE.TorusGeometry(0.042, 0.012, 5, 8);
    const l1 = new THREE.Mesh(loopGeo, bowMat);
    const l2 = new THREE.Mesh(loopGeo, bowMat);
    l1.position.set(0.2, 0.2, 0.05);
    l2.position.set(0.2, 0.09, 0.05);
    l1.rotation.y = 0.7;
    l2.rotation.y = -0.4;
    head.add(knot, l1, l2);
  }

  if (opts.helm) {
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      darkArmor,
    );
    helm.position.y = 0.02;
    head.add(helm);
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), darkArmor);
      horn.position.set(sx * 0.16, 0.28, 0);
      horn.rotation.z = sx * -0.45;
      head.add(horn);
    }
  }
  bob.add(head);

  const tail = new THREE.Group();
  tail.position.set(0, 0.58, -0.26);
  const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 3, 5), furMat);
  tailMesh.rotation.x = Math.PI / 2.5;
  tailMesh.position.set(0, 0, -0.12);
  tail.add(tailMesh);
  bob.add(tail);

  let cape: THREE.Object3D = new THREE.Group();
  if (opts.cape) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.95, 5, 5), capeMat);
    cloth.position.set(0, 0.95, -0.2);
    cloth.rotation.x = 0.3;
    bob.add(cloth);
    cape = cloth;
  }

  const weapon = new THREE.Group();
  weapon.position.set(0, 0.9, 0.32);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.2, 7), leather);
  grip.position.y = 0.02;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.05), gold);
  guard.position.y = 0.13;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.12, 0.012), steel);
  blade.position.y = 0.7;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.16, 4), steel);
  tip.position.y = 1.32;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), gold);
  pommel.position.y = -0.1;
  const handGeo = new THREE.SphereGeometry(0.065, 8, 6);
  const h1 = new THREE.Mesh(handGeo, armorMat);
  const h2 = new THREE.Mesh(handGeo, armorMat);
  h1.position.set(-0.06, 0.02, 0);
  h2.position.set(0.055, -0.01, 0.01);
  weapon.add(grip, guard, blade, tip, pommel, h1, h2);
  bob.add(weapon);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  return { root, bob, head, weapon, cape, legL, legR, tail, armorMat, furMat, eyeMat };
}

export function poseKnight(
  rig: KnightRig,
  t: number,
  moving: number,
  act: string,
  actT: number,
) {
  const step = Math.sin(t * 9) * moving;
  rig.legL.rotation.x = step * 0.75;
  rig.legR.rotation.x = -step * 0.75;
  rig.bob.position.y = Math.abs(step) * 0.04 + Math.sin(t * 2.1) * 0.012;
  rig.bob.rotation.x = 0;
  rig.bob.rotation.z = Math.sin(t * 9) * 0.04 * moving;
  rig.head.rotation.x = moving * 0.06;
  rig.head.rotation.z = Math.sin(t * 1.7) * 0.04;
  rig.head.rotation.y = 0;
  rig.tail.rotation.y = Math.sin(t * 2.6) * 0.3;
  rig.tail.rotation.x = moving * 0.25;

  if (rig.cape instanceof THREE.Mesh) {
    rig.cape.rotation.x = 0.3 + Math.sin(t * 1.6) * 0.05 + moving * 0.28;
    rig.cape.rotation.z = Math.sin(t * 1.2) * 0.06;
  }

  let wx = -0.18;
  let wz = 0;
  if (act === "attack") {
    const u = Math.min(1, actT / 0.52);
    const swing = u < 0.28 ? u / 0.28 : Math.max(0, 1 - (u - 0.28) / 0.72);
    wx = -0.25 - swing * 1.65;
    rig.bob.rotation.x = swing * 0.4;
    wz = Math.sin(swing * Math.PI) * 0.12;
  } else if (act === "dodge") {
    const u = Math.min(1, actT / 0.48);
    rig.bob.rotation.x = Math.sin(u * Math.PI) * 1.25;
    rig.bob.position.y += Math.sin(u * Math.PI) * 0.1;
    rig.bob.rotation.z = 0;
    wx = -1.15;
  } else if (act === "hurt") {
    rig.bob.rotation.x = -0.28;
    rig.head.rotation.x = -0.35;
    wx = -0.55;
  } else if (act === "drink") {
    wx = -0.45;
    wz = 0.9;
    rig.head.rotation.x = 0.25;
    rig.head.rotation.y = -0.3;
  }

  rig.weapon.rotation.x = wx;
  rig.weapon.rotation.z = wz;
  rig.weapon.rotation.y = 0;
}

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

function smooth01(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

export type PoseHint = {
  state?: string;
  move?: string;
  u?: number;
  boss?: boolean;
  phase2?: boolean;
};

type Springs = {
  wx: number;
  wz: number;
  wy: number;
  bx: number;
  by: number;
  bz: number;
  hy: number;
  hx: number;
  hz: number;
  capeX: number;
  capeZ: number;
  lx: number;
  rx: number;
  tx: number;
  ty: number;
  bobY: number;
  prev: number;
};

function springsOf(rig: KnightRig): Springs {
  const bag = rig.root.userData as { springs?: Springs };
  if (!bag.springs) {
    bag.springs = {
      wx: 0,
      wz: 0,
      wy: 0,
      bx: 0,
      by: 0,
      bz: 0,
      hy: 0,
      hx: 0,
      hz: 0,
      capeX: 0,
      capeZ: 0,
      lx: 0,
      rx: 0,
      tx: 0,
      ty: 0,
      bobY: 0,
      prev: -1,
    };
  }
  return bag.springs;
}

function lag(cur: number, target: number, rate: number, dt: number) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}

function combatPose(hint: PoseHint) {
  const u = hint.u ?? 0;
  const k = smooth01(Math.min(1, u));
  const snap = Math.pow(k, hint.move === "overhead" ? 2.1 : 1.25);
  const move = hint.move ?? "cleave";
  if (hint.state === "roar") {
    const s = Math.sin(Math.min(1, u) * Math.PI);
    return { wx: -0.15 - s * 0.55, wz: 0, wy: 0, bx: -0.4 * s, by: 0, bz: 0, bobY: s * 0.06 };
  }
  if (hint.state === "telegraph") {
    if (move === "overhead") return { wx: -0.15 + k * 1.25, wz: 0, wy: 0, bx: -0.5 * k, by: 0, bz: 0, bobY: 0.04 * k };
    if (move === "shock") return { wx: 0.15 + k * 0.35, wz: 0, wy: 0, bx: 0.2 * k, by: 0, bz: 0, bobY: -0.16 * k };
    if (move === "rush") return { wx: -0.1 - 0.75 * k, wz: 0.15 * k, wy: 0, bx: 0.48 * k, by: 0, bz: 0, bobY: -0.04 * k };
    return { wx: -0.3, wz: -1.2 * k, wy: -0.35 * k, bx: -0.06 * k, by: -0.5 * k, bz: 0.14 * k, bobY: 0 };
  }
  if (hint.state === "swing") {
    if (move === "overhead") return { wx: 1.1 + (-2.15 - 1.1) * snap, wz: 0, wy: 0, bx: -0.5 + 0.85 * snap, by: 0, bz: 0, bobY: 0.04 * (1 - snap) };
    if (move === "shock") return { wx: 0.5 - 1.55 * snap, wz: 0, wy: 0, bx: 0.2 + 0.4 * snap, by: 0, bz: 0, bobY: -0.16 * (1 - snap) };
    if (move === "rush") return { wx: -0.9, wz: 0.1, wy: 0, bx: 0.5, by: 0, bz: 0, bobY: -0.02 };
    return { wx: -1.75, wz: -1.2 + 2.25 * snap, wy: -0.35 + 0.85 * snap, bx: 0.08 * snap, by: -0.5 + 0.75 * snap, bz: 0.14 * (1 - snap), bobY: 0 };
  }
  if (hint.state === "recover") {
    const hold = smooth01(Math.min(1, u));
    return { wx: -1.15 * (1 - hold), wz: 0.15 * (1 - hold), wy: 0, bx: 0.22 * (1 - hold), by: 0, bz: 0, bobY: -0.05 * (1 - hold) };
  }
  return null;
}

export function poseKnight(
  rig: KnightRig,
  t: number,
  moving: number,
  act: string,
  actT: number,
  hint?: PoseHint,
) {
  const baked = rig.root.userData.baked === true;
  const s = springsOf(rig);
  let dt = s.prev < 0 ? 1 / 60 : Math.min(0.05, t - s.prev);
  if (!(dt > 0)) dt = 1 / 60;
  s.prev = t;

  const ph = t * (7.2 + moving * 1.4);
  const skew = Math.sin(ph + 0.35 * Math.sin(ph));
  const breathe = Math.sin(t * 2.15);

  if (rig.legL.userData.baseY == null) rig.legL.userData.baseY = rig.legL.position.y;
  if (rig.legR.userData.baseY == null) rig.legR.userData.baseY = rig.legR.position.y;

  let wx = baked ? 0 : -0.18;
  let wz = 0;
  let wy = 0;
  let bx = 0;
  let by = 0;
  let bz = skew * 0.07 * moving;
  let bobY = Math.abs(skew) * 0.045 * moving + breathe * 0.014;
  let hx = moving * 0.05 + breathe * 0.03;
  let hy = Math.sin(t * 0.8) * 0.07 * (1 - moving * 0.4);
  let hz = -skew * 0.06 * moving + Math.sin(t * 1.5) * 0.035;
  let lx = skew * 0.95 * moving;
  let rx = -skew * 0.95 * moving;
  let tx = moving * 0.2 + Math.sin(t * 2.4) * 0.18;
  let ty = Math.sin(t * 2.1 + 0.6) * 0.45;
  const capeBase = typeof rig.cape.userData.baseX === "number" ? rig.cape.userData.baseX : 0.3;
  let capeX = capeBase + Math.sin(t * 1.5) * 0.05 + moving * (baked ? 0.16 : 0.3);
  let capeZ = Math.sin(t * 1.15 + 0.4) * (0.05 + moving * 0.08);

  const fight = hint ? combatPose(hint) : null;
  let weaponRate = moving > 0 ? 14 : 10;
  if (fight) {
    wx = fight.wx;
    wz = fight.wz;
    wy = fight.wy;
    bx = fight.bx;
    by = fight.by;
    bz = fight.bz;
    bobY += fight.bobY;
    weaponRate = hint?.state === "swing" ? 26 : 9;
    if (hint?.move === "overhead" && hint.state === "telegraph") weaponRate = 7;
  } else if (act === "attack") {
    const wind = 0.16;
    const hit = 0.3;
    const end = 0.52;
    if (actT < wind) {
      const k = smooth01(actT / wind);
      wx = (baked ? 0.5 : 0.35) * k;
      bx = -0.22 * k;
      wz = -0.22 * k;
      by = -0.28 * k;
    } else if (actT < hit) {
      const k = Math.pow(smooth01((actT - wind) / (hit - wind)), 1.7);
      wx = (baked ? 0.5 : 0.35) + ((baked ? -1.7 : -1.9) - (baked ? 0.5 : 0.35)) * k;
      bx = -0.22 + 0.58 * k;
      wz = -0.22 + 0.5 * k;
      by = -0.28 + 0.45 * k;
      weaponRate = 32;
    } else {
      const k = smooth01((actT - hit) / (end - hit));
      wx = (baked ? -1.7 : -1.9) * (1 - k) + (baked ? -0.15 : -0.18) * k;
      bx = 0.36 * (1 - k);
      wz = 0.28 * (1 - k);
      by = 0.17 * (1 - k);
      weaponRate = 12;
    }
    hx += 0.08;
  } else if (act === "dodge") {
    const u = Math.min(1, actT / 0.46);
    const roll = Math.sin(u * Math.PI);
    const tuck = smooth01(Math.min(1, u / 0.35));
    bx = 0.22 * roll;
    bz = 1.05 * roll;
    bobY += 0.12 * roll;
    wx = (baked ? -0.55 : -0.8) * tuck;
    hx = 0.25 * roll;
    lx *= 0.2;
    rx *= 0.2;
    weaponRate = 16;
  } else if (act === "hurt") {
    const k = 1 - Math.exp(-actT * 14);
    bx = -0.32 * k;
    hx = -0.4 * k;
    wx = (baked ? -0.4 : -0.6) * k;
    bz = 0.12 * k;
    weaponRate = 18;
  } else if (act === "drink") {
    const k = smooth01(Math.min(1, actT / 0.28));
    wx = (baked ? -0.25 : -0.45) * k;
    wz = (baked ? 0.4 : 0.9) * k;
    hx = 0.28 * k;
    hy = -0.35 * k;
  } else if (moving > 0) {
    wx += -skew * (baked ? 0.38 : 0.22);
    by += skew * 0.06;
  }

  s.wx = lag(s.wx, wx, weaponRate, dt);
  s.wz = lag(s.wz, wz, weaponRate, dt);
  s.wy = lag(s.wy, wy, weaponRate * 0.8, dt);
  s.bx = lag(s.bx, bx, 12, dt);
  s.by = lag(s.by, by, 12, dt);
  s.bz = lag(s.bz, bz, 12, dt);
  s.hx = lag(s.hx, hx, 10, dt);
  s.hy = lag(s.hy, hy, 8, dt);
  s.hz = lag(s.hz, hz, 8, dt);
  s.lx = lag(s.lx, lx, 16, dt);
  s.rx = lag(s.rx, rx, 16, dt);
  s.tx = lag(s.tx, tx, 6, dt);
  s.ty = lag(s.ty, ty, 5, dt);
  s.capeX = lag(s.capeX, capeX, 4.5, dt);
  s.capeZ = lag(s.capeZ, capeZ, 4.5, dt);
  s.bobY = lag(s.bobY, bobY, 10, dt);

  rig.bob.rotation.x = s.bx;
  rig.bob.rotation.y = s.by;
  rig.bob.rotation.z = s.bz;
  rig.bob.position.y = s.bobY;
  rig.head.rotation.x = s.hx;
  rig.head.rotation.y = s.hy;
  rig.head.rotation.z = s.hz;
  rig.weapon.rotation.x = s.wx;
  rig.weapon.rotation.z = s.wz;
  rig.weapon.rotation.y = s.wy;
  rig.legL.rotation.x = s.lx;
  rig.legR.rotation.x = s.rx;
  const lift = Math.max(0, skew) * 0.05 * moving;
  rig.legL.position.y = (rig.legL.userData.baseY as number) + (skew > 0 ? lift : 0);
  rig.legR.position.y = (rig.legR.userData.baseY as number) + (skew < 0 ? lift : 0);
  rig.tail.rotation.x = s.tx;
  rig.tail.rotation.y = s.ty;
  if (rig.cape) {
    rig.cape.rotation.x = s.capeX;
    rig.cape.rotation.z = s.capeZ;
  }
}

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
  for (const sx of [-1, 1]) {
    const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), darkArmor);
    tasset.position.set(sx * 0.16, 0.46, 0.08);
    tasset.rotation.z = sx * 0.18;
    const vam = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 6), armorMat);
    vam.position.set(sx * 0.22, 0.78, 0.16);
    vam.rotation.z = sx * 0.4;
    bob.add(tasset, vam);
  }

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
    const wrap = new THREE.Group();
    wrap.position.set(0, 1.05, -0.16);
    wrap.userData.baseX = 0.28;
    for (const sx of [-1, 1]) {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.05, 3, 5), capeMat);
      cloth.position.set(sx * 0.2, -0.15, sx * 0.02);
      cloth.rotation.y = sx * 0.18;
      cloth.rotation.z = sx * -0.08;
      wrap.add(cloth);
    }
    bob.add(wrap);
    cape = wrap;
  }

  const weapon = new THREE.Group();
  weapon.position.set(0, 0.9, 0.32);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.22, 7), leather);
  grip.position.y = 0.02;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.05), gold);
  guard.position.y = 0.14;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.048, 1.48, 0.012), steel);
  blade.position.y = 0.9;
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.12, 0.014), darkArmor);
  fuller.position.y = 0.92;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.2, 4), steel);
  tip.position.y = 1.72;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), gold);
  pommel.position.y = -0.12;
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.08), armorMat);
  const thumb = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 5), armorMat);
  thumb.position.set(0.07, 0.02, 0.02);
  thumb.rotation.z = -1.1;
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.05), armorMat);
  fingers.position.set(0, -0.02, 0.03);
  hand.add(palm, thumb, fingers);
  hand.position.set(0.01, 0.02, 0);
  weapon.add(grip, guard, blade, fuller, tip, pommel, hand);
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
  vwx: number;
  vwz: number;
  vwy: number;
  vbx: number;
  vby: number;
  vbz: number;
  vhx: number;
  vhy: number;
  vhz: number;
  vcapeX: number;
  vcapeZ: number;
  vlx: number;
  vrx: number;
  vtx: number;
  vty: number;
  vbob: number;
};

function springsOf(rig: KnightRig): Springs {
  const bag = rig.root.userData as { springs?: Springs };
  if (!bag.springs || bag.springs.vwx == null) {
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
      vwx: 0,
      vwz: 0,
      vwy: 0,
      vbx: 0,
      vby: 0,
      vbz: 0,
      vhx: 0,
      vhy: 0,
      vhz: 0,
      vcapeX: 0,
      vcapeZ: 0,
      vlx: 0,
      vrx: 0,
      vtx: 0,
      vty: 0,
      vbob: 0,
    };
  }
  return bag.springs;
}

function spring(
  pos: number,
  vel: number,
  target: number,
  k: number,
  damp: number,
  dt: number,
): [number, number] {
  vel = (vel + (target - pos) * k * dt) * Math.exp(-damp * dt);
  return [pos + vel * dt, vel];
}

function easeInCubic(t: number) {
  return t * t * t;
}

function seg(actT: number, a: number, b: number) {
  return Math.max(0, Math.min(1, (actT - a) / Math.max(0.0001, b - a)));
}

function combatPose(hint: PoseHint) {
  const u = Math.max(0, Math.min(1, hint.u ?? 0));
  const move = hint.move ?? "cleave";
  if (hint.state === "roar") {
    const s = Math.sin(u * Math.PI);
    return { wx: -0.2 - s * 0.7, wz: s * 0.35, wy: 0, bx: -0.55 * s, by: 0, bz: 0.08 * s, bobY: s * 0.08 };
  }
  if (hint.state === "telegraph") {
    const k = Math.pow(smooth01(u), 0.65);
    if (move === "overhead") return { wx: -0.2 + k * 1.7, wz: 0.15 * k, wy: 0, bx: -0.7 * k, by: 0, bz: 0, bobY: 0.05 * k };
    if (move === "shock") return { wx: 0.2 + k * 0.4, wz: 0, wy: 0, bx: 0.35 * k, by: 0, bz: 0, bobY: -0.2 * k };
    if (move === "rush") return { wx: -0.15 - 0.9 * k, wz: 0.2 * k, wy: 0, bx: 0.7 * k, by: 0, bz: 0, bobY: -0.06 * k };
    return { wx: 0.15 * k, wz: 1.35 * k, wy: 0.2 * k, bx: -0.28 * k, by: -0.65 * k, bz: 0.12 * k, bobY: -0.02 * k };
  }
  if (hint.state === "swing") {
    const strike = Math.min(1, Math.pow(Math.min(1, u / 0.58), 0.42));
    if (move === "overhead") return { wx: 1.5 + (-2.5 - 1.5) * strike, wz: 0.1, wy: 0, bx: -0.7 + 1.15 * strike, by: 0, bz: 0, bobY: 0.05 * (1 - strike) };
    if (move === "shock") return { wx: 0.55 - 1.7 * strike, wz: 0, wy: 0, bx: 0.3 + 0.45 * strike, by: 0, bz: 0, bobY: -0.18 * (1 - strike) };
    if (move === "rush") return { wx: -1.05, wz: 0.15, wy: 0, bx: 0.72, by: 0, bz: 0, bobY: -0.03 };
    return { wx: 0.15 - 0.45 * strike, wz: 1.35 + (-2.55 - 1.35) * strike, wy: 0.2 - 0.55 * strike, bx: -0.28 + 0.55 * strike, by: -0.65 + 1.15 * strike, bz: 0.12 * (1 - strike), bobY: 0 };
  }
  if (hint.state === "recover") {
    const hold = Math.pow(smooth01(u), 0.8);
    return { wx: -0.35 * (1 - hold), wz: -1.7 * (1 - hold), wy: -0.15 * (1 - hold), bx: 0.28 * (1 - hold), by: 0.4 * (1 - hold), bz: 0, bobY: -0.06 * (1 - hold) };
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

  const step = t * (5.2 + moving * 4.8);
  const skew = Math.sin(step);
  const pass = Math.cos(step);
  const breathe = Math.sin(t * 1.7);
  const stride = Math.min(1, moving * 1.35);

  if (rig.legL.userData.baseY == null) rig.legL.userData.baseY = rig.legL.position.y;
  if (rig.legR.userData.baseY == null) rig.legR.userData.baseY = rig.legR.position.y;

  let wx = (baked ? 0.05 : -0.12) - skew * 0.42 * stride;
  let wz = skew * 0.28 * stride;
  let wy = pass * 0.06 * stride;
  let bx = Math.abs(pass) * 0.07 * stride + breathe * 0.02;
  let by = -skew * 0.1 * stride;
  let bz = skew * 0.14 * stride;
  let bobY = Math.pow(Math.abs(pass), 1.15) * 0.055 * stride + breathe * 0.012;
  let hx = -bx * 0.45 + breathe * 0.04;
  let hy = Math.sin(t * 0.65) * 0.09 * (1 - stride * 0.5);
  let hz = -bz * 0.35;
  let lx = skew * 1.15 * stride;
  let rx = -skew * 1.15 * stride;
  let tx = -skew * 0.35 * stride + Math.sin(t * 2.2) * 0.22;
  let ty = Math.sin(t * 1.8 + 0.6) * 0.7 + skew * 0.25 * stride;
  const capeBase = typeof rig.cape.userData.baseX === "number" ? rig.cape.userData.baseX : 0.3;
  let capeX = capeBase + Math.sin(t * 1.3) * 0.06 + stride * 0.34 - bx * 0.4;
  let capeZ = Math.sin(t * 1.05 + 0.4) * 0.08 - bz * 0.5;

  const fight = hint ? combatPose(hint) : null;
  let weaponK = fight ? (hint?.state === "swing" ? 260 : 70) : 90;
  let weaponDamp = fight && hint?.state === "telegraph" ? 11 : 7.5;
  if (fight) {
    wx = fight.wx;
    wz = fight.wz;
    wy = fight.wy;
    bx = fight.bx;
    by = fight.by;
    bz = fight.bz;
    bobY += fight.bobY;
    lx *= 0.25;
    rx *= 0.25;
    if (hint?.move === "overhead" && hint.state === "telegraph") weaponK = 42;
  } else if (act === "attack") {
    const wind = seg(actT, 0, 0.12);
    const hit = seg(actT, 0.12, 0.26);
    const back = seg(actT, 0.26, 0.5);
    if (actT < 0.12) {
      const k = easeInCubic(wind);
      wz = 1.05 * k;
      wy = 0.42 * k;
      wx = 0.18 * k;
      bx = -0.22 * k;
      by = -0.48 * k;
      bz = 0.08 * k;
      hx = 0.08 * k;
      weaponK = 48;
      weaponDamp = 11;
    } else if (actT < 0.26) {
      const k = Math.pow(hit, 0.35);
      wz = 1.05 + (-2.15 - 1.05) * k;
      wy = 0.42 - 1.05 * k;
      wx = 0.18 - 0.55 * k;
      bx = -0.22 + 0.48 * k;
      by = -0.48 + 0.92 * k;
      bz = 0.08 - 0.16 * k;
      hx = 0.08 + 0.16 * k;
      weaponK = 280;
      weaponDamp = 10;
    } else {
      const k = smooth01(back);
      const settle = 1 - Math.pow(1 - k, 1.6);
      wz = -2.15 * (1 - settle) + -0.22 * settle;
      wy = -0.63 * (1 - settle);
      wx = -0.37 * (1 - settle);
      bx = 0.26 * (1 - settle);
      by = 0.44 * (1 - settle);
      hx = 0.18 * (1 - settle);
      weaponK = 62;
      weaponDamp = 8;
    }
    lx = 0.22 * (actT < 0.26 ? 1 : 1 - smooth01(back));
    rx = -0.12;
    capeX += 0.18 + (actT > 0.12 && actT < 0.3 ? 0.16 : 0);
  } else if (act === "heavy") {
    const wind = seg(actT, 0, 0.3);
    const hit = seg(actT, 0.3, 0.48);
    const back = seg(actT, 0.48, 0.78);
    if (actT < 0.3) {
      const k = Math.pow(smooth01(wind), 0.85);
      wx = 1.85 * k;
      wz = 0.35 * k;
      wy = -0.12 * k;
      bx = -0.62 * k;
      by = -0.08 * k;
      bz = -0.1 * k;
      bobY -= 0.04 * k;
      weaponK = 34;
      weaponDamp = 12;
    } else if (actT < 0.48) {
      const k = Math.pow(hit, 0.32);
      wx = 1.85 + (-2.35 - 1.85) * k;
      wz = 0.35 - 0.55 * k;
      bx = -0.62 + 1.05 * k;
      by = -0.08 + 0.35 * k;
      bz = -0.1 + 0.22 * k;
      bobY -= 0.04 * (1 - k);
      weaponK = 300;
      weaponDamp = 9;
    } else {
      const k = smooth01(back);
      const settle = 1 - Math.pow(1 - k, 1.8);
      wx = -2.35 * (1 - settle);
      wz = -0.2 * (1 - settle);
      bx = 0.43 * (1 - settle);
      by = 0.27 * (1 - settle);
      weaponK = 58;
      weaponDamp = 7.5;
    }
    lx = 0.28;
    rx = 0.08;
    capeX += 0.28;
  } else if (act === "block") {
    wx = baked ? 0.25 : 0.1;
    wz = baked ? -0.95 : -1.2;
    bx = -0.06 + breathe * 0.03;
    by = -0.08;
    lx *= 0.3;
    rx *= 0.3;
    weaponK = 140;
  } else if (act === "dodge") {
    const u = Math.min(1, actT / 0.46);
    const roll = Math.sin(Math.min(1, u / 0.62) * Math.PI);
    bx = 1.05 * roll;
    bz = 0.18 * roll;
    bobY = -0.07 * roll;
    wx = -1.15 * roll;
    wz = 0.45 * roll;
    hx = 0.35 * roll;
    lx = 0.55 * roll;
    rx = -0.25 * roll;
    capeX += 0.45 * roll;
    weaponK = 160;
  } else if (act === "hurt") {
    const k = 1 - Math.exp(-actT * 10);
    bx = -0.48 * k;
    hx = -0.55 * k;
    wx = -0.7 * k;
    wz = 0.4 * k;
    bz = 0.16 * k;
    capeX += 0.3 * k;
    weaponK = 120;
  } else if (act === "drink") {
    const k = smooth01(Math.min(1, actT / 0.32));
    wx = -0.55 * k;
    wz = 0.85 * k;
    hx = 0.32 * k;
    hy = -0.4 * k;
    weaponK = 80;
  }

  [s.wx, s.vwx] = spring(s.wx, s.vwx, wx, weaponK, weaponDamp, dt);
  [s.wz, s.vwz] = spring(s.wz, s.vwz, wz, weaponK, weaponDamp, dt);
  [s.wy, s.vwy] = spring(s.wy, s.vwy, wy, weaponK * 0.85, weaponDamp, dt);
  [s.bx, s.vbx] = spring(s.bx, s.vbx, bx, 150, 12, dt);
  [s.by, s.vby] = spring(s.by, s.vby, by, 140, 12, dt);
  [s.bz, s.vbz] = spring(s.bz, s.vbz, bz, 140, 12, dt);
  [s.hx, s.vhx] = spring(s.hx, s.vhx, hx, 90, 10, dt);
  [s.hy, s.vhy] = spring(s.hy, s.vhy, hy, 70, 9, dt);
  [s.hz, s.vhz] = spring(s.hz, s.vhz, hz, 70, 9, dt);
  [s.lx, s.vlx] = spring(s.lx, s.vlx, lx, 200, 16, dt);
  [s.rx, s.vrx] = spring(s.rx, s.vrx, rx, 200, 16, dt);
  [s.tx, s.vtx] = spring(s.tx, s.vtx, tx, 36, 5.5, dt);
  [s.ty, s.vty] = spring(s.ty, s.vty, ty, 28, 4.5, dt);
  [s.capeX, s.vcapeX] = spring(s.capeX, s.vcapeX, capeX, 28, 4.2, dt);
  [s.capeZ, s.vcapeZ] = spring(s.capeZ, s.vcapeZ, capeZ, 28, 4.2, dt);
  [s.bobY, s.vbob] = spring(s.bobY, s.vbob, bobY, 120, 11, dt);

  rig.bob.rotation.x = s.bx;
  rig.bob.rotation.y = s.by;
  rig.bob.rotation.z = s.bz;
  rig.bob.position.y = s.bobY;
  const squash = act === "dodge" ? 1 - Math.sin(Math.min(1, actT / 0.46) * Math.PI) * 0.16 : 1;
  rig.bob.scale.set(1 + (1 - squash) * 0.35, squash, 1 + (1 - squash) * 0.2);
  rig.head.rotation.x = s.hx;
  rig.head.rotation.y = s.hy;
  rig.head.rotation.z = s.hz;
  rig.weapon.rotation.x = s.wx;
  rig.weapon.rotation.z = s.wz;
  rig.weapon.rotation.y = s.wy;
  rig.legL.rotation.x = s.lx;
  rig.legR.rotation.x = s.rx;
  const lift = Math.pow(Math.max(0, skew), 1.15) * 0.07 * stride;
  const liftR = Math.pow(Math.max(0, -skew), 1.15) * 0.07 * stride;
  rig.legL.position.y = (rig.legL.userData.baseY as number) + lift;
  rig.legR.position.y = (rig.legR.userData.baseY as number) + liftR;
  rig.tail.rotation.x = s.tx;
  rig.tail.rotation.y = s.ty;
  if (rig.cape) {
    rig.cape.rotation.x = s.capeX;
    rig.cape.rotation.z = s.capeZ;
  }
}

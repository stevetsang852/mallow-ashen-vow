/** Particle systems for Mallow: combat sparks + ambient ember/mote. */

import * as THREE from "three";
import { FIRE, hash } from "@/game/moves";

/** Hit VFX hierarchy multipliers (count / size / life). Does not change moves.ts damage. */
export const HIT_SPARK_MUL = {
  light: 1,
  heavy: 1.6,
  "stance-break": 2.2,
} as const;

export const SPARK_BASE_SIZE = 0.11;
export const SPARK_BASE_COUNT = 12;
export const SPARKS = 96;

/** Bonfire ember Points count (buffer size). */
export const EMBER_COUNT = 28;
/**
 * Legacy update loop bound — only this many embers are animated each frame
 * (was hardcoded `i < 18` while EMBER_COUNT grew to 28). Preserve exactly.
 */
export const EMBER_UPDATE_COUNT = 18;

export const MOTES = 96;
export const EMBER_COLOR = 0xe85d04;
export const EMBER_SIZE = 0.065;
export const MOTE_SIZE = 0.07;
export const MOTE_OPACITY = 0.55;

export type SparkKind = "steel" | "pink" | "ash" | "dust" | "demon";

const SPARK_RGB: Record<SparkKind, [number, number, number]> = {
  steel: [0.96, 0.88, 0.72],
  pink: [1, 0.48, 0.68],
  ash: [1, 0.52, 0.18],
  dust: [0.78, 0.7, 0.6],
  demon: [1, 0.22, 0.24],
};

export type FireAnchor = { x: number; z: number };

export type GameParticlesOptions = {
  /** Bonfire anchor for rising embers (default: moves.FIRE). */
  fire?: FireAnchor;
};

export type GameParticles = {
  /** Combat spark Points — caller adds to scene. */
  points: THREE.Points;
  /** Bonfire ember Points. */
  embers: THREE.Points;
  /** Atmospheric mote Points. */
  motes: THREE.Points;
  burst: (
    x: number,
    y: number,
    z: number,
    power?: number,
    dx?: number,
    dz?: number,
    kind?: SparkKind,
    hierarchyMul?: number,
  ) => void;
  /** Ring of dust sparks for shockwave; dustRing mesh stays in createGame. */
  ringDust: (x: number, z: number) => void;
  /** Advance spark pool one fixed step (legacy 0.016). */
  update: () => void;
  /**
   * Advance ember + mote ambience from scene clock `time`.
   * Optional breathAmp (~0.12) pulses ember size on title/menu (P1-H).
   * Optional quietScale (default 1) slows ember rise + mote drift (win-phase P2-K; ~0.55–0.7).
   * Combat spark `update()` is untouched.
   */
  updateAmbient: (time: number, breathAmp?: number, quietScale?: number) => void;
  dispose: () => void;
};

export function createParticles(opts: GameParticlesOptions = {}): GameParticles {
  const fire = opts.fire ?? FIRE;

  // --- combat sparks ---
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkCol = new Float32Array(SPARKS * 3);
  sparkPos.fill(-20);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const points = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      size: SPARK_BASE_SIZE,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  let sparkCursor = 0;

  // --- bonfire embers ---
  const emberPos = new Float32Array(EMBER_COUNT * 3);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    color: EMBER_COLOR,
    size: EMBER_SIZE,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const embers = new THREE.Points(emberGeo, emberMat);

  // --- atmospheric motes ---
  const motePos = new Float32Array(MOTES * 3);
  const moteCol = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = -10 + hash(i) * 20;
    motePos[i * 3 + 1] = 0.3 + hash(i + 3) * 3.4;
    motePos[i * 3 + 2] = -16 + hash(i + 7) * 22;
    moteSeed[i] = hash(i + 11) * Math.PI * 2;
    const warm = hash(i + 13) > 0.45;
    moteCol[i * 3] = warm ? 1 : 0.78;
    moteCol[i * 3 + 1] = warm ? 0.62 : 0.7;
    moteCol[i * 3 + 2] = warm ? 0.28 : 0.62;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute("color", new THREE.BufferAttribute(moteCol, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      size: MOTE_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: MOTE_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  function burst(
    x: number,
    y: number,
    z: number,
    power = 1,
    dx = 0,
    dz = 0,
    kind: SparkKind = "steel",
    hierarchyMul = 1,
  ) {
    const mul = Math.max(0.5, hierarchyMul);
    // Preserve legacy power>1.3 → ~20 particles when no hit hierarchy is set.
    const n = Math.min(
      SPARKS,
      Math.round(SPARK_BASE_COUNT * mul * (power > 1.3 && mul <= 1 ? 1.65 : 1)),
    );
    const rgb = SPARK_RGB[kind];
    for (let i = 0; i < n; i++) {
      const k = sparkCursor % SPARKS;
      sparkCursor++;
      sparkPos[k * 3] = x + (hash(k + 3) - 0.5) * 0.2;
      sparkPos[k * 3 + 1] = y;
      sparkPos[k * 3 + 2] = z + (hash(k + 7) - 0.5) * 0.2;
      const spread = (hash(k + sparkCursor) - 0.5) * 3.2 * (0.85 + 0.15 * mul);
      const lift = kind === "dust" ? 0.35 : kind === "ash" ? 2.2 : 1.4;
      sparkVel[k * 3] = dx * (2.4 + power) + spread;
      sparkVel[k * 3 + 1] = lift + hash(k + 5) * (kind === "dust" ? 1.2 : 3.2) * power;
      sparkVel[k * 3 + 2] = dz * (2.4 + power) + (hash(k + 9) - 0.5) * 3.2 * (0.85 + 0.15 * mul);
      sparkLife[k] = ((kind === "ash" ? 0.38 : 0.22) + hash(k) * 0.22) * mul;
      sparkCol[k * 3] = rgb[0];
      sparkCol[k * 3 + 1] = rgb[1];
      sparkCol[k * 3 + 2] = rgb[2];
    }
    const mat = points.material as THREE.PointsMaterial;
    mat.size = Math.max(mat.size, SPARK_BASE_SIZE * mul);
    sparkGeo.attributes.color!.needsUpdate = true;
  }

  function ringDust(x: number, z: number) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const k = sparkCursor % SPARKS;
      sparkCursor++;
      sparkPos[k * 3] = x + Math.cos(a) * 0.45;
      sparkPos[k * 3 + 1] = 0.12;
      sparkPos[k * 3 + 2] = z + Math.sin(a) * 0.45;
      sparkVel[k * 3] = Math.cos(a) * 3.4;
      sparkVel[k * 3 + 1] = 0.4 + hash(k) * 0.8;
      sparkVel[k * 3 + 2] = Math.sin(a) * 3.4;
      sparkLife[k] = 0.36;
      sparkCol[k * 3] = 0.78;
      sparkCol[k * 3 + 1] = 0.68;
      sparkCol[k * 3 + 2] = 0.52;
    }
    sparkGeo.attributes.color!.needsUpdate = true;
  }

  function update() {
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i]! <= 0) {
        sparkPos[i * 3 + 1] = -30;
        continue;
      }
      sparkLife[i] = (sparkLife[i] ?? 0) - 0.016;
      sparkPos[i * 3] = (sparkPos[i * 3] ?? 0) + (sparkVel[i * 3] ?? 0) * 0.016;
      sparkPos[i * 3 + 1] = (sparkPos[i * 3 + 1] ?? 0) + (sparkVel[i * 3 + 1] ?? 0) * 0.016;
      sparkPos[i * 3 + 2] = (sparkPos[i * 3 + 2] ?? 0) + (sparkVel[i * 3 + 2] ?? 0) * 0.016;
      sparkVel[i * 3 + 1] = (sparkVel[i * 3 + 1] ?? 0) - 6 * 0.016;
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    sparkGeo.attributes.color!.needsUpdate = true;
    {
      const mat = points.material as THREE.PointsMaterial;
      if (mat.size > SPARK_BASE_SIZE) {
        mat.size = Math.max(SPARK_BASE_SIZE, mat.size - 0.01);
      }
    }
  }

  // P2-K: accumulate ambient motion clock so quietScale slows drift without jumping.
  let ambientClock = 0;
  let lastAmbientWall = 0;
  let ambientClockReady = false;

  function updateAmbient(time: number, breathAmp = 0, quietScale = 1) {
    const q = Math.max(0.2, Math.min(1, quietScale));
    if (!ambientClockReady) {
      lastAmbientWall = time;
      ambientClockReady = true;
    }
    const dWall = Math.max(0, Math.min(0.1, time - lastAmbientWall));
    lastAmbientWall = time;
    ambientClock += dWall * q;
    const t = ambientClock;

    for (let i = 0; i < EMBER_UPDATE_COUNT; i++) {
      const y = (t * 0.33 + hash(i)) % 1;
      const ang = hash(i + 2) * Math.PI * 2;
      const rad = (0.08 + hash(i + 4) * 0.32) * (1 - y);
      emberPos[i * 3] = fire.x + Math.cos(ang) * rad;
      emberPos[i * 3 + 1] = 0.2 + y * 1.25;
      emberPos[i * 3 + 2] = fire.z + Math.sin(ang) * rad;
    }
    emberGeo.attributes.position!.needsUpdate = true;

    // P1-H / Research D: gentle ember breath (+10–15% size). Does not touch spark pool.
    // Breath uses wall `time` so title/menu pulse stays independent of quietScale.
    const amp = Math.max(0, Math.min(0.2, breathAmp));
    if (amp > 0) {
      const wave = 0.5 + 0.5 * Math.sin(time * 1.55);
      emberMat.size = EMBER_SIZE * (1 + amp * wave);
      emberMat.opacity = 0.88 + amp * wave;
    } else {
      emberMat.size = EMBER_SIZE;
      emberMat.opacity = 1;
    }

    for (let i = 0; i < MOTES; i++) {
      const drift = t * (0.12 + hash(i) * 0.08);
      motePos[i * 3] = -10 + ((hash(i) * 20 + Math.sin(drift + moteSeed[i]!) * 0.8) % 20);
      motePos[i * 3 + 1] = 0.25 + ((hash(i + 3) * 3.4 + drift * 0.35) % 3.6);
      motePos[i * 3 + 2] = -16 + ((hash(i + 7) * 22 + Math.cos(drift * 0.7) * 0.6) % 22);
    }
    moteGeo.attributes.position!.needsUpdate = true;
  }

  function dispose() {
    sparkGeo.dispose();
    (points.material as THREE.Material).dispose();
    emberGeo.dispose();
    (embers.material as THREE.Material).dispose();
    moteGeo.dispose();
    (motes.material as THREE.Material).dispose();
  }

  return { points, embers, motes, burst, ringDust, update, updateAmbient, dispose };
}

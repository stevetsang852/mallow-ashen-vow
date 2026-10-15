/** Combat spark Points pool for Mallow. Ambient embers/motes stay in createGame. */

import * as THREE from "three";
import { hash } from "@/game/moves";

/** Hit VFX hierarchy multipliers (count / size / life). Does not change moves.ts damage. */
export const HIT_SPARK_MUL = {
  light: 1,
  heavy: 1.6,
  "stance-break": 2.2,
} as const;

export const SPARK_BASE_SIZE = 0.11;
export const SPARK_BASE_COUNT = 12;
export const SPARKS = 96;

export type SparkKind = "steel" | "pink" | "ash" | "dust" | "demon";

const SPARK_RGB: Record<SparkKind, [number, number, number]> = {
  steel: [0.96, 0.88, 0.72],
  pink: [1, 0.48, 0.68],
  ash: [1, 0.52, 0.18],
  dust: [0.78, 0.7, 0.6],
  demon: [1, 0.22, 0.24],
};

export type GameParticles = {
  /** THREE.Points — caller adds to scene once. */
  points: THREE.Points;
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
  /** Advance pool one fixed step (legacy 0.016). */
  update: () => void;
  dispose: () => void;
};

export function createParticles(): GameParticles {
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

  function dispose() {
    sparkGeo.dispose();
    (points.material as THREE.Material).dispose();
  }

  return { points, burst, ringDust, update, dispose };
}

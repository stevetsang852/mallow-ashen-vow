import type * as THREE from "three";

export type CamState = {
  x: number;
  y: number;
  z: number;
  kick: number;
  push: number;
  roll: number;
  fovKick: number;
  dip: number;
};

export type CamInput = {
  dt: number;
  time: number;
  phase: string;
  yaw: number;
  dist: number;
  height: number;
  shake: number;
  playerX: number;
  playerZ: number;
  act: string;
  actT: number;
  heavy: boolean;
  lookX: number | null;
  lookZ: number | null;
};

export function stepCamera(cam: CamState, input: CamInput): CamState & {
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
  shakeX: number;
} {
  const titleDrift = input.phase === "title" ? Math.sin(input.time * 0.28) * 0.35 : 0;
  const yaw = input.yaw + titleDrift;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const shakeX = input.shake > 0 ? Math.sin(input.time * 78) * input.shake * 0.28 : 0;
  const sv = input.shake > 0 ? Math.cos(input.time * 61) * input.shake * 0.16 : 0;
  const swing = input.act === "attack" ? Math.sin(Math.min(1, input.actT / 0.36) * Math.PI) : 0;
  const punch = swing * (input.heavy ? 0.7 : 0.38);
  const kick = Math.max(0, cam.kick - input.dt * 2.8);
  const push = Math.max(0, cam.push - input.dt * 3.2);
  const dip = Math.max(0, cam.dip - input.dt * 2.4);
  const fovKick = Math.max(0, cam.fovKick - input.dt * 6);
  const roll = cam.roll * Math.exp(-input.dt * 9);
  const dist = Math.max(3.1, Math.min(8.4, input.dist - punch - kick + push));
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const locked = input.lookX != null && input.lookZ != null;
  const shoulder = locked ? 0.62 : 0;
  const goalX = input.playerX - fx * dist + rx * shoulder;
  const goalZ = input.playerZ - fz * dist + rz * shoulder;
  const goalY = input.height + (locked ? 0.28 : 0) + sv;
  const follow = 1 - Math.exp(-input.dt * (input.act === "attack" ? 16 : 7.5));
  const x = cam.x + (goalX - cam.x) * follow;
  const y = cam.y + (goalY - cam.y) * follow;
  const z = cam.z + (goalZ - cam.z) * follow;
  const lookX = locked ? input.playerX * 0.58 + input.lookX! * 0.42 : input.playerX;
  const lookZ = locked ? input.playerZ * 0.58 + input.lookZ! * 0.42 : input.playerZ;
  return {
    x,
    y,
    z,
    kick,
    push,
    roll,
    fovKick,
    dip,
    lookX,
    lookY: (locked ? 1.15 : 1.05) - dip,
    lookZ,
    fov: 42 - fovKick,
    shakeX,
  };
}

export function applyCamera(camera: THREE.PerspectiveCamera, next: ReturnType<typeof stepCamera>) {
  camera.position.set(next.x + next.shakeX, next.y, next.z);
  camera.lookAt(next.lookX, next.lookY, next.lookZ);
  camera.rotateZ(next.roll);
  if (Math.abs(camera.fov - next.fov) > 0.02) {
    camera.fov = next.fov;
    camera.updateProjectionMatrix();
  }
}

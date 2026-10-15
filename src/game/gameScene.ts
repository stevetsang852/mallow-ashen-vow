/**
 * Scene setup — extracted from createGame.ts.
 * Handles Three.js scene, camera, lighting, and environment meshes.
 */
import * as THREE from "three";

export function createScene(): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  // Lighting
  hemi: THREE.HemisphereLight;
  moon: THREE.DirectionalLight;
  bonfireLight: THREE.PointLight;
  ambientLight: THREE.AmbientLight;
  rim: THREE.DirectionalLight;
  keyLight: THREE.PointLight;
} {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(renderer.domElement);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xf0d7b8, 0x2c241e, 1.25);
  const moon = new THREE.DirectionalLight(0xd5e0ee, 1.45);
  moon.position.set(5, 10, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -15;
  moon.shadow.camera.right = 15;
  moon.shadow.camera.top = 15;
  moon.shadow.camera.bottom = -15;
  scene.add(hemi, moon);

  const bonfireLight = new THREE.PointLight(0xff7a32, 22, 11, 2);
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  const rim = new THREE.DirectionalLight(0xffc9a0, 0.7);
  const keyLight = new THREE.PointLight(0xffe2c4, 10, 10, 2);

  return {
    scene,
    camera,
    renderer,
    hemi,
    moon,
    bonfireLight,
    ambientLight,
    rim,
    keyLight,
  };
}

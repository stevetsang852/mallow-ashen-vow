import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "fs";

// Low-poly pixel style chibi ashen knight (cute + dark contrast)
const group = new THREE.Group();

function std(color, rough = 0.8, metal = 0.25) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    flatShading: true,
    envMapIntensity: 0.15,
  });
}

// Blocky body plates
const bodyMat = std(0x3a2a22);
for (let i = 0; i < 3; i++) {
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.52 - i * 0.06, 0.16, 0.46 - i * 0.04),
    bodyMat,
  );
  plate.position.y = 0.32 + i * 0.18;
  group.add(plate);
}

// Oversized blocky helm
const helmMat = std(0x2a1a14, 0.75, 0.3);
const helm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.44), helmMat);
helm.position.y = 1.12;
group.add(helm);

// Ember glowing cracks
const emberMat = new THREE.MeshStandardMaterial({
  color: 0xe85d04,
  emissive: 0xe85d04,
  emissiveIntensity: 1.1,
  flatShading: true,
  roughness: 0.4,
});
for (let i = 0; i < 2; i++) {
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.015), emberMat);
  crack.position.set((i - 0.5) * 0.28, 1.15, 0.23);
  group.add(crack);
}

// Cute pink bow accent (identity)
const bowMat = std(0xe7a0b0, 0.6, 0.1);
const bow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), bowMat);
bow.position.set(0.18, 1.28, 0.1);
group.add(bow);

// Simple weapon (oversized sword)
const swordMat = std(0x9aa3b2, 0.4, 0.6);
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.02), swordMat);
blade.position.set(0.35, 0.75, 0);
group.add(blade);

// Center and scale for game
group.position.y = -0.2;
group.scale.setScalar(1.1);

const exporter = new GLTFExporter();
exporter.parse(
  group,
  (result) => {
    const buffer = result instanceof ArrayBuffer ? Buffer.from(result) : Buffer.from(JSON.stringify(result));
    fs.writeFileSync("public/models/lowpoly-pixel-knight.glb", buffer);
    console.log("Exported public/models/lowpoly-pixel-knight.glb");
  },
  (err) => console.error("Export error:", err),
  { binary: true },
);

import assert from "node:assert/strict";
import * as THREE from "three";
import { describe, it } from "node:test";
import { applyPixelLook } from "./pixelLook";

describe("applyPixelLook", () => {
  it("forces flat shading and nearest maps", () => {
    const root = new THREE.Group();
    const map = new THREE.Texture();
    map.magFilter = THREE.LinearFilter;
    const mat = new THREE.MeshStandardMaterial({ map });
    mat.flatShading = false;
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    applyPixelLook(root);
    assert.equal(mat.flatShading, true);
    assert.equal(map.magFilter, THREE.NearestFilter);
    assert.equal(map.minFilter, THREE.NearestFilter);
    assert.equal(map.generateMipmaps, false);
  });
});

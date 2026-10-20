import * as THREE from "three";

/** Low-poly pixel 3D look: flat facets + nearest maps. Safe on procedural and GLB. */
export function applyPixelLook(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if ("flatShading" in m) (m as THREE.MeshStandardMaterial).flatShading = true;
      const tex = "map" in m ? (m as THREE.MeshStandardMaterial).map : null;
      if (tex) {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
      }
      m.needsUpdate = true;
    }
  });
}

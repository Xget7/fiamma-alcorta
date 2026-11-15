import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Batch only within an independently moving assembly. Every source triangle,
// normal and UV survives. Glass stays separate for correct transparent sorting.
export function batchHouse(parts) {
  let before = 0, after = 0;
  for (const { group } of parts) {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map();
    group.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material) || object.material.transparent) return;
      const attributes = Object.keys(object.geometry.attributes).sort().join(',');
      const key = `${object.material.uuid}/${object.castShadow}/${object.receiveShadow}/${object.renderOrder}/${attributes}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    });
    for (const meshes of buckets.values()) {
      before += meshes.length;
      if (meshes.length < 2) { after += meshes.length; continue; }
      const geometries = meshes.map(mesh => {
        const clone = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        clone.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
        return clone;
      });
      const geometry = mergeGeometries(geometries, false);
      for (const item of geometries) item.dispose();
      if (!geometry) { after += meshes.length; continue; }
      const source = meshes[0];
      const batch = new THREE.Mesh(geometry, source.material);
      batch.name = `${group.name} · ${source.material.uuid.slice(0, 8)}`;
      batch.castShadow = source.castShadow;
      batch.receiveShadow = source.receiveShadow;
      batch.renderOrder = source.renderOrder;
      // Edges may be children of a box. Preserve them in assembly coordinates.
      for (const mesh of meshes) {
        for (const child of [...mesh.children]) group.attach(child);
        mesh.removeFromParent();
      }
      for (const old of new Set(meshes.map(mesh => mesh.geometry))) old.dispose();
      group.add(batch);
      after++;
    }
  }
  return { before, after };
}

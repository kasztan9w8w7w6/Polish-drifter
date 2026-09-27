import * as THREE from 'three';

// Objects between the camera and the car turn see-through (diorama view: blocks, garages, lamps).
// Each frame a few rays go from the camera to the car; meshes of registered occluders that they hit
// get a transparent copy of their material until the car is visible again.
export const occlusionSettings = { opacity: 0.3 };

export function createOcclusion() {
  const roots = [];
  const ray = new THREE.Raycaster();
  const faded = new Set();
  const now = new Set();
  const target = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const viewDir = new THREE.Vector3();
  const OFFSETS = [new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(2, 0.5, 0), new THREE.Vector3(-2, 0.5, 0)];

  function fadeMaterial(mesh) {
    if (!mesh.userData.fadeMat) {
      const src = mesh.material;
      const make = (m) => {
        const f = m.clone();
        f.transparent = true;
        f.depthWrite = false;
        f.opacity = occlusionSettings.opacity;
        f.userData = { ...m.userData, fade: true };
        return f;
      };
      mesh.userData.solidMat = src;
      mesh.userData.fadeMat = Array.isArray(src) ? src.map(make) : make(src);
    }
    return mesh.userData.fadeMat;
  }

  return {
    add(obj) {
      roots.push(obj);
    },
    update(camera, carPosition, carQuaternion) {
      now.clear();
      camera.getWorldPosition(eye);
      camera.getWorldDirection(viewDir);
      for (const o of OFFSETS) {
        target.copy(o).applyQuaternion(carQuaternion).add(carPosition);
        // Line of sight: from the eye for a perspective camera, parallel to the view axis for an ortho one
        if (camera.isOrthographicCamera) origin.copy(target).addScaledVector(viewDir, -150);
        else origin.copy(eye);
        dir.copy(target).sub(origin);
        const dist = dir.length();
        ray.set(origin, dir.normalize());
        ray.far = dist - 0.5;
        for (const hit of ray.intersectObjects(roots, true)) if (hit.object.isMesh) now.add(hit.object);
      }
      for (const m of now) {
        if (!faded.has(m)) {
          m.material = fadeMaterial(m);
          faded.add(m);
        }
      }
      for (const m of faded) {
        if (!now.has(m)) {
          m.material = m.userData.solidMat;
          faded.delete(m);
        }
      }
    },
    applySettings() {
      for (const m of faded) for (const f of [].concat(m.material)) f.opacity = occlusionSettings.opacity;
      // Materials made later pick the value up in fadeMaterial()
      for (const r of roots) r.traverse((o) => o.userData.fadeMat && [].concat(o.userData.fadeMat).forEach((f) => (f.opacity = occlusionSettings.opacity)));
    },
  };
}

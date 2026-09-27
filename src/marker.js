import * as THREE from 'three';

// Mission target markers: a light beam standing on the target (seen through the fog from afar) with a ring on the
// ground, and a small arrow hovering over the car that points at the target.
export function createMarkers(scene) {
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 12, 1, true), beamMat);
  beam.position.y = 20;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.35, 32), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  const target = new THREE.Group();
  target.add(beam, ring);
  target.visible = false;

  const shape = new THREE.Shape();
  shape.moveTo(0, 1.1);
  shape.lineTo(0.7, -0.5);
  shape.lineTo(0, -0.15);
  shape.lineTo(-0.7, -0.5);
  shape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(shape);
  arrowGeo.rotateX(-Math.PI / 2); // lying flat, pointing along −Z
  const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
  arrow.renderOrder = 998;
  arrow.visible = false;
  scene.add(target, arrow);

  return {
    // point: { x, z, r } or null; carPos: Vector3
    update(time, point, carPos) {
      target.visible = arrow.visible = !!point;
      if (!point) return;
      target.position.set(point.x, 0, point.z);
      ring.scale.setScalar((point.r ?? 3) * (1 + 0.08 * Math.sin(time * 4)));
      beamMat.opacity = 0.25 + 0.1 * Math.sin(time * 3);
      const dx = point.x - carPos.x, dz = point.z - carPos.z;
      const dist = Math.hypot(dx, dz);
      arrow.visible = dist > (point.r ?? 3) + 6;
      arrow.position.set(carPos.x, carPos.y + 2.6 + 0.15 * Math.sin(time * 5), carPos.z);
      arrow.rotation.y = Math.atan2(-dx, -dz); // local −Z towards the target
      return dist;
    },
  };
}

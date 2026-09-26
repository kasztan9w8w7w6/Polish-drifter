import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Live-tunable parameters (exposed in lil-gui).
export const tuning = {
  engineForce: 2600,
  brakeForce: 80,
  maxSteer: 0.6,
  steerSpeed: 4, // rad/s the wheels turn towards the target
  frontGrip: 3.2,
  rearGrip: 2.2,
  handbrakeGrip: 0.7,
  handbrakeForce: 40,
};

// cannon-es RaycastVehicle defaults: forward = +X, up = +Y, right(axle) = +Z.
const WHEELS = [
  { x: 1.3, z: 0.85, front: true },
  { x: 1.3, z: -0.85, front: true },
  { x: -1.3, z: 0.85, front: false },
  { x: -1.3, z: -0.85, front: false },
];
const WHEEL_RADIUS = 0.36;

export function createCar(scene, world, material) {
  const chassisBody = new CANNON.Body({ mass: 1100, material });
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(2.1, 0.35, 0.9)), new CANNON.Vec3(0, 0.1, 0));
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1.1, 0.3, 0.8)), new CANNON.Vec3(-0.3, 0.7, 0));
  chassisBody.angularDamping = 0.4;

  const vehicle = new CANNON.RaycastVehicle({ chassisBody });
  for (const w of WHEELS) {
    vehicle.addWheel({
      radius: WHEEL_RADIUS,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      axleLocal: new CANNON.Vec3(0, 0, 1),
      chassisConnectionPointLocal: new CANNON.Vec3(w.x, -0.05, w.z),
      suspensionStiffness: 35,
      suspensionRestLength: 0.35,
      maxSuspensionTravel: 0.3,
      maxSuspensionForce: 1e5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      frictionSlip: w.front ? tuning.frontGrip : tuning.rearGrip,
      rollInfluence: 0.02,
      useCustomSlidingRotationalSpeed: true,
      customSlidingRotationalSpeed: -30,
    });
  }
  vehicle.addToWorld(world);

  const chassisMesh = buildChassisMesh();
  scene.add(chassisMesh);
  const wheelMeshes = vehicle.wheelInfos.map(() => {
    const m = buildWheelMesh();
    scene.add(m);
    return m;
  });

  const spawn = { position: new CANNON.Vec3(0, 1.5, 0), quaternion: new CANNON.Quaternion() };
  let steer = 0;

  function reset() {
    chassisBody.position.copy(spawn.position);
    chassisBody.quaternion.copy(spawn.quaternion);
    chassisBody.velocity.setZero();
    chassisBody.angularVelocity.setZero();
  }
  reset();

  function applyInput(input, dt) {
    // Speed along the car's forward axis decides whether S brakes or reverses.
    const fwd = chassisBody.quaternion.vmult(new CANNON.Vec3(1, 0, 0));
    const fwdSpeed = fwd.dot(chassisBody.velocity);

    let engine = 0;
    let brake = 0;
    if (input.throttle) engine = tuning.engineForce;
    if (input.brake) {
      if (fwdSpeed > 1) brake = tuning.brakeForce;
      else engine = -tuning.engineForce * 0.5;
    }

    const target = (input.steer || 0) * tuning.maxSteer;
    steer += THREE.MathUtils.clamp(target - steer, -tuning.steerSpeed * dt, tuning.steerSpeed * dt);

    for (let i = 0; i < 4; i++) {
      const front = WHEELS[i].front;
      vehicle.setSteeringValue(front ? steer : 0, i);
      vehicle.applyEngineForce(front ? 0 : engine, i); // RWD, obviously
      vehicle.setBrake(brake + (!front && input.handbrake ? tuning.handbrakeForce : 0), i);
      vehicle.wheelInfos[i].frictionSlip = front
        ? tuning.frontGrip
        : input.handbrake ? tuning.handbrakeGrip : tuning.rearGrip;
    }
  }

  function sync() {
    chassisMesh.position.copy(chassisBody.position);
    chassisMesh.quaternion.copy(chassisBody.quaternion);
    for (let i = 0; i < 4; i++) {
      // updateWheelTransform() clears isInContact as a side effect; keep the value from the last step
      const contact = vehicle.wheelInfos[i].isInContact;
      vehicle.updateWheelTransform(i);
      vehicle.wheelInfos[i].isInContact = contact;
      const t = vehicle.wheelInfos[i].worldTransform;
      wheelMeshes[i].position.copy(t.position);
      wheelMeshes[i].quaternion.copy(t.quaternion);
    }
  }

  return { vehicle, chassisBody, chassisMesh, wheelMeshes, applyInput, sync, reset, isRear: (i) => !WHEELS[i].front };
}

// Boxy 80s Polish sedan silhouette built from primitives (placeholder for a GLTF model).
function buildChassisMesh() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xc8102e, metalness: 0.4, roughness: 0.35 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.3, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.9, roughness: 0.1 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1100, emissiveIntensity: 2 });

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(4.2, 0.35, 1.8), white, 0, -0.05, 0); // lower half white
  add(new THREE.BoxGeometry(4.2, 0.35, 1.8), paint, 0, 0.3, 0); // upper half red
  add(new THREE.BoxGeometry(2.2, 0.55, 1.6), paint, -0.3, 0.72, 0);
  add(new THREE.BoxGeometry(2.25, 0.4, 1.62), glass, -0.3, 0.72, 0);
  for (const z of [0.6, -0.6]) {
    add(new THREE.BoxGeometry(0.05, 0.18, 0.4), lamp, 2.11, 0.25, z);
    add(new THREE.BoxGeometry(0.05, 0.16, 0.45), tail, -2.11, 0.3, z);
  }
  return g;
}

function buildWheelMesh() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 20),
    new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  );
  tyre.rotation.x = Math.PI / 2; // cylinder axis Y -> axle Z
  tyre.castShadow = true;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 }),
  );
  rim.rotation.x = Math.PI / 2;
  g.add(tyre, rim);
  return g;
}

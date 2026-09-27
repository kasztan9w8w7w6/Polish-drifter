import RAPIER from '@dimforge/rapier3d-compat';

// Thin wrapper over Rapier: the rest of the game talks to this module and to vehicle.js,
// never to Rapier directly, so the physics library can be swapped again if needed.
export const FIXED_DT = 1 / 60;

// What the car does when it hits a static obstacle (vehicle.ts): `rebound` = fraction of the impact speed it
// bounces back with, `scrape` = how much speed along the surface a glancing hit takes away (× how head-on it was).
// Obstacles are in their own collision group: the car's sphere rolls past them, its body box hits them (vehicle.ts).
export const OBSTACLE_GROUP = 0x0004;
const OBSTACLE_GROUPS = (OBSTACLE_GROUP << 16) | 0xffff;

export const SURFACES = {
  concrete: { rebound: 0.12, scrape: 0.5 }, // walls, blocks, garages, pavilions
  metal: { rebound: 0.15, scrape: 0.4 }, // lamp posts, poles, signs, dumpsters, fences
  car: { rebound: 0.22, scrape: 0.35 }, // parked cars
  tyres: { rebound: 0.35, scrape: 0.25 }, // tyre stacks, plastic road-works barriers
  tree: { rebound: 0.08, scrape: 0.6 },
};

let ready = null;
export function initPhysics() {
  ready ??= RAPIER.init();
  return ready;
}

export function createPhysics() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  const events = new RAPIER.EventQueue(true);
  let accumulator = 0;
  const surfaces = new Map(); // collider handle → SURFACES key (static obstacles)

  function makeBody(desc, colliderDesc, pos, rot) {
    desc.setTranslation(pos.x, pos.y, pos.z);
    if (rot) desc.setRotation(rot);
    const body = world.createRigidBody(desc);
    world.createCollider(colliderDesc, body);
    return {
      body,
      position: () => body.translation(),
      quaternion: () => body.rotation(),
    };
  }

  return {
    RAPIER,
    world,
    events,
    surfaces,

    // Fixed-step loop; beforeStep(h) runs before every sub-step, afterStep(h) after it.
    step(dt, beforeStep, afterStep, maxSubSteps = 5) {
      accumulator = Math.min(accumulator + dt, FIXED_DT * maxSubSteps);
      while (accumulator >= FIXED_DT) {
        beforeStep?.(FIXED_DT);
        world.step(events);
        afterStep?.(FIXED_DT);
        accumulator -= FIXED_DT;
      }
    },

    // Static box, `half` = half extents, optional `rotation` quaternion {x,y,z,w}. With `surface` (SURFACES key)
    // it is an obstacle, sized as it looks: the car's body box hits it. Without: ground, ramps. Returns the handle.
    addStaticBox(pos, half, { friction = 0.5, restitution = 0.1, rotation, surface } = {}) {
      const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(pos.x, pos.y, pos.z)
        .setFriction(friction)
        .setRestitution(restitution);
      if (rotation) desc.setRotation(rotation);
      if (surface) desc.setCollisionGroups(OBSTACLE_GROUPS);
      const c = world.createCollider(desc);
      if (surface) surfaces.set(c.handle, surface);
      return c.handle;
    },

    // Static vertical cylinder standing on `pos` (pos.y = bottom), always an obstacle.
    addStaticCylinder(pos, radius, height, { surface = 'metal' } = {}) {
      const c = world.createCollider(
        RAPIER.ColliderDesc.cylinder(height / 2, radius).setTranslation(pos.x, pos.y + height / 2, pos.z).setCollisionGroups(OBSTACLE_GROUPS),
      );
      surfaces.set(c.handle, surface);
      return c.handle;
    },

    // Dynamic cone standing on `pos` (pos.y = bottom) – traffic cones.
    addDynamicCone(pos, radius, height, mass) {
      return makeBody(
        RAPIER.RigidBodyDesc.dynamic().setCanSleep(true),
        RAPIER.ColliderDesc.cone(height / 2, radius).setTranslation(0, height / 2, 0).setMass(mass).setFriction(0.6),
        pos,
      );
    },

    // Line segments of all colliders for a debug overlay (Rapier's built-in debug renderer).
    debugLines() {
      return world.debugRender(); // { vertices: Float32Array (xyz), colors: Float32Array (rgba) }
    },
  };
}

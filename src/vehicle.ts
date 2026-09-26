import { Quaternion, Vector3, MathUtils } from 'three';
import type { createPhysics } from './physics.js';
import { tuning as globalTuning, type Tuning } from './tuning.ts';

// Arcade car ported from Kenney's Starter Kit Racing (scripts/vehicle.gd, MIT):
// the physics body is ONE rolling sphere, driven by adding spin around the axis perpendicular to the
// direction of travel. The visible car is a separate transform that follows the sphere, turns with the
// steering and tilts to the ground normal found by a raycast. Nothing here can roll over.
//
// Our addition on top (no tyre model): the car keeps two yaw angles – `travel` (where the sphere is pushed)
// and `heading` (where the body points). In grip they are equal; in a drift heading = travel + angle,
// where the angle chases a target set by steering/throttle/handbrake and is clamped to driftAngleMax.

type Physics = ReturnType<typeof createPhysics>;
export type Controls = { throttle: number; brake: number; steer: number; handbrake: number }; // steer + = left

export const BALL_RADIUS = 1; // m – bigger than Kenney's 0.5 because our car is a real-size 4.3 m sedan
const RIDE_HEIGHT = 0.72; // model origin above the ground
const WHEEL_RADIUS = 0.3;
const WHEELS = [
  { x: 1.25, z: -0.72, front: true },
  { x: 1.25, z: 0.72, front: true },
  { x: -1.25, z: -0.72, front: false },
  { x: -1.25, z: 0.72, front: false },
];
const CHASSIS_HALF = { x: 2.15, y: 0.45, z: 0.84 };
// Collision groups: (membership << 16) | filter. The sphere and the kinematic chassis box ignore each other.
const GROUP_BALL = (0x0001 << 16) | 0xfffd;
const GROUP_CHASSIS = (0x0002 << 16) | 0xfffd;

const Y = new Vector3(0, 1, 0);
const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

export function createVehicle(
  physics: Physics,
  { tuning = globalTuning, spawn = { x: 0, y: BALL_RADIUS, z: 0 }, spawnYaw = 0 }: { tuning?: Tuning; spawn?: { x: number; y: number; z: number }; spawnYaw?: number } = {},
) {
  const { RAPIER, world } = physics;
  const t = tuning;

  // Physics sphere (Kenney: RigidBody3D, SphereShape3D, friction 5 "rough", CCD on)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true));
  const ball = world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setFriction(5)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(0.1)
      .setCollisionGroups(GROUP_BALL)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1000),
    body,
  );
  // Kinematic box that follows the visible car, so the body (not just the sphere) knocks cones over
  const chassis = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(CHASSIS_HALF.x, CHASSIS_HALF.y, CHASSIS_HALF.z).setTranslation(0, 0.1, 0).setCollisionGroups(GROUP_CHASSIS),
    chassis,
  );

  function applyParams() {
    ball.setMass(t.mass);
    body.setGravityScale(t.gravityScale, true);
    body.setAngularDamping(t.angularDamping);
    body.setLinearDamping(t.linearDamping);
  }
  applyParams();

  // Control state
  let engine = 0; // Kenney's `linear_speed`: throttle smoothed towards the input
  let travel = spawnYaw; // yaw of the drive direction
  let angle = 0; // heading − travel (rad), + = nose left of the line (left drift)
  let turnRate = 0; // smoothed yaw rate of `travel`
  let drifting = false;
  let driftSide = 0; // +1 left drift, −1 right drift
  let driftBlend = 0;
  let sharpTimer = 0;
  let noThrottleTimer = 0;
  let grounded = false;
  let impact = 0;
  let prevForwardSpeed = 0;
  let accel = 0;
  let wheelSpin = 0;
  let lastInput: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };

  const modelQ = new Quaternion();
  const normal = new Vector3(0, 1, 0);
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const tmpV = new Vector3();
  const tmpQ = new Quaternion();
  const yawQ = new Quaternion();
  const alignQ = new Quaternion();

  const state = {
    position: new Vector3(), // model origin (body centre, 0.72 m above the ground)
    quaternion: new Quaternion(), // heading + ground tilt (no visual lean)
    velocity: new Vector3(),
    speed: 0,
    forwardSpeed: 0,
    slipAngle: 0, // degrees, measured between the nose and the real velocity; + = velocity left of the nose
    driftAngle: 0, // degrees, the commanded heading − travel
    yawRate: 0,
    drifting: false,
    driftFactor: 0,
    steerAngle: 0, // visual front-wheel angle (rad)
    bodyRoll: 0, // visual lean (rad), + = leaning right
    bodyPitch: 0, // visual pitch (rad), + = nose up
    grounded: false,
    impact: 0,
    wheels: WHEELS.map((w) => ({
      rear: !w.front,
      contact: false,
      sliding: false,
      point: new Vector3(),
      position: new Vector3(),
      quaternion: new Quaternion(),
    })),
  };

  function castGround(p: { x: number; y: number; z: number }) {
    ray.origin = { x: p.x, y: p.y, z: p.z };
    const hit = world.castRayAndGetNormal(ray, BALL_RADIUS + 0.4, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
    if (hit) normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    return !!hit;
  }

  function update(input: Controls, h: number) {
    const p = body.translation();
    const v = body.linvel();
    const speed = Math.hypot(v.x, v.z);
    const heading = travel + angle;
    const fwdX = Math.cos(heading), fwdZ = -Math.sin(heading);
    const forwardSpeed = v.x * fwdX + v.z * fwdZ;
    grounded = castGround(p);

    // Kenney only reads input while the ray touches the ground
    const inp = grounded ? input : { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    lastInput = inp;
    const steer = inp.steer || 0;
    const throttle = inp.throttle;

    // --- Drift state machine ---
    const moving = forwardSpeed > 0;
    sharpTimer = Math.abs(steer) > t.sharpSteer && throttle > 0.5 && speed > t.sharpSpeed ? sharpTimer + h : 0;
    noThrottleTimer = throttle < 0.2 && inp.handbrake < 0.5 ? noThrottleTimer + h : 0;
    if (!drifting && moving && speed > t.driftMinSpeed && ((inp.handbrake > 0.5 && Math.abs(steer) > 0.3) || sharpTimer > 0.15)) {
      drifting = true;
      driftSide = Math.sign(steer);
    } else if (drifting && (!moving || speed < t.driftMinSpeed * 0.6 || noThrottleTimer > t.driftExitDelay)) {
      drifting = false;
    }
    let into = steer * driftSide; // +1 = steering into the drift, −1 = full counter-steer
    if (drifting && -into > t.transitionSteer) {
      driftSide = -driftSide; // strong counter-steer throws the car to the other side
      into = -into;
    }
    driftBlend = approach(driftBlend, drifting ? 1 : 0, drifting ? t.driftAngleRate : t.straightenRate, h);

    // --- Drift angle: the body turns away from the line of travel ---
    const target = drifting
      ? driftSide * MathUtils.clamp(t.driftAngleBase + into * t.driftAngleSteer + throttle * t.driftAngleThrottle + inp.handbrake * t.driftAngleHandbrake, 0, t.driftAngleMax) * DEG
      : 0;
    angle = approach(angle, target, drifting ? t.driftAngleRate : t.straightenRate, h);
    angle = MathUtils.clamp(angle, -t.driftAngleMax * DEG, t.driftAngleMax * DEG);

    // --- Line of travel (Kenney: steering_grip = clamp(speed), target_angular = -input.x * 4, lerp delta*4) ---
    const dir = Math.abs(forwardSpeed) > 0.5 ? Math.sign(forwardSpeed) : throttle >= inp.brake ? 1 : -1;
    const speedFactor = MathUtils.clamp(Math.abs(forwardSpeed) / t.steerFullSpeed, 0, 1);
    const topSpeed = t.power / t.angularDamping * BALL_RADIUS;
    const gripRate = steer * speedFactor * dir * MathUtils.lerp(t.steerRate, t.steerRateHigh, MathUtils.clamp(speed / topSpeed, 0, 1));
    const driftRate = driftSide * t.driftTurnRate * (1 + into * t.driftTurnSteer);
    turnRate = approach(turnRate, MathUtils.lerp(gripRate, driftRate, driftBlend), t.turnSmoothing, h);
    travel = wrap(travel + turnRate * h);

    // --- Drive: add spin around the axis perpendicular to travel (Kenney's handle_input) ---
    const dX = Math.cos(travel), dZ = -Math.sin(travel);
    const axX = dZ, axZ = -dX; // up × d: spinning around it rolls the sphere along d
    const w = body.angvel();
    let spin = w.x * axX + w.z * axZ; // rolling along d (rad/s, + = forwards)
    let side = w.x * dX + w.z * dZ; // rolling sideways
    let throttleTarget = throttle;
    if (inp.brake > 0) throttleTarget = forwardSpeed > 0.5 ? 0 : -inp.brake * t.reversePower;
    engine = approach(engine, throttleTarget, t.throttleResponse, h);
    body.setAngularDamping(Math.abs(throttleTarget) > 0.05 ? t.angularDamping : t.coastDamping);
    spin += engine * t.power * (1 - t.driftSpeedLoss * driftBlend) * h;
    if (inp.brake > 0 && forwardSpeed > 0.5) spin = Math.max(0, spin - inp.brake * t.brakePower * h);
    if (inp.handbrake > 0) spin -= Math.sign(spin) * Math.min(Math.abs(spin), inp.handbrake * t.handbrakeDrag * h);
    if (grounded) {
      // Side grip: sideways sliding and sideways rolling die out, so the sphere follows the line of travel
      const lat = v.x * axX + v.z * axZ;
      const k = 1 - Math.exp(-t.sideGrip * h);
      body.setLinvel({ x: v.x - axX * lat * k, y: v.y, z: v.z - axZ * lat * k }, true);
      side *= 1 - k;
    }
    body.setAngvel({ x: axX * spin + dX * side, y: w.y * Math.exp(-10 * h), z: axZ * spin + dZ * side }, true);

    // Longitudinal acceleration for the visual pitch
    accel = approach(accel, (forwardSpeed - prevForwardSpeed) / h, 8, h);
    prevForwardSpeed = forwardSpeed;
    wheelSpin += (forwardSpeed / WHEEL_RADIUS) * h;

    // Move the kinematic chassis to where the model will be
    placeModel(p);
    chassis.setNextKinematicTranslation(state.position);
    chassis.setNextKinematicRotation(modelQ);
  }

  // Model: sphere position minus radius, heading yaw, eased towards the ground normal (Kenney: interpolate_with 0.2)
  function placeModel(p: { x: number; y: number; z: number }) {
    state.position.set(p.x, p.y - BALL_RADIUS + RIDE_HEIGHT, p.z);
    yawQ.setFromAxisAngle(Y, travel + angle);
    if (grounded && normal.y > 0.5) {
      alignQ.setFromUnitVectors(Y, normal).multiply(yawQ);
      modelQ.slerp(alignQ, 0.2);
    } else {
      modelQ.slerp(yawQ, 0.05);
    }
    modelQ.normalize();
  }

  function afterStep() {
    physics.events.drainContactForceEvents((e: { collider1(): number; collider2(): number; totalForceMagnitude(): number }) => {
      if (e.collider1() === ball.handle || e.collider2() === ball.handle) impact = Math.max(impact, e.totalForceMagnitude());
    });
  }

  function read() {
    const p = body.translation();
    const v = body.linvel();
    placeModel(p);
    state.quaternion.copy(modelQ);
    state.velocity.set(v.x, v.y, v.z);
    const heading = travel + angle;
    const fwdX = Math.cos(heading), fwdZ = -Math.sin(heading);
    state.speed = Math.hypot(v.x, v.z);
    state.forwardSpeed = v.x * fwdX + v.z * fwdZ;
    const left = v.x * fwdZ - v.z * fwdX; // velocity component to the left of the nose (left = −Z at yaw 0)
    state.slipAngle = state.speed > 2 ? Math.atan2(left, state.forwardSpeed) / DEG : 0;
    state.driftAngle = angle / DEG;
    state.yawRate = turnRate;
    state.drifting = drifting;
    state.driftFactor = driftBlend;
    state.grounded = grounded;
    state.impact = impact;
    impact = 0;

    // Visual body lean (Kenney effect_body): roll with sideways g, pitch with acceleration
    const latG = MathUtils.clamp((turnRate * state.speed) / 9.81, -1.2, 1.2);
    state.bodyRoll = approach(state.bodyRoll, latG * t.bodyRoll * DEG, 5, 1 / 60);
    state.bodyPitch = approach(state.bodyPitch, MathUtils.clamp(accel / 9.81, -1, 1) * t.bodyPitch * DEG, 10, 1 / 60);

    // Front wheels: steering input + automatic counter-steer (they point along the line of travel)
    const steerVis = MathUtils.clamp((lastInput.steer || 0) * 0.45 - angle, -0.7, 0.7);
    state.steerAngle = approach(state.steerAngle, steerVis, 10, 1 / 60);

    const slipAbs = Math.abs(state.slipAngle);
    const braking = lastInput.brake > 0.5 && state.forwardSpeed > 12;
    WHEELS.forEach((wd, i) => {
      const w = state.wheels[i];
      w.position.set(wd.x, -RIDE_HEIGHT + WHEEL_RADIUS, wd.z).applyQuaternion(modelQ).add(state.position);
      w.point.set(wd.x, -RIDE_HEIGHT, wd.z).applyQuaternion(modelQ).add(state.position);
      w.contact = grounded;
      w.quaternion.copy(modelQ);
      if (wd.front) w.quaternion.multiply(tmpQ.setFromAxisAngle(Y, state.steerAngle));
      w.quaternion.multiply(tmpQ.setFromAxisAngle(tmpV.set(0, 0, 1), -wheelSpin));
      w.sliding = grounded && state.speed > 4 && ((wd.front ? slipAbs > 30 : slipAbs > 10 || lastInput.handbrake > 0.5) || braking);
    });
    return state;
  }

  function reset(pos = spawn, yaw = spawnYaw) {
    body.setTranslation({ x: pos.x, y: Math.max(pos.y, BALL_RADIUS) + 0.05, z: pos.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    travel = yaw;
    angle = turnRate = engine = driftBlend = sharpTimer = noThrottleTimer = accel = prevForwardSpeed = 0;
    drifting = false;
    driftSide = 0;
    modelQ.setFromAxisAngle(Y, yaw);
    state.bodyRoll = state.bodyPitch = state.steerAngle = 0;
    placeModel(body.translation());
    chassis.setTranslation(state.position, true);
    chassis.setRotation(modelQ, true);
  }

  reset();
  read();

  return { state, update, afterStep, read, reset, applyParams, body };
}

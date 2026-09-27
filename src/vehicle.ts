import { Quaternion, Vector3, MathUtils } from 'three';
import { SURFACES, OBSTACLE_GROUP, type createPhysics } from './physics.js';
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
const WHEEL_RADIUS = 0.29;
// Wheel centres of the Polonez model (car.js), used for skid marks, smoke and the fallback wheels
const WHEELS = [
  { x: 1.34, z: -0.68, front: true },
  { x: 1.34, z: 0.68, front: true },
  { x: -1.14, z: -0.68, front: false },
  { x: -1.14, z: 0.68, front: false },
];
const CHASSIS_HALF = { x: 2.15, y: 0.45, z: 0.9 };
// The body box that hits obstacles: the Polonez's footprint (4.3 × 1.7 m). It is made very tall so the push-out is
// always sideways (a flat box inside a wall could be "resolved" downwards through the ground); every obstacle stands
// on the ground anyway.
const BODY_HALF = { x: 2.15, y: 20, z: 0.85 };
const BODY_Y = 0.2 + 20; // box centre above the ground (bottom 0.2 m above it)
// Collision groups: (membership << 16) | filter. The sphere and the kinematic chassis box ignore each other,
// and the sphere ignores obstacles (group 4, physics.js) – the body box handles those (see collide()).
const GROUP_BALL = (0x0001 << 16) | (0xfffd & ~OBSTACLE_GROUP);
const GROUP_CHASSIS = (0x0002 << 16) | 0xfffd;

const CATCH_ANGLE = 4 * (Math.PI / 180); // Pro/Normalny: a slide this small with no throttle or steering into it is caught
// Spin-out (Normalny/Pro, over-rotated): the body rotates on, but the rotation is damped from the moment the spin is
// detected, so it adds exactly SPIN_TURN over proSpinTime (at most one turn in all, never two), then the car stands.
const SPIN_TURN = 250 * (Math.PI / 180); // rad the body turns on after the spin starts
const SPIN_DECAY = 2.5; // the rotation falls to e^−2.5 ≈ 8 % over proSpinTime
const SPIN_COOL = 1; // s after a spin before a new slide can start (no second spin straight away)
const SPIN_DRAG = 1.6; // 1/s speed lost while spinning
const CRASH_BRAKE = 4; // 1/s – how fast the bounce after a hit dies out while the engine is cut (crashStun)
const Y = new Vector3(0, 1, 0);
// Real powertrain (engine.js createDrivetrain): when given, it drives the car instead of Kenney's spin-and-damping;
// handling and drift stay the same (v0.6c, docs/fizyka-aut.md)
type Drivetrain = {
  update(dt: number, v: number, throttle: number, reverse?: number): { accel: number; rpm: number; gear: number; load: number };
  reset(): void;
};
const BRAKE_DECEL = 8.5; // m/s² at full brake with the real powertrain (≈ 0.87 g)
const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

export function createVehicle(
  physics: Physics,
  { tuning = globalTuning, spawn = { x: 0, y: BALL_RADIUS, z: 0 }, spawnYaw = 0, drivetrain = null }: { tuning?: Tuning; spawn?: { x: number; y: number; z: number }; spawnYaw?: number; drivetrain?: Drivetrain | null } = {},
) {
  const { RAPIER, world } = physics;
  const t = tuning;
  const EXCLUDE_BODIES = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;

  // Physics sphere (Kenney: RigidBody3D, SphereShape3D, friction 5 "rough", CCD on)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true));
  const ball = world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setFriction(5)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(0) // no bouncing on landings and bumps…
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min) // …whatever the other collider says
      .setCollisionGroups(GROUP_BALL)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1000),
    body,
  );
  // Kinematic box that follows the visible car, so the body (not just the sphere) knocks cones over
  // (kinematic bodies get no contacts with static colliders in Rapier, so this box can't wedge the car in a wall;
  // CCD so a fast car doesn't tunnel it through cones)
  const chassis = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true));
  const chassisCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(CHASSIS_HALF.x, CHASSIS_HALF.y, CHASSIS_HALF.z).setTranslation(0, 0.1, 0).setCollisionGroups(GROUP_CHASSIS),
    chassis,
  );

  function applyParams() {
    ball.setMass(t.mass);
    body.setGravityScale(t.gravityScale, true);
    body.setAngularDamping(drivetrain ? 0 : t.angularDamping);
    body.setLinearDamping(drivetrain ? 0 : t.linearDamping); // (the powertrain has its own air drag and rolling resistance)
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
  let hold = 1; // 0..1 how much of the base drift angle is still held (see self-aligning below)
  let noThrottleTimer = 0;
  let recentThrottle = 0; // highest throttle of the last liftWindow seconds (for lift-off oversteer)
  let grounded = false;
  let impact = 0;
  let prevForwardSpeed = 0;
  let accel = 0;
  let wheelSpin = 0;
  let visY = 0; // smoothed sphere height for the model (light visual suspension)
  let stuckTimer = 0;
  let unstuckCount = 0;
  let spinTimer = 0; // s left of a spin-out (Pro: over-rotated drift)
  let spinRate = 0; // rad/s the body still rotates in a spin-out (damped)
  let spinCool = 0; // s left before a slide can start again after a spin
  let danger = 0; // s spent over proDangerAngle without correcting (the balance zone)
  let rpm = 0, gear = 0, load = 0; // from the real powertrain (0 without one)
  let spins = 0;
  const maxAngle = () => (t.realCounter > 0.5 ? t.proSpinAngle : t.driftAngleMax); // degrees
  let crashTimer = 0; // s left without engine power towards the obstacle after a hit
  let crashSide = 1; // +1 the obstacle was hit with the front, −1 with the rear
  let crashSpeed = 0; // m/s into the obstacle of the last hit (reported once in read())
  let crashSurface = '';
  const preV = { x: 0, y: 0, z: 0 }; // sphere velocity going into the physics step
  const preP = { x: 0, y: 0, z: 0 }; // and its position
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
    sideSlip: 0, // degrees 0..90: how far the car slides sideways, the same going forwards and backwards (reversing ≠ sliding)
    wheelspin: 0, // 0..1: full throttle from (almost) standstill, the rear tyres spin up
    driftAngle: 0, // degrees, the commanded heading − travel
    yawRate: 0,
    drifting: false,
    spinning: false, // Pro: spun out after over-rotating a drift
    spinWarning: 0, // 0..1: how close the balance zone is to a spin (squeal, camera shake)
    rpm: 0, // engine rpm, gear (−1 reverse) and load 0..1 – from the real powertrain (engine.js), 0 without one
    gear: 0,
    load: 0,
    spins: 0,
    driftFactor: 0,
    steerAngle: 0, // visual front-wheel angle (rad)
    wheelSpin: 0, // accumulated wheel rotation (rad), for models with their own wheels
    bodyRoll: 0, // visual lean (rad), + = leaning right
    bodyPitch: 0, // visual pitch (rad), + = nose up
    grounded: false,
    impact: 0,
    crash: 0, // m/s into an obstacle, on the frame of a hit (0 otherwise)
    crashSurface: '', // physics.js SURFACES key of what was hit
    unstuck: 0, // how many times the car was pushed out of an obstacle
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
    const hit = world.castRayAndGetNormal(ray, BALL_RADIUS + 0.4, true, EXCLUDE_BODIES, undefined, undefined, undefined, (c) => !isObstacle(c));
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
    // Power oversteer: hard steering + throttle at speed, held for `sharpTime`
    sharpTimer = Math.abs(steer) > t.sharpSteer && throttle > t.sharpThrottle && speed > t.sharpSpeed ? sharpTimer + h : 0;
    noThrottleTimer = throttle < 0.2 && inp.handbrake < 0.5 ? noThrottleTimer + h : 0;
    // Lift-off oversteer: the throttle snapped shut (weight onto the front) while turning hard in a fast corner
    const liftOff = recentThrottle - throttle > t.liftDrop && Math.abs(steer) > t.liftSteer && speed > t.liftSpeed;
    recentThrottle = Math.max(throttle, recentThrottle - h / Math.max(t.liftWindow, 0.01));
    // Entries (ordinary steering never slides): handbrake + steering above driftMinSpeed, lift-off in a fast corner,
    // or power oversteer (full throttle + hard steering, held, above sharpSpeed)
    const handbrakeEntry = inp.handbrake > 0.5 && Math.abs(steer) > t.handbrakeSteer && speed > t.driftMinSpeed;
    if (!drifting && spinTimer <= 0 && spinCool <= 0 && moving && (handbrakeEntry || liftOff || (sharpTimer > t.sharpTime && speed > t.driftMinSpeed))) {
      drifting = true;
      driftSide = Math.sign(steer);
    } else if (drifting && (!moving || speed < t.driftMinSpeed * 0.6 || noThrottleTimer > t.driftExitDelay)) {
      drifting = false;
    }
    driftBlend = approach(driftBlend, drifting ? 1 : 0, drifting ? t.driftAngleRate : t.straightenRate, h);

    // --- Drift angle: the body turns away from the line of travel ---
    // The target is a continuous function of steering, throttle, handbrake and speed (no on/off states):
    //   side·(base + throttle + handbrake)·speedScale + steer·driftAngleSteer·speedScale
    // Steering into the slide deepens it, counter-steer reduces it gradually. Counter-steer beyond
    // `transitionSteer` blends the target over to the other side and the angle sweeps through zero.
    // Self-aligning: the "base" part of the angle only holds while the player steers into the slide (or pulls the
    // handbrake). Let go of the steering and it fades out gently (`selfAlign`), like a steering wheel returning
    // to centre on its own – the car straightens and the drift ends.
    const intoNow = steer * driftSide;
    // How much is held follows the steering continuously: full from 0.6 into the slide, nothing at centre
    const holdTarget = inp.handbrake > 0.5 ? 1 : MathUtils.clamp(intoNow / 0.6, 0, 1);
    if (!drifting) hold = 1;
    else hold = approach(hold, holdTarget, holdTarget > hold ? 4 : t.selfAlign, h);
    let target = 0;
    if (drifting) {
      const speedScale = MathUtils.lerp(t.driftAngleLowSpeed, 1, MathUtils.clamp((speed - t.driftMinSpeed) / t.driftMinSpeed, 0, 1));
      const sideTarget = (side: number) =>
        MathUtils.clamp(side * (t.driftAngleBase + throttle * t.driftAngleThrottle + inp.handbrake * t.driftAngleHandbrake) * (side === driftSide ? hold : 1) + steer * t.driftAngleSteer, -t.driftAngleMax, t.driftAngleMax) *
        speedScale;
      const same = driftSide * Math.max(0, driftSide * sideTarget(driftSide)); // never past zero on its own
      const counter = -steer * driftSide;
      const flip = t.transitionSteer < 1 ? MathUtils.clamp((counter - t.transitionSteer) / (1 - t.transitionSteer), 0, 1) : 0;
      target = MathUtils.lerp(same, sideTarget(-driftSide), flip) * DEG;
    }
    const prevAngle = angle;
    spinCool = Math.max(0, spinCool - h);
    const realCounter = t.realCounter > 0.5;
    if (spinTimer > 0) {
      // Spun out (Pro, over-rotated): the body keeps rotating while the car slides on and scrubs off speed
      spinTimer -= h;
      angle += driftSide * spinRate * h;
      spinRate *= Math.exp((-SPIN_DECAY / Math.max(t.proSpinTime, 0.1)) * h);
      if (spinTimer <= 0) {
        spinCool = SPIN_COOL;
        travel = wrap(travel + angle); // it ends up pointing wherever it stopped
        angle = 0;
      }
    } else if (realCounter && drifting) {
      // Pro: real counter-steer. The angle is not chased towards a target: it keeps growing on its own (more with
      // throttle and handbrake: the rear wants to come round) and the steering adds or takes away from that growth.
      // Counter-steer holds or reduces it, letting go of it lets the slide grow, steering into the slide deepens it
      // – past proSpinAngle the car spins out.
      const speedScale = MathUtils.lerp(t.driftAngleLowSpeed, 1, MathUtils.clamp((speed - t.driftMinSpeed) / t.driftMinSpeed, 0, 1));
      // (below proThrottleNeutral the throttle takes angle away: too little gas and the car straightens itself)
      const grow = (t.proGrow + (throttle - t.proThrottleNeutral) * t.proGrowThrottle + inp.handbrake * t.proGrowHandbrake) * speedScale;
      const u = steer * driftSide; // + into the slide, − counter-steer
      angle += driftSide * (grow + u * (u > 0 ? t.proSteerInto : t.proSteer)) * DEG * h;
      if (angle * driftSide <= 0 || (Math.abs(angle) < CATCH_ANGLE && u <= 0.2 && throttle < t.proThrottleNeutral + 0.1)) {
        if (angle * driftSide <= 0 && -steer * driftSide > t.transitionSteer) {
          driftSide = -driftSide; // flicked through zero with a big counter-steer: now sliding the other way
        } else {
          // caught it: grip again (nearly straight, not pushing it any more); the rest straightens at straightenRate
          drifting = false;
        }
      }
      // Balance zone: over proDangerAngle the clock runs while the player neither counter-steers nor backs off; any
      // correction winds it back twice as fast. The warning (state.spinWarning) grows with it.
      const over = drifting && Math.abs(angle) > t.proDangerAngle * DEG;
      const correcting = u < -0.25 || throttle < t.proThrottleNeutral - 0.05;
      danger = over && !correcting ? danger + h * (u > 0.3 ? 1.4 : 1) : Math.max(0, danger - 2 * h);
      if (drifting && (Math.abs(angle) > t.proSpinAngle * DEG || danger >= t.proSpinDelay)) {
        danger = 0;
        drifting = false; // too much: spin
        spinTimer = t.proSpinTime;
        spinRate = (SPIN_TURN * SPIN_DECAY) / Math.max(t.proSpinTime, 0.1) / (1 - Math.exp(-SPIN_DECAY));
        spins++;
      }
    } else {
      angle = approach(angle, target, drifting ? t.driftAngleRate : t.straightenRate, h);
    }
    if (spinTimer <= 0) angle = MathUtils.clamp(angle, -maxAngle() * DEG, maxAngle() * DEG);
    if (!realCounter && drifting && Math.sign(angle) === -driftSide && Math.sign(prevAngle) !== -driftSide) {
      driftSide = -driftSide; // crossed zero: now sliding the other way
      hold = 1;
    }
    if (!realCounter && drifting && hold < 0.15 && Math.abs(angle) < 3 * DEG) drifting = false; // straightened out
    // --- Line of travel (Kenney: steering_grip = clamp(speed), target_angular = -input.x * 4, lerp delta*4) ---
    const dir = Math.abs(forwardSpeed) > 0.5 ? Math.sign(forwardSpeed) : throttle >= inp.brake ? 1 : -1;
    const speedFactor = MathUtils.clamp(Math.abs(forwardSpeed) / t.steerFullSpeed, 0, 1);
    const topSpeed = t.power / t.angularDamping * BALL_RADIUS;
    const gripRate = steer * speedFactor * dir * MathUtils.lerp(t.steerRate, t.steerRateHigh, MathUtils.clamp(speed / topSpeed, 0, 1));
    // In a drift the line curves with the angle (deeper = tighter), steering adds or takes away a bit
    const driftRate = t.driftTurnRate * (MathUtils.clamp(angle, -t.driftAngleMax * DEG, t.driftAngleMax * DEG) / (30 * DEG) + steer * t.driftTurnSteer);
    turnRate = spinTimer > 0 ? approach(turnRate, 0, 4, h) : approach(turnRate, MathUtils.lerp(gripRate, driftRate, driftBlend), t.turnSmoothing, h);
    travel = wrap(travel + turnRate * h);

    // --- Drive: add spin around the axis perpendicular to travel (Kenney's handle_input) ---
    const dX = Math.cos(travel), dZ = -Math.sin(travel);
    const axX = dZ, axZ = -dX; // up × d: spinning around it rolls the sphere along d
    const w = body.angvel();
    let spin = w.x * axX + w.z * axZ; // rolling along d (rad/s, + = forwards)
    let side = w.x * dX + w.z * dZ; // rolling sideways
    let throttleTarget = throttle;
    if (inp.brake > 0) throttleTarget = forwardSpeed > 0.5 ? 0 : -inp.brake * t.reversePower;
    crashTimer = Math.max(0, crashTimer - h);
    if (crashTimer > 0 && throttleTarget * crashSide > 0) throttleTarget = 0; // just hit it: stop and bounce off first (backing away works)
    if (spinTimer > 0) throttleTarget = 0; // spinning: the wheels are just along for the ride
    engine = approach(engine, throttleTarget, t.throttleResponse, h);
    if (!drivetrain) body.setAngularDamping(Math.abs(throttleTarget) > 0.05 ? t.angularDamping : t.coastDamping);
    const backingOff = throttleTarget * crashSide < 0;
    if (crashTimer > 0 && !backingOff) spin *= Math.exp(-CRASH_BRAKE * h); // after a hit the wheels brake: the bounce dies out
    if (drivetrain) {
      // Real powertrain: its acceleration (engine through the gears minus drag and rolling resistance, engine.js) goes
      // straight into the speed along the line of travel, with the matching roll of the sphere (ω = v / r), so the sphere
      // rolls without slipping. Through the spin alone only 2/7 of it would reach the ground (a solid sphere's inertia).
      const along = v.x * dX + v.z * dZ;
      const r = drivetrain.update(h, along, Math.max(0, engine), Math.max(0, -engine));
      let dv = r.accel * h;
      if (dv > 0) dv *= 1 - t.driftSpeedLoss * driftBlend;
      if (inp.brake > 0 && along > 0.5) dv -= Math.min(along, inp.brake * BRAKE_DECEL * h);
      if (grounded) {
        v.x += dX * dv;
        v.z += dZ * dv;
        spin += dv / BALL_RADIUS;
      }
      rpm = r.rpm;
      gear = r.gear;
      load = r.load;
    } else {
      spin += engine * t.power * (1 - t.driftSpeedLoss * driftBlend) * h;
      if (inp.brake > 0 && forwardSpeed > 0.5) spin = Math.max(0, spin - inp.brake * t.brakePower * h);
    }
    if (inp.handbrake > 0) spin -= Math.sign(spin) * Math.min(Math.abs(spin), inp.handbrake * t.handbrakeDrag * h);
    if (spinTimer > 0) spin *= Math.exp(-SPIN_DRAG * h);
    if (grounded) {
      if (spinTimer > 0) {
        const k = Math.exp(-SPIN_DRAG * h); // tyres scrubbing sideways
        body.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
        v.x *= k;
        v.z *= k;
      }
      if (crashTimer > 0 && !backingOff) {
        const k = Math.exp(-CRASH_BRAKE * h);
        body.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
        v.x *= k;
        v.z *= k;
      }
      // Side grip: sideways sliding and sideways rolling die out, so the sphere follows the line of travel
      const lat = v.x * axX + v.z * axZ;
      // Momentum: the grip that pulls the velocity onto the line of travel weakens with speed and in a drift, so a fast
      // car carries on outwards (overshooting a corner is possible). Łatwy: the same grip everywhere.
      const grip = MathUtils.lerp(MathUtils.lerp(t.sideGrip, t.sideGripHigh, MathUtils.clamp(speed / topSpeed, 0, 1)), t.driftSideGrip, driftBlend);
      const k = 1 - Math.exp(-grip * h);
      let vx = v.x - axX * lat * k, vy = v.y, vz = v.z - axZ * lat * k;
      // Landing / bump damping: near the ground, velocity AWAY from the surface below (a bounce, or a kick from
      // the edge of a bump) dies out fast. Velocity along the surface (driving up a ramp) is untouched.
      {
        const vn = vx * normal.x + vy * normal.y + vz * normal.z;
        if (vn > 0) {
          const kn = vn * (1 - Math.exp(-t.landingDamping * h));
          vx -= normal.x * kn;
          vy -= normal.y * kn;
          vz -= normal.z * kn;
        }
      }
      body.setLinvel({ x: vx, y: vy, z: vz }, true);
      side *= 1 - k;
    }
    body.setAngvel({ x: axX * spin + dX * side, y: w.y * Math.exp(-10 * h), z: axZ * spin + dZ * side }, true);
    const vNow = body.linvel();
    preV.x = vNow.x;
    preV.y = vNow.y;
    preV.z = vNow.z;
    preP.x = p.x;
    preP.y = p.y;
    preP.z = p.z;

    // Longitudinal acceleration for the visual pitch
    accel = approach(accel, (forwardSpeed - prevForwardSpeed) / h, 8, h);
    prevForwardSpeed = forwardSpeed;
    wheelSpin += (forwardSpeed / WHEEL_RADIUS) * h;

    // Really wedged (sphere off the ground or perched on an edge, e.g. in a gap narrower than itself): pedal
    // pressed but no movement for `unstuckTime` → push out. Just leaning on a wall is not wedged: reverse away.
    const pushing = Math.max(input.throttle, input.brake) > 0.5;
    const wedged = !grounded || normal.y < 0.8 || penetrating;
    stuckTimer = pushing && speed < 0.6 && wedged ? stuckTimer + h : 0;
    if (stuckTimer > t.unstuckTime) {
      stuckTimer = 0;
      unstick(input.brake > input.throttle ? 1 : -1);
    }

    // Light visual suspension: the model follows the sphere's height smoothly (max 0.3 m behind)
    visY = MathUtils.clamp(approach(visY, p.y, t.suspension, h), p.y - 0.3, p.y + 0.3);

    // Move the kinematic chassis to where the model will be
    placeModel(p, h);
    chassis.setNextKinematicTranslation(state.position);
    chassis.setNextKinematicRotation(modelQ);
  }

  // Model: sphere position minus radius, heading yaw, eased towards the ground normal (Kenney: interpolate_with 0.2
  // per 60 Hz step ≈ rate 13/s, made frame-rate independent here). Only the physics step advances the smoothing.
  function placeModel(p: { x: number; y: number; z: number }, h = 0) {
    state.position.set(p.x, visY - BALL_RADIUS + RIDE_HEIGHT, p.z);
    yawQ.setFromAxisAngle(Y, travel + angle);
    if (grounded && normal.y > 0.5) {
      alignQ.setFromUnitVectors(Y, normal).multiply(yawQ);
      modelQ.slerp(alignQ, 1 - Math.exp(-13 * h));
    } else {
      modelQ.slerp(yawQ, 1 - Math.exp(-3 * h));
    }
    // Yaw itself is never smoothed (it comes straight from travel + angle): re-apply it on the tilt
    tmpV.set(1, 0, 0).applyQuaternion(modelQ);
    const yawErr = wrap(travel + angle - Math.atan2(-tmpV.z, tmpV.x));
    modelQ.premultiply(tmpQ.setFromAxisAngle(Y, yawErr)).normalize();
  }

  // Push the sphere out to the nearest free spot, preferring the direction away from where it was pushing
  // (dir = −1: behind the car, +1: in front). Uses Rapier's shape query on static geometry only.
  const probe = new RAPIER.Ball(BALL_RADIUS + 0.05);
  const noRot = { x: 0, y: 0, z: 0, w: 1 };
  function isFree(x: number, y: number, z: number) {
    bodyQ.setFromAxisAngle(Y, travel + angle);
    return (
      !world.intersectionWithShape({ x, y, z }, noRot, probe, EXCLUDE_BODIES, undefined, undefined, undefined, (c) => !isObstacle(c)) &&
      !world.intersectionWithShape({ x, y: y - BALL_RADIUS + BODY_Y, z }, bodyQ, bodyShape, undefined, undefined, undefined, undefined, isObstacle)
    );
  }
  function unstick(dir: number) {
    const p = body.translation();
    const heading = travel + angle;
    const y = Math.max(p.y, BALL_RADIUS) + 0.1;
    for (const dist of [1.5, 2.5, 3.5, 5, 7, 10]) {
      for (let i = 0; i < 12; i++) {
        const a = heading + (dir < 0 ? Math.PI : 0) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6);
        const x = p.x + Math.cos(a) * dist, z = p.z - Math.sin(a) * dist;
        if (!isFree(x, y, z)) continue;
        // Keep the heading, lose the speed
        body.setTranslation({ x, y, z }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        engine = angle = turnRate = driftBlend = 0;
        travel = wrap(heading);
        drifting = false;
        visY = y;
        unstuckCount++;
        return true;
      }
    }
    return false;
  }

  function afterStep() {
    physics.events.drainContactForceEvents((e: { collider1(): number; collider2(): number; totalForceMagnitude(): number }) => {
      if (e.collider1() === ball.handle || e.collider2() === ball.handle) impact = Math.max(impact, e.totalForceMagnitude());
    });
    collide();
  }

  // Obstacles (buildings, lamps, cars, walls – physics.js `surface` colliders) are hit by the car's real body, a box
  // of the Polonez's size, not by the sphere (the sphere ignores them; it only rolls on the ground). After each step
  // the box is swept from where it was (no tunnelling through a lamp post at speed) and pushed out of anything it
  // overlaps, and the sphere moves with it. So the car stops exactly where the bodywork touches, and passing close
  // to something without touching it does nothing.
  // Then the car reacts to what it hit (physics.js SURFACES): it bounces back with `rebound` × the impact speed, a
  // glancing hit scrapes off speed along the surface, the drift ends on a hard hit and the engine is cut for a moment
  // (`crashStun`), so the car stops on the obstacle instead of grinding into it. Leaning on it slowly just stops.
  const bodyShape = new RAPIER.Cuboid(BODY_HALF.x, BODY_HALF.y, BODY_HALF.z);
  const isObstacle = (c: { handle: number }) => physics.surfaces.has(c.handle);
  const bodyQ = new Quaternion();
  const hitN = new Vector3();
  const bodyAt = (x: number, z: number) => ({ x, y: body.translation().y - BALL_RADIUS + BODY_Y, z });
  let penetrating = false;
  function collide() {
    const p = body.translation();
    bodyQ.setFromAxisAngle(Y, travel + angle);
    let px = p.x, pz = p.z;
    let best = -Infinity, bestSurface = '';
    const note = (nx: number, nz: number, handle: number) => {
      const len = Math.hypot(nx, nz);
      if (len < 0.5) return false; // mostly vertical: on top of it, not against it
      nx /= len;
      nz /= len;
      const vin = -(preV.x * nx + preV.z * nz);
      if (vin > best) {
        best = vin;
        hitN.set(nx, 0, nz);
        bestSurface = physics.surfaces.get(handle) ?? 'concrete';
      }
      return true;
    };
    // Sweep from the previous position (fast car vs thin post)
    const dx = px - preP.x, dz = pz - preP.z;
    if (dx * dx + dz * dz > 0.04) {
      const hit = world.castShape(bodyAt(preP.x, preP.z), bodyQ, { x: dx, y: 0, z: dz }, bodyShape, 0, 1, false, undefined, undefined, undefined, undefined, isObstacle);
      // (for a world query, witness1/normal1 are on the obstacle: its outward normal)
      if (hit && hit.time_of_impact < 1 && note(hit.normal1.x, hit.normal1.z, hit.collider.handle)) {
        const back = Math.max(0, hit.time_of_impact - 0.02 / Math.hypot(dx, dz));
        px = preP.x + dx * back;
        pz = preP.z + dz * back;
      }
    }
    // Push out of overlaps (a few passes for corners)
    penetrating = false;
    for (let pass = 0; pass < 4; pass++) {
      let deepest = 0, mx = 0, mz = 0, handle = -1;
      world.intersectionsWithShape(bodyAt(px, pz), bodyQ, bodyShape, (c) => {
        const ct = c.contactShape(bodyShape, bodyAt(px, pz), bodyQ, 0);
        if (ct && ct.distance < deepest && Math.hypot(ct.normal1.x, ct.normal1.z) > 0.5) {
          deepest = ct.distance;
          mx = ct.normal1.x;
          mz = ct.normal1.z;
          handle = c.handle;
        }
        return true;
      }, undefined, undefined, undefined, undefined, isObstacle); // (no filter flags: they drop body-less colliders)
      if (handle < 0) break;
      const len = Math.hypot(mx, mz);
      px += (mx / len) * (-deepest + 0.005);
      pz += (mz / len) * (-deepest + 0.005);
      note(mx, mz, handle);
      if (pass === 3) penetrating = true;
    }
    if (penetrating) {
      // Squeezed between obstacles from both sides (e.g. reset in a gap narrower than the car): jump free
      if (px !== p.x || pz !== p.z) body.setTranslation({ x: px, y: p.y, z: pz }, true);
      unstick(-1);
      return;
    }
    if (best === -Infinity) return;
    if (px !== p.x || pz !== p.z) body.setTranslation({ x: px, y: p.y, z: pz }, true);

    const v = body.linvel();
    const vn = v.x * hitN.x + v.z * hitN.z;
    if (best < t.crashMinSpeed) {
      // Leaning on it: no speed into the obstacle, the rest (along it) stays
      if (vn < 0) {
        const nx = v.x - hitN.x * vn, nz = v.z - hitN.z * vn;
        body.setLinvel({ x: nx, y: v.y, z: nz }, true);
        const w = body.angvel();
        const wn = w.z * hitN.x - w.x * hitN.z; // spin that rolls the sphere towards −n
        if (wn > 0) body.setAngvel({ x: w.x + hitN.z * wn, y: w.y, z: w.z - hitN.x * wn }, true);
      }
      return;
    }
    const sf = SURFACES[bestSurface as keyof typeof SURFACES] ?? SURFACES.concrete;
    const speed = Math.hypot(preV.x, preV.z);
    const headOn = MathUtils.clamp(best / Math.max(speed, 1e-3), 0, 1);
    const keep = 1 - sf.scrape * headOn;
    const tx = (preV.x + hitN.x * best) * keep, tz = (preV.z + hitN.z * best) * keep; // along the surface
    const out = best * sf.rebound * t.crashRebound;
    const nx = tx + hitN.x * out, nz = tz + hitN.z * out;
    body.setLinvel({ x: nx, y: Math.min(v.y, 0), z: nz }, true);
    body.setAngvel({ x: nz / BALL_RADIUS, y: 0, z: -nx / BALL_RADIUS }, true); // rolling with the new velocity
    // Keep the body where it points; the line of travel follows the new velocity (or its reverse when backing off)
    const heading = travel + angle;
    const nSpeed = Math.hypot(nx, nz);
    if (nSpeed > 0.5) {
      const vYaw = Math.atan2(-nz, nx);
      const newTravel = Math.cos(vYaw - heading) >= 0 ? vYaw : wrap(vYaw + Math.PI);
      angle = MathUtils.clamp(wrap(heading - newTravel), -maxAngle() * DEG, maxAngle() * DEG);
      travel = wrap(heading - angle);
    }
    turnRate = 0;
    spinTimer = 0;
    crashSide = hitN.x * Math.cos(heading) - hitN.z * Math.sin(heading) < 0 ? 1 : -1;
    const severity = best / 10; // 1 at 36 km/h straight in
    if (severity > 0.3) drifting = false;
    engine *= 1 - MathUtils.clamp(severity, 0, 1);
    crashTimer = Math.max(crashTimer, t.crashStun * Math.min(severity, 1.5));
    if (best > crashSpeed) {
      crashSpeed = best;
      crashSurface = bestSurface;
    }
  }

  function read() {
    const p = body.translation();
    const v = body.linvel();
    placeModel(p);
    state.quaternion.copy(modelQ);
    state.unstuck = unstuckCount;
    state.wheelSpin = wheelSpin;
    state.velocity.set(v.x, v.y, v.z);
    const heading = travel + angle;
    const fwdX = Math.cos(heading), fwdZ = -Math.sin(heading);
    state.speed = Math.hypot(v.x, v.z);
    state.forwardSpeed = v.x * fwdX + v.z * fwdZ;
    const left = v.x * fwdZ - v.z * fwdX; // velocity component to the left of the nose (left = −Z at yaw 0)
    state.slipAngle = state.speed > 2 ? Math.atan2(left, state.forwardSpeed) / DEG : 0;
    // (atan2 gives ~180° when reversing straight: fold it, so only a real sideways slide counts)
    state.sideSlip = state.speed > 2 ? Math.atan2(Math.abs(left), Math.abs(state.forwardSpeed)) / DEG : 0;
    const launch = (lastInput.throttle || 0) > 0.85 && state.forwardSpeed > -0.5 && state.forwardSpeed < 5;
    state.wheelspin = grounded && launch && spinTimer <= 0 ? 1 - Math.max(0, state.forwardSpeed) / 5 : 0;
    state.driftAngle = angle / DEG;
    state.yawRate = turnRate;
    state.drifting = drifting;
    state.spinning = spinTimer > 0;
    state.rpm = rpm;
    state.gear = gear;
    state.load = load;
    state.spinWarning = spinTimer > 0 || !drifting ? 0 : Math.min(1, danger / Math.max(t.proSpinDelay, 0.1));
    state.spins = spins;
    state.driftFactor = driftBlend;
    state.grounded = grounded;
    state.impact = impact;
    impact = 0;
    state.crash = crashSpeed;
    state.crashSurface = crashSurface;
    crashSpeed = 0;

    // Visual body lean (Kenney effect_body): roll with sideways g, pitch with acceleration
    const latG = MathUtils.clamp((turnRate * state.speed) / 9.81, -1.2, 1.2);
    state.bodyRoll = approach(state.bodyRoll, latG * t.bodyRoll * DEG, 5, 1 / 60);
    state.bodyPitch = approach(state.bodyPitch, MathUtils.clamp(accel / 9.81, -1, 1) * t.bodyPitch * DEG, 10, 1 / 60);

    // Front wheels: the steering input in grip; in a drift they show counter-steer on their own, pointing against
    // the turn in proportion to the drift angle (counterSteerVisual = 1: along the line of travel), whatever the
    // player presses. Pro: the player's real input on top (the counter-steer really steers there).
    const counter = -angle * t.counterSteerVisual;
    const input = (lastInput.steer || 0) * 0.45;
    const inDrift = spinTimer > 0 ? 0 : driftBlend;
    const steerVis = MathUtils.clamp(MathUtils.lerp(input, counter + (t.realCounter > 0.5 ? input * 0.5 : 0), inDrift), -0.7, 0.7);
    state.steerAngle = approach(state.steerAngle, steerVis, 10, 1 / 60);

    const slipAbs = state.sideSlip;
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
    angle = turnRate = engine = driftBlend = sharpTimer = noThrottleTimer = recentThrottle = accel = prevForwardSpeed = stuckTimer = crashTimer = spinTimer = spinRate = spinCool = danger = 0;
    drivetrain?.reset();
    drifting = false;
    driftSide = 0;
    hold = 1;
    visY = body.translation().y;
    modelQ.setFromAxisAngle(Y, yaw);
    state.bodyRoll = state.bodyPitch = state.steerAngle = 0;
    placeModel(body.translation());
    chassis.setTranslation(state.position, true);
    chassis.setRotation(modelQ, true);
  }

  reset();
  read();

  return { state, update, afterStep, read, reset, applyParams, body, chassisCollider, ballCollider: ball };
}

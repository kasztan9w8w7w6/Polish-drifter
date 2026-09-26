import { Quaternion, Vector3, MathUtils } from 'three'; // math helpers only, no rendering
import { tuning as sharedTuning } from './tuning.js';

// Car physics on Rapier's built-in DynamicRayCastVehicleController, plus arcade drift assists.
//
// Input  (each call to update): { throttle 0..1, brake 0..1, steer -1..1 (+ = left), handbrake 0..1 }
// Output (vehicle.state):       position, quaternion, velocity, speed, forwardSpeed, slipAngle (deg,
//                               + = sliding to the left of the nose), drifting, wheels[{ contact, point, sliding, ... }]
//
// Chassis frame: +X forward, +Y up, +Z right (Rapier's default vehicle axes).

// Polonez-like dimensions: 4.3 m long, 2.5 m wheelbase, ~1.44 m track.
const HALF = { x: 2.15, y: 0.32, z: 0.84 };
const WHEEL_RADIUS = 0.3;
export const WHEELS = [
  { x: 1.25, z: -0.72, front: true },
  { x: 1.25, z: 0.72, front: true },
  { x: -1.25, z: -0.72, front: false },
  { x: -1.25, z: 0.72, front: false },
];

const DEG = Math.PI / 180;
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export function createVehicle(physics, { tuning = sharedTuning, spawn = { x: 0, y: 1.2, z: 0 }, spawnYaw = 0 } = {}) {
  const { RAPIER, world } = physics;
  const t = tuning;

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setLinearDamping(0.05)
      .setAngularDamping(0.6),
  );
  // Colliders carry no mass; mass, low centre of mass and inertia are set explicitly below.
  const chassisCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(HALF.x, HALF.y, HALF.z)
      .setDensity(0)
      .setFriction(0.3)
      .setRestitution(0.1)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1000),
    body,
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.05, 0.28, 0.78).setTranslation(-0.3, 0.58, 0).setDensity(0).setFriction(0.3),
    body,
  );

  const controller = world.createVehicleController(body);
  for (const w of WHEELS) {
    controller.addWheel({ x: w.x, y: -0.12, z: w.z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, t.suspensionRestLength, WHEEL_RADIUS);
  }

  function applyChassisParams() {
    const m = t.mass;
    // Box inertia for 4.3 × 1.3 × 1.7 m; yaw inertia scalable for handling feel
    const ix = (m / 12) * (1.3 ** 2 + 1.7 ** 2);
    const iy = (m / 12) * (4.3 ** 2 + 1.7 ** 2) * t.yawInertiaScale;
    const iz = (m / 12) * (4.3 ** 2 + 1.3 ** 2);
    body.setAdditionalMassProperties(m, { x: 0, y: t.comHeight, z: 0 }, { x: ix, y: iy, z: iz }, { x: 0, y: 0, z: 0, w: 1 }, true);
    for (let i = 0; i < 4; i++) {
      controller.setWheelSuspensionStiffness(i, t.suspensionStiffness);
      controller.setWheelSuspensionCompression(i, t.suspensionCompression);
      controller.setWheelSuspensionRelaxation(i, t.suspensionRelaxation);
      controller.setWheelSuspensionRestLength(i, t.suspensionRestLength);
      controller.setWheelMaxSuspensionTravel(i, t.maxSuspensionTravel);
      controller.setWheelMaxSuspensionForce(i, 1e5);
    }
  }
  applyChassisParams();

  // Internal state
  let steerAngle = 0; // rad, + = left
  let rearLoss = 0; // 0 = full rear grip, 1 = full drift grip
  let driftFactor = 0; // how much the car is actually drifting (0..1)
  let prevSpeed = 0;
  let prevSlip = 0;
  let driftLatched = false;
  let driftSide = 0; // sign of slipAngle of the current drift
  let smallSlipTime = 0;
  let prevThrottle = 0;
  let liftOffTimer = 0;
  let braking = false;
  let impact = 0;
  let lastInput = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };

  const q = new Quaternion();
  const fwd = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const tmp = new Vector3();

  const state = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    velocity: new Vector3(),
    speed: 0,
    forwardSpeed: 0,
    slipAngle: 0,
    yawRate: 0,
    drifting: false,
    driftFactor: 0,
    rearLoss: 0,
    steerAngle: 0,
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

  // Read the body into local frame values
  function measure() {
    const r = body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    fwd.copy(X).applyQuaternion(q);
    right.copy(Z).applyQuaternion(q);
    up.copy(Y).applyQuaternion(q);
    const v = body.linvel();
    const f = v.x * fwd.x + v.z * fwd.z;
    const l = v.x * right.x + v.z * right.z;
    const speed = Math.hypot(v.x, v.z);
    // Velocity direction relative to the nose, CCW from above. Increasing yaw rate decreases it.
    const slip = speed > 1 ? Math.atan2(-l, f) : 0;
    return { v, f, speed, slip };
  }

  function update(input, h) {
    lastInput = input;
    const { f, speed, slip } = measure();
    const absSlip = Math.abs(slip);
    const movingForward = f > 2;
    // Drift latch with hysteresis: enters above 12°, ends when the gas is released or the angle stays
    // under 4° for longer than `transitionGrace` (so a left→right switch passing through 0° survives)
    smallSlipTime = absSlip < 4 * DEG ? smallSlipTime + h : 0;
    const throttleOff = input.throttle < 0.2 && input.handbrake === 0;
    if (!movingForward || throttleOff || smallSlipTime > t.transitionGrace) driftLatched = false;
    else if (absSlip > 12 * DEG) driftLatched = true;
    if (driftLatched && absSlip > 6 * DEG) driftSide = Math.sign(slip);
    const sliding = driftLatched ? 1 : movingForward ? MathUtils.smoothstep(absSlip, 3 * DEG, 12 * DEG) : 0;
    const slipRate = (slip - prevSlip) / h;
    prevSlip = slip;

    // --- Rear grip loss. Ways in: handbrake, power oversteer (gas + steer), brake tap in a turn,
    // lift-off (gas released mid-turn). Gas keeps an existing slide going.
    const speedGate = MathUtils.smoothstep(speed, 4, 10);
    const entryGate = MathUtils.smoothstep(speed, 5, 9); // entries without handbrake work from ~20–30 km/h
    const steerAmt = MathUtils.smoothstep(Math.abs(input.steer), 0.25, 0.8);
    if (prevThrottle > 0.6 && input.throttle < 0.3 && steerAmt > 0.5 && speed > 10) liftOffTimer = 0.5;
    liftOffTimer = Math.max(0, liftOffTimer - h);
    prevThrottle = input.throttle;
    const brakeEntry = f > 1 ? input.brake * steerAmt * t.brakeDrift * entryGate : 0;
    const liftEntry = liftOffTimer > 0 ? t.liftOffLoss * steerAmt * entryGate : 0;
    const target = movingForward
      ? Math.max(
          input.handbrake * t.handbrakeLoss,
          input.throttle * steerAmt * t.powerOversteer * entryGate,
          brakeEntry,
          liftEntry,
          MathUtils.smoothstep(input.throttle, 0.3, 0.7) * t.driftSustain * sliding,
        )
      : 0;
    const rate = target > rearLoss ? t.gripBlendIn : t.gripBlendOut;
    rearLoss += (target - rearLoss) * (1 - Math.exp(-rate * h));
    driftFactor = rearLoss * sliding;

    // --- Steering: speed-sensitive lock, counter-steer assist, rate limit
    const lock = MathUtils.lerp(t.steerMaxLow, t.steerMaxHigh, MathUtils.clamp(speed / t.steerFadeSpeed, 0, 1));
    // Assist points the front wheels along the direction of travel (angle = slip); the player steers
    // on top of that with reduced authority while drifting, so a full counter-steer doesn't snap the car straight.
    const assist = movingForward ? t.counterSteerAssist * sliding * slip : 0;
    const authority = MathUtils.lerp(1, t.driftSteerAuthority, driftFactor);
    const maxLock = Math.max(t.steerMaxLow, 0.8);
    let steerTarget = MathUtils.clamp(input.steer * lock * authority + assist, -maxLock, maxLock);
    // Counter-steer limit: while drifting, front wheels may point at most `counterSteerLimit` × slip
    // towards the outside, so a full counter-steer holds a shallow drift instead of snapping straight.
    if (driftLatched && Math.sign(steerTarget) === Math.sign(slip)) {
      const limit = absSlip * t.counterSteerLimit;
      steerTarget = MathUtils.clamp(steerTarget, -limit, limit);
    }
    const growing = Math.abs(steerTarget) > Math.abs(steerAngle) && Math.sign(steerTarget) === Math.sign(steerAngle || steerTarget);
    const steerRate = growing ? t.steerRate : t.steerReturnRate;
    steerAngle += MathUtils.clamp(steerTarget - steerAngle, -steerRate * h, steerRate * h);

    // --- Engine / brakes (rear-wheel drive)
    let engine = input.throttle * t.engineForce * Math.max(0, 1 - speed / t.maxSpeed);
    let brake = 0;
    braking = false;
    if (input.brake > 0) {
      if (f > 1) {
        brake = t.brakeForce * input.brake;
        braking = true;
      } else engine = -t.reverseForce * input.brake;
    }

    const frontSlip = t.frontGrip;
    const rearSlip = MathUtils.lerp(t.rearGrip, t.rearGripDrift, rearLoss);
    const rearSide = MathUtils.lerp(t.rearSideStiffness, t.rearSideStiffnessDrift, rearLoss);
    for (let i = 0; i < 4; i++) {
      const front = WHEELS[i].front;
      controller.setWheelSteering(i, front ? steerAngle : 0);
      controller.setWheelEngineForce(i, front ? 0 : engine);
      controller.setWheelBrake(i, brake + (front ? 0 : input.handbrake * t.handbrakeBrake));
      controller.setWheelFrictionSlip(i, front ? frontSlip : rearSlip);
      controller.setWheelSideFrictionStiffness(i, front ? t.frontSideStiffness : rearSide);
    }

    // --- Yaw assists
    const w = body.angvel();
    let dYaw = 0;
    if (movingForward && speed > 3) {
      const min = t.driftAngleMin * DEG;
      const max = t.driftAngleMax * DEG;
      const top = max - 5 * DEG; // soft zone starts 5° under the limit, leaving headroom for inertia
      // Anti-spin: past `top` pull the slip angle back and stop it growing
      if (absSlip > top) {
        dYaw += t.angleHold * (slip - Math.sign(slip) * top);
        if (Math.sign(slipRate) === Math.sign(slip)) dYaw += t.driftAngleDamping * slipRate;
      }
      // Drift angle control: while drifting, steering picks a target angle (signed, along the drift side):
      // into the turn → top, neutral → middle, counter-steer → min, and past `counterSteerSwitch`
      // the target crosses 0° to the other side, so a strong counter-steer swings the car into the
      // opposite drift (transition). Increasing yaw rate lowers slip.
      if (driftFactor > 0.2 && (absSlip > 3 * DEG || driftLatched)) {
        const side = absSlip > 3 * DEG ? Math.sign(slip) : driftSide || 1;
        const into = -input.steer * side; // +1 steering into the turn, -1 counter-steering
        const mid = (min + top) / 2;
        const sw = t.counterSteerSwitch;
        let target;
        if (into >= 0) target = MathUtils.lerp(mid, top, into);
        else if (-into <= sw) target = MathUtils.lerp(mid, min, -into / sw);
        else target = MathUtils.lerp(min, -mid, (-into - sw) / Math.max(1 - sw, 1e-3));
        // PD controller: P pulls towards the target angle, D damps how fast the angle changes
        dYaw += driftFactor * (t.driftAngleControl * (slip - side * target) + t.driftAngleDamping * slipRate);
      }
      // Entry kick: extra yaw into the turn while the slide is still small (handbrake, brake tap,
      // lift-off), so a drift starts quickly
      const kick = Math.max(input.handbrake, brakeEntry, liftEntry);
      if (kick > 0 && absSlip < min) dYaw += t.entryKick * kick * input.steer * speedGate * (1 - absSlip / min);
    }
    // --- Upright assist: pull roll/pitch back once tilt exceeds ~12°
    tmp.crossVectors(up, Y);
    const tilt = tmp.length();
    const k = tilt > 0.2 ? t.uprightAssist * (tilt - 0.2) / tilt : 0;
    body.setAngvel({ x: w.x + tmp.x * k * h, y: w.y + dYaw * h, z: w.z + tmp.z * k * h }, true);

    prevSpeed = speed;
    controller.updateVehicle(h);
  }

  // Call after every physics sub-step
  function afterStep() {
    // Speed retention while drifting: cancel part of the speed lost this step
    const v = body.linvel();
    const speed = Math.hypot(v.x, v.z);
    if (driftFactor > 0.05 && !braking && speed > 1 && speed < prevSpeed) {
      const keep = t.speedKeep * Math.min(1, driftFactor * 1.5);
      const s = (speed + (prevSpeed - speed) * keep) / speed;
      body.setLinvel({ x: v.x * s, y: v.y, z: v.z * s }, true);
    }
    physics.events.drainContactForceEvents((e) => {
      if (e.collider1() === chassisCollider.handle || e.collider2() === chassisCollider.handle) {
        impact = Math.max(impact, e.totalForceMagnitude());
      }
    });
  }

  // Refresh `state` (call once per frame after stepping)
  function read() {
    const { v, f, speed, slip } = measure();
    const p = body.translation();
    state.position.set(p.x, p.y, p.z);
    state.quaternion.copy(q);
    state.velocity.set(v.x, v.y, v.z);
    state.speed = speed;
    state.forwardSpeed = f;
    state.slipAngle = slip / DEG;
    state.yawRate = body.angvel().y;
    state.driftFactor = driftFactor;
    state.drifting = driftFactor > 0.3 && Math.abs(state.slipAngle) > 10;
    state.rearLoss = rearLoss;
    state.steerAngle = steerAngle;
    state.impact = impact;
    impact = 0;

    const down = tmp.set(0, -1, 0).applyQuaternion(q);
    let grounded = false;
    for (let i = 0; i < 4; i++) {
      const ws = state.wheels[i];
      ws.contact = controller.wheelIsInContact(i);
      grounded ||= ws.contact;
      const cp = controller.wheelContactPoint(i);
      if (cp) ws.point.set(cp.x, cp.y, cp.z);
      const hp = controller.wheelHardPoint(i);
      const len = controller.wheelSuspensionLength(i) ?? t.suspensionRestLength;
      if (hp) ws.position.set(hp.x, hp.y, hp.z).addScaledVector(down, len);
      ws.quaternion
        .copy(q)
        .multiply(new Quaternion().setFromAxisAngle(Y, controller.wheelSteering(i) ?? 0))
        .multiply(new Quaternion().setFromAxisAngle(Z, -(controller.wheelRotation(i) ?? 0)));
      const slideAngle = ws.rear ? 8 : 30;
      ws.sliding =
        ws.contact &&
        speed > 3 &&
        ((ws.rear && (lastInput.handbrake > 0.5 || (rearLoss > 0.3 && Math.abs(state.slipAngle) > slideAngle))) ||
          (!ws.rear && Math.abs(state.slipAngle) > slideAngle) ||
          (braking && speed > 12));
    }
    state.grounded = grounded;
    return state;
  }

  function reset(pos = spawn, yaw = spawnYaw) {
    body.setTranslation(pos, true);
    body.setRotation(new Quaternion().setFromAxisAngle(Y, yaw), true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    steerAngle = 0;
    rearLoss = 0;
    driftFactor = 0;
    prevSlip = 0;
    driftLatched = false;
    driftSide = 0;
    smallSlipTime = 0;
    liftOffTimer = 0;
  }
  reset();
  read();

  return { state, update, afterStep, read, reset, applyChassisParams, body, controller };
}

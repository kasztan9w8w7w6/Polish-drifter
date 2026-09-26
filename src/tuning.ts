// All driving parameters in one place. Every field is exposed in lil-gui (key G).
// Base model: Kenney Starter Kit Racing (MIT) – a rolling sphere pushed by spin, the visible car follows it.
// Units: speeds in m/s, rates in 1/s, angles in degrees.

const base = {
  // Sphere (Kenney's values: mass 1000, gravity scale 1.5, angular damp 4, linear damp 0.1)
  mass: 1000,
  gravityScale: 1.5,
  angularDamping: 2, // Kenney: 4 – halved so letting off the gas doesn't stop the car dead; sets top speed with `power`
  linearDamping: 0.1,
  coastDamping: 0.6, // angular damping with the throttle released (engine braking) – ours, Kenney has one value

  // Engine / brakes (Kenney: angular_velocity += axis * speed * 100 * dt)
  power: 60, // spin added per second at full throttle; top speed ≈ power / angularDamping (m/s, sphere r = 1)
  throttleResponse: 6, // Kenney: linear_speed lerp(…, delta * 6)
  reversePower: 0.5, // fraction of power when reversing (Kenney: target_speed / 2)
  brakePower: 35, // spin removed per second on the brake
  handbrakeDrag: 6, // spin removed per second on the handbrake
  sideGrip: 20, // 1/s – how fast sideways sliding dies out (keeps the sphere on the line of travel)

  // Steering (Kenney: target_angular = -input.x * 4, smoothed by lerp(…, delta * 4))
  steerRate: 2.2, // rad/s of turn at low speed
  steerRateHigh: 1.1, // rad/s of turn at top speed
  steerFullSpeed: 6, // m/s – below this steering fades out (a car can't turn on the spot)
  turnSmoothing: 5, // 1/s

  // Drift on top (arcade: the body rotates away from the line of travel, no tyre model)
  driftMinSpeed: 8, // m/s ≈ 29 km/h
  sharpSteer: 0.85, // power oversteer: |steer| above this…
  sharpThrottle: 0.5, // …with at least this much throttle…
  sharpSpeed: 13, // …above this speed (m/s ≈ 47 km/h)…
  sharpTime: 0.15, // …held this long (s) starts a drift without the handbrake
  // Target angle (continuous): side·(base + throttle·gaz + handbrake·ręczny) + steer·driftAngleSteer, × speed scale
  driftAngleBase: 15, // angle with neutral steering and no throttle
  driftAngleSteer: 26, // degrees per full steering lock (into the turn: deeper, counter-steer: shallower)
  driftAngleThrottle: 8, // + at full throttle
  driftAngleHandbrake: 8, // + while the handbrake is held
  driftAngleLowSpeed: 0.6, // angle multiplier at driftMinSpeed (reaches 1 at twice that speed)
  driftAngleMax: 42, // hard limit on the angle – no spin-outs possible
  driftAngleRate: 2, // 1/s how fast the angle follows its target (lower = hold steering longer for a deeper angle)
  straightenRate: 3, // 1/s how fast the car straightens after the drift
  driftTurnRate: 0.75, // rad/s the line of travel curves at a 30° angle (deeper = tighter)
  driftTurnSteer: 0.5, // ± of that from steering
  transitionSteer: 0.8, // counter-steer above this swings the car over to the other side (>1 = off)
  driftExitDelay: 0.3, // s without throttle before the drift ends
  driftSpeedLoss: 0.08, // fraction of engine power lost while drifting

  // Contact / recovery
  landingDamping: 30, // 1/s – how fast bouncing off the ground dies out
  suspension: 18, // 1/s – how quickly the model follows the sphere's height (visual suspension)
  unstuckTime: 1, // s of pedal without movement before the car is pushed free

  // Visual only
  bodyRoll: 5, // degrees of body lean at 1 g sideways
  bodyPitch: 3, // degrees of nose lift at 1 g acceleration

  // Camera (Kenney view.gd: position lerp delta*4, zoom 10 → 20 with speed)
  camDistance: 6.5, // m behind the car at a standstill…
  camDistanceFast: 8.5, // …and at top speed
  camHeight: 2.6,
  camFollow: 4, // 1/s position smoothing (Kenney's value)
  camYawFollow: 3, // 1/s how fast the camera swings behind the direction of travel
  camLead: 5, // m the look point runs ahead along the velocity at top speed
  fovBase: 62,
  fovFast: 78,
  shakeSpeed: 0.25, // shake at top speed (0..1)
  shakeImpact: 1, // shake from hits
};

export type Tuning = typeof base;

export const presets: Record<string, Tuning> = {
  Łatwy: { ...base },
  Pro: {
    ...base,
    // Power oversteer works, but needs more speed, full throttle and a longer, sharper input
    sharpSteer: 0.95,
    sharpThrottle: 0.9,
    sharpSpeed: 17,
    sharpTime: 0.35,
    driftAngleBase: 10,
    driftAngleSteer: 32,
    driftAngleThrottle: 12,
    driftAngleRate: 2.6,
    driftTurnSteer: 0.8,
    driftExitDelay: 0.15,
    driftSpeedLoss: 0.15,
    transitionSteer: 0.7,
    steerRate: 2.6,
  },
};

export const DEFAULT_PRESET = 'Łatwy';
export const tuning: Tuning = { ...presets[DEFAULT_PRESET] };

export function applyPreset(name: string): Tuning {
  return Object.assign(tuning, presets[name]);
}

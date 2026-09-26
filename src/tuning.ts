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
  sideGrip: 20, // 1/s – how fast sideways sliding dies out (keeps the sphere on the line of travel)…
  sideGripHigh: 20, // …the same at top speed (lower = the car carries on outwards in fast corners: momentum)
  driftSideGrip: 20, // …and in a drift (lower = the car slides on along its old line, overshooting is possible)

  // Steering (Kenney: target_angular = -input.x * 4, smoothed by lerp(…, delta * 4))
  steerRate: 2.2, // rad/s of turn at low speed
  steerRateHigh: 1.1, // rad/s of turn at top speed
  steerFullSpeed: 6, // m/s – below this steering fades out (a car can't turn on the spot)
  turnSmoothing: 5, // 1/s

  // Drift on top (arcade: the body rotates away from the line of travel, no tyre model)
  driftMinSpeed: 8, // m/s ≈ 29 km/h – below this no drift starts (handbrake entry)
  handbrakeSteer: 0.3, // handbrake entry: |steer| above this
  // Lift-off oversteer: the throttle snapped shut (by liftDrop within liftWindow s) while steering above liftSteer
  // above liftSpeed (weight transfer onto the front wheels)
  liftSpeed: 999, // m/s (999 = off)
  liftSteer: 0.6,
  liftDrop: 0.6,
  liftWindow: 0.35,
  sharpSteer: 0.85, // power oversteer: |steer| above this…
  sharpThrottle: 0.5, // …with at least this much throttle…
  sharpSpeed: 13, // …above this speed (m/s ≈ 47 km/h)…
  sharpTime: 0.15, // …held this long (s) starts a drift without the handbrake
  // Target angle (continuous): side·(base + throttle·gaz + handbrake·ręczny) + steer·driftAngleSteer, × speed scale
  driftAngleBase: 15, // angle with neutral steering and no throttle
  driftAngleSteer: 26, // degrees per full steering lock (into the turn: deeper, counter-steer: shallower)
  driftAngleThrottle: 8, // + at full throttle
  driftAngleHandbrake: 8, // + while the handbrake is held
  selfAlign: 0.9, // 1/s – with the steering released the drift angle fades out this fast (wheel returning to centre)
  driftAngleLowSpeed: 0.6, // angle multiplier at driftMinSpeed (reaches 1 at twice that speed)
  driftAngleMax: 42, // hard limit on the angle – no spin-outs possible
  driftAngleRate: 2, // 1/s how fast the angle follows its target (lower = hold steering longer for a deeper angle)
  straightenRate: 3, // 1/s how fast the car straightens after the drift
  driftTurnRate: 0.75, // rad/s the line of travel curves at a 30° angle (deeper = tighter)
  driftTurnSteer: 0.5, // ± of that from steering
  transitionSteer: 0.8, // counter-steer above this swings the car over to the other side (>1 = off)
  driftExitDelay: 0.3, // s without throttle before the drift ends
  driftSpeedLoss: 0.08, // fraction of engine power lost while drifting
  counterSteerVisual: 1, // in a drift the front wheels show counter-steer: × the drift angle (1 = along the line of travel)
  // Real counter-steer (preset Pro: realCounter = 1). The drift angle grows on its own, steering changes the growth:
  realCounter: 0, // 0 = the angle follows a target (Łatwy), 1 = held and regulated by counter-steer, can spin out
  proGrow: 10, // °/s the angle grows with neutral steering and no throttle
  proGrowThrottle: 30, // °/s more at full throttle…
  proThrottleNeutral: 0, // …counted from this throttle: below it the throttle takes angle away (too little gas: it straightens)
  proGrowHandbrake: 20, // °/s more on the handbrake
  proSteer: 90, // °/s the angle drops per full counter-steer lock
  proSteerInto: 40, // °/s the angle grows per full lock into the slide (too much → spin)
  proSpinAngle: 75, // ° past this the car spins out
  proSpinTime: 1.2, // s the spin lasts (engine off, speed scrubbed)

  // Contact / recovery
  landingDamping: 30, // 1/s – how fast bouncing off the ground dies out
  suspension: 18, // 1/s – how quickly the model follows the sphere's height (visual suspension)
  unstuckTime: 1, // s of pedal without movement while really wedged (off the ground / on an edge) before the car is pushed free
  crashMinSpeed: 1.5, // m/s into an obstacle that counts as a hit (below: the car just leans on it)
  crashRebound: 1, // × each surface's bounce (physics.js SURFACES: concrete 0.12 … tyres 0.35)
  crashStun: 0.5, // s without engine power after a hit at 36 km/h (scales with the impact), so the car stops and bounces off

  // Visual only
  bodyRoll: 5, // degrees of body lean at 1 g sideways
  bodyPitch: 3, // degrees of nose lift at 1 g acceleration

  // Diorama camera (default): high 3/4 orthographic view
  dioPitch: 35, // degrees down (lower than a 45° isometric view: more of the street ahead)
  dioYaw: 28, // degrees – fixed viewing direction, turned a little from the map axis (0 = looking along +X)
  dioYawFollow: 0, // 1/s – slow swing behind the direction of travel (0 = fixed angle)
  dioZoom: 11, // m – half the visible height at a standstill…
  dioZoomFast: 16, // …and at top speed
  dioLead: 8, // m the view runs ahead along the velocity at top speed
  dioFollow: 4, // 1/s position smoothing

  // Chase camera "Za autem" (Kenney view.gd: position lerp delta*4, zoom 10 → 20 with speed)
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

// Normalny (default, demanding): ordinary steering keeps grip; a slide needs the handbrake at speed, a lift-off in a
// fast corner or full throttle with hard steering at higher speed. In the slide nothing holds the angle for you:
// counter-steer and throttle do (real counter-steer model), neglect it and the car spins, and the car has momentum.
const normal: Tuning = {
  ...base,
  driftMinSpeed: 11, // ≈ 40 km/h
  handbrakeSteer: 0.5,
  liftSpeed: 15, // ≈ 54 km/h
  liftSteer: 0.6,
  liftDrop: 0.6,
  liftWindow: 0.35,
  sharpSteer: 0.9,
  sharpThrottle: 0.9,
  sharpSpeed: 17, // ≈ 61 km/h
  sharpTime: 0.3,
  realCounter: 1,
  proGrow: 4,
  proGrowThrottle: 45,
  proThrottleNeutral: 0.45,
  proGrowHandbrake: 25,
  proSteer: 80,
  proSteerInto: 45,
  proSpinAngle: 65,
  proSpinTime: 1.4,
  transitionSteer: 0.55,
  driftExitDelay: 1.2, // the angle dynamics end the drift (caught / spun), not a timer
  driftSpeedLoss: 0.12,
  driftTurnSteer: 0.6,
  sideGripHigh: 12,
  driftSideGrip: 5,
  steerRateHigh: 1.0,
  turnSmoothing: 4,
};

export const presets: Record<string, Tuning> = {
  Łatwy: { ...base }, // accessibility: the assisted drift of v0.2–v0.3
  Normalny: normal,
  // Pro: harder still – higher entry thresholds, the tail comes round faster, spins earlier, less grip
  Pro: {
    ...normal,
    driftMinSpeed: 12,
    handbrakeSteer: 0.6,
    liftSpeed: 16,
    sharpSteer: 0.95,
    sharpThrottle: 0.95,
    sharpSpeed: 19,
    sharpTime: 0.4,
    proGrow: 8,
    proGrowThrottle: 55,
    proThrottleNeutral: 0.5,
    proSteer: 75,
    proSteerInto: 55,
    proSpinAngle: 55,
    proSpinTime: 1.6,
    transitionSteer: 0.45,
    driftSpeedLoss: 0.15,
    sideGripHigh: 9,
    driftSideGrip: 3.5,
  },
};
export const DEFAULT_PRESET = 'Normalny';
export const tuning: Tuning = { ...presets[DEFAULT_PRESET] };

export function applyPreset(name: string): Tuning {
  return Object.assign(tuning, presets[name]);
}

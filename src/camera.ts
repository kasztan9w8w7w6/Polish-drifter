import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { tuning as globalTuning, type Tuning } from './tuning.ts';

// Chase camera, based on Kenney's Starter Kit Racing view.gd (MIT): a pivot that eases towards the car
// (lerp delta*4) with a distance that grows with speed. Ours also swings behind the DIRECTION OF TRAVEL
// (in a drift you see where the car goes, not where the bonnet points), leads the look point along the
// velocity, widens the FOV with speed and shakes ("trauma" shake) at speed and on hits.

type CarState = { position: Vector3; quaternion: Quaternion; velocity: Vector3; speed: number; forwardSpeed: number };

const MODES = ['pościg', 'daleko', 'maska'] as const;
const TOP_SPEED = 30; // m/s used to normalise speed effects
const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));
const approachAngle = (value: number, target: number, rate: number, dt: number) =>
  value + Math.atan2(Math.sin(target - value), Math.cos(target - value)) * (1 - Math.exp(-rate * dt));

export function createCameraRig(camera: PerspectiveCamera, tuning: Tuning = globalTuning) {
  const t = tuning;
  const pivot = new Vector3();
  const look = new Vector3();
  const fwd = new Vector3();
  const tmp = new Vector3();
  let yaw = 0;
  let mode = 0;
  let trauma = 0;
  let time = 0;
  let first = true;

  function update(dt: number, s: CarState) {
    time += dt;
    fwd.set(1, 0, 0).applyQuaternion(s.quaternion);
    const heading = Math.atan2(-fwd.z, fwd.x);
    // Direction of travel when moving forwards, otherwise the bonnet
    const travel = s.speed > 3 && s.forwardSpeed > -1 ? Math.atan2(-s.velocity.z, s.velocity.x) : heading;
    const sf = MathUtils.clamp(s.speed / TOP_SPEED, 0, 1);

    if (first) {
      pivot.copy(s.position);
      yaw = heading;
      first = false;
    }
    pivot.x = approach(pivot.x, s.position.x, t.camFollow, dt);
    pivot.y = approach(pivot.y, s.position.y, t.camFollow, dt);
    pivot.z = approach(pivot.z, s.position.z, t.camFollow, dt);
    yaw = approachAngle(yaw, travel, t.camYawFollow, dt);

    const dirX = Math.cos(yaw), dirZ = -Math.sin(yaw);
    if (MODES[mode] === 'maska') {
      camera.position.set(0.3, 0.75, 0).applyQuaternion(s.quaternion).add(s.position);
      look.copy(fwd).multiplyScalar(20).add(camera.position);
    } else {
      const far = MODES[mode] === 'daleko' ? 1.7 : 1;
      const dist = MathUtils.lerp(t.camDistance, t.camDistanceFast, sf) * far;
      camera.position.set(pivot.x - dirX * dist, pivot.y + t.camHeight * far, pivot.z - dirZ * dist);
      // Look ahead along the velocity (not the bonnet)
      tmp.set(s.velocity.x, 0, s.velocity.z);
      if (tmp.lengthSq() > 1) tmp.normalize();
      look.copy(pivot).addScaledVector(tmp, t.camLead * sf);
      look.y += 0.8;
    }

    // Trauma shake: amount = trauma², smooth pseudo-noise from a few sines
    trauma = Math.max(0, trauma - dt * 1.5);
    const shake = Math.min(1, trauma * trauma + t.shakeSpeed * Math.max(0, sf - 0.6) / 0.4);
    const n = (a: number, b: number) => Math.sin(time * a) * 0.6 + Math.sin(time * b + 1.3) * 0.4;
    camera.position.x += shake * 0.25 * n(37, 23);
    camera.position.y += shake * 0.18 * n(41, 29);
    camera.position.z += shake * 0.25 * n(31, 47);
    camera.lookAt(look);
    camera.rotateZ(shake * 0.03 * n(19, 53));

    const fov = approach(camera.fov, MathUtils.lerp(t.fovBase, t.fovFast, sf * sf), 2, dt);
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    update,
    // impact in N from vehicle.state.impact
    hit(impact: number) {
      trauma = Math.min(1, trauma + (impact / 1.5e6) * t.shakeImpact);
    },
    nextMode() {
      mode = (mode + 1) % MODES.length;
      return MODES[mode];
    },
    reset() {
      first = true;
    },
  };
}

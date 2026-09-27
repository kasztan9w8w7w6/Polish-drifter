import { MathUtils, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3, type Fog } from 'three';
import { tuning as globalTuning, type Tuning } from './tuning.ts';

// Two cameras:
// - "Diorama" (default): high 3/4 orthographic view, fixed angle (or a very slow swing behind the car),
//   follows the car with a lead in the direction of travel, zooms out with speed. Its frustum is snapped
//   to the pixel grid (pixelAlignFrustum from the three.js example webgl_postprocessing_pixel, MIT),
//   so the low-res image doesn't shimmer while the camera moves.
// - "Za autem": chase camera based on Kenney's Starter Kit Racing view.gd (MIT): pivot eased towards the car
//   (lerp delta*4), distance growing with speed, swings behind the DIRECTION OF TRAVEL, leads the look point
//   along the velocity, FOV widens with speed.
// Both shake ("trauma") at speed and on hits, and both put the radial fog centre on their look point.

type CarState = { position: Vector3; quaternion: Quaternion; velocity: Vector3; speed: number; forwardSpeed: number };
export type View = { pixelsWide: number; pixelsHigh: number };

const MODES = ['Diorama', 'Za autem'] as const;
const TOP_SPEED = 30; // m/s used to normalise speed effects
const DIO_DISTANCE = 100; // m – the ortho camera sits this far from its target (distance doesn't change the size)
const DIO_DEPTH = 55; // m of depth kept in front of / behind the target (tight range = crisp depth outlines)
const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));
const approachAngle = (value: number, target: number, rate: number, dt: number) =>
  value + Math.atan2(Math.sin(target - value), Math.cos(target - value)) * (1 - Math.exp(-rate * dt));

export function createCameraRig(chase: PerspectiveCamera, dio: OrthographicCamera, fog: Fog | null, tuning: Tuning = globalTuning) {
  const t = tuning;
  const pivot = new Vector3();
  const look = new Vector3();
  const fwd = new Vector3();
  const tmp = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  let yaw = 0; // chase camera yaw
  let dioYaw = 0; // diorama yaw offset from its fixed angle (slow swing behind the car)
  let mode = 0;
  let trauma = 0;
  let time = 0;
  let first = true;
  let zoom = t.dioZoom;
  let zoomSmooth = t.dioZoom;

  function shakeAmount(sf: number) {
    return Math.min(1, trauma * trauma + t.shakeSpeed * Math.max(0, sf - 0.6) / 0.4);
  }
  const n = (a: number, b: number) => Math.sin(time * a) * 0.6 + Math.sin(time * b + 1.3) * 0.4;

  function update(dt: number, s: CarState, view: View) {
    time += dt;
    fwd.set(1, 0, 0).applyQuaternion(s.quaternion);
    const heading = Math.atan2(-fwd.z, fwd.x);
    // Direction of travel when moving forwards, otherwise the bonnet
    const travel = s.speed > 3 && s.forwardSpeed > -1 ? Math.atan2(-s.velocity.z, s.velocity.x) : heading;
    const sf = MathUtils.clamp(s.speed / TOP_SPEED, 0, 1);
    if (first) {
      pivot.copy(s.position);
      yaw = heading;
      dioYaw = 0;
      zoom = zoomSmooth = t.dioZoom;
      first = false;
    }
    trauma = Math.max(0, trauma - dt * 1.5);
    const shake = shakeAmount(sf);
    // velocity direction (flat), for the look-ahead
    tmp.set(s.velocity.x, 0, s.velocity.z);
    if (tmp.lengthSq() > 1) tmp.normalize();

    if (MODES[mode] === 'Diorama') {
      // Follow with feed-forward: the pivot moves with the car's velocity and eases the rest of the way, so
      // there is no steady lag at speed and the lead (view ahead of the car) really shows
      const follow = t.dioFollow;
      pivot.x = approach(pivot.x + s.velocity.x * dt, s.position.x + tmp.x * t.dioLead * sf, follow, dt);
      pivot.y = approach(pivot.y, s.position.y, follow, dt);
      pivot.z = approach(pivot.z + s.velocity.z * dt, s.position.z + tmp.z * t.dioLead * sf, follow, dt);
      // Fixed angle, or a very slow swing so the camera ends up behind the direction of travel
      if (t.dioYawFollow > 0 && s.speed > 5) dioYaw = approachAngle(dioYaw, travel - (t.dioYaw * Math.PI) / 180, t.dioYawFollow, dt);
      const a = (t.dioYaw * Math.PI) / 180 + dioYaw; // camera looks along this yaw
      const pitch = (t.dioPitch * Math.PI) / 180;
      // Zoom in discrete steps (1/16 of the range): every zoom change rescales the pixel grid, so it changes
      // rarely instead of drifting a little every frame
      const zStep = Math.max(0.25, (t.dioZoomFast - t.dioZoom) / 16);
      const zTarget = MathUtils.lerp(t.dioZoom, t.dioZoomFast, sf);
      zoomSmooth = approach(zoomSmooth, zTarget, 1.5, dt);
      if (Math.abs(zoomSmooth - zoom) > zStep * 0.75) zoom = Math.round(zoomSmooth / zStep) * zStep;
      look.copy(pivot);
      look.x += shake * 0.3 * n(37, 23);
      look.z += shake * 0.3 * n(31, 47);
      dio.position.set(
        look.x - Math.cos(a) * Math.cos(pitch) * DIO_DISTANCE,
        look.y + Math.sin(pitch) * DIO_DISTANCE,
        look.z + Math.sin(a) * Math.cos(pitch) * DIO_DISTANCE,
      );
      dio.lookAt(look);
      dio.near = DIO_DISTANCE - DIO_DEPTH;
      dio.far = DIO_DISTANCE + DIO_DEPTH;
      pixelAlign(view);
      if (fog) fog.near = DIO_DISTANCE;
      return dio;
    }

    // --- Chase camera ---
    pivot.x = approach(pivot.x, s.position.x, t.camFollow, dt);
    pivot.y = approach(pivot.y, s.position.y, t.camFollow, dt);
    pivot.z = approach(pivot.z, s.position.z, t.camFollow, dt);
    yaw = approachAngle(yaw, travel, t.camYawFollow, dt);
    const dirX = Math.cos(yaw), dirZ = -Math.sin(yaw);
    const dist = MathUtils.lerp(t.camDistance, t.camDistanceFast, sf);
    chase.position.set(pivot.x - dirX * dist, pivot.y + t.camHeight, pivot.z - dirZ * dist);
    look.copy(pivot).addScaledVector(tmp, t.camLead * sf);
    look.y += 0.8;
    chase.position.x += shake * 0.25 * n(37, 23);
    chase.position.y += shake * 0.18 * n(41, 29);
    chase.position.z += shake * 0.25 * n(31, 47);
    chase.lookAt(look);
    chase.rotateZ(shake * 0.03 * n(19, 53));
    const fov = approach(chase.fov, MathUtils.lerp(t.fovBase, t.fovFast, sf * sf), 2, dt);
    if (Math.abs(fov - chase.fov) > 0.01) {
      chase.fov = fov;
      chase.updateProjectionMatrix();
    }
    // Fog centre on the car: its distance along the view axis
    if (fog) fog.near = Math.max(1, tmp.copy(s.position).sub(chase.position).dot(chase.getWorldDirection(right)));
    return chase;
  }

  // Ortho frustum of half-height `zoom`, shifted by the sub-pixel part of the camera position so that
  // world-space pixels land on the same screen pixels from frame to frame (three.js pixel example).
  function pixelAlign(view: View) {
    const aspect = view.pixelsWide / view.pixelsHigh;
    const halfW = zoom * aspect;
    const pixelW = (2 * halfW) / view.pixelsWide;
    const pixelH = (2 * zoom) / view.pixelsHigh;
    dio.updateMatrixWorld();
    right.set(1, 0, 0).applyQuaternion(dio.quaternion);
    up.set(0, 1, 0).applyQuaternion(dio.quaternion);
    const px = dio.position.dot(right) / pixelW;
    const py = dio.position.dot(up) / pixelH;
    const fx = px - Math.round(px);
    const fy = py - Math.round(py);
    dio.left = -halfW - fx * pixelW;
    dio.right = halfW - fx * pixelW;
    dio.top = zoom - fy * pixelH;
    dio.bottom = -zoom - fy * pixelH;
    dio.zoom = 1;
    dio.updateProjectionMatrix();
  }

  return {
    update,
    get mode() {
      return MODES[mode];
    },
    // impact in N from vehicle.state.impact
    // speed (m/s) into the obstacle, vehicle.state.crash
    hit(speed: number) {
      trauma = Math.min(1, trauma + (speed / 20) * t.shakeImpact);
    },
    nextMode() {
      mode = (mode + 1) % MODES.length;
      first = true;
      return MODES[mode];
    },
    reset() {
      first = true;
    },
  };
}

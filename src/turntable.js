// Garage turntable (logic only, tested in Node): the car turns slowly on its own; dragging with the mouse or a finger
// turns it by hand, letting go leaves it spinning with inertia that dies out, and after a while without touching the
// slow automatic turn comes back (smoothly, no jump).
export const turntableSettings = {
  auto: 0.5, // rad/s the car turns on its own
  sensitivity: 0.012, // rad per screen pixel dragged
  friction: 2.2, // 1/s – how fast the flick dies out
  idle: 2.5, // s after letting go before the automatic turn comes back
  maxSpeed: 12, // rad/s cap for a wild flick
};

export function createTurntable(s = turntableSettings) {
  let dragging = false;
  let lastX = 0, lastT = 0;
  let speed = s.auto; // rad/s now
  let flick = 0; // measured drag speed, rad/s
  let idle = Infinity; // s since the last touch
  let pending = 0; // rad dragged since the last update

  return {
    grab(x, t) {
      dragging = true;
      lastX = x;
      lastT = t;
      flick = 0;
      speed = 0;
    },
    move(x, t) {
      if (!dragging) return;
      const d = (x - lastX) * s.sensitivity;
      pending += d;
      const dt = Math.max(1e-3, t - lastT);
      flick += (d / dt - flick) * Math.min(1, dt * 20); // smoothed, so one jittery event doesn't throw the car
      lastX = x;
      lastT = t;
    },
    release(t) {
      if (!dragging) return;
      dragging = false;
      // (a finger held still before lifting: no flick)
      speed = t - lastT > 0.1 ? 0 : Math.max(-s.maxSpeed, Math.min(s.maxSpeed, flick));
      idle = 0;
    },
    // → rotation to add this frame (rad)
    update(dt) {
      let turn = pending;
      pending = 0;
      if (!dragging) {
        idle += dt;
        // the flick dies out; after `idle` the slow turn comes back, easing in, in the direction it was last going
        if (idle > s.idle) speed += ((Math.sign(speed) || 1) * s.auto - speed) * Math.min(1, dt * 1.5);
        else speed *= Math.exp(-s.friction * dt);
        turn += speed * dt;
      }
      return turn;
    },
    get dragging() {
      return dragging;
    },
    get speed() {
      return speed;
    },
  };
}

// Drift scoring: points grow with slip angle * speed; a combo multiplier grows
// while the drift is sustained. Stop drifting for a moment -> points banked.
// Hit something mid-drift -> points lost.
const MIN_SPEED = 6; // m/s
const MIN_ANGLE = 12; // degrees
const BANK_DELAY = 1.2; // s without drifting before points are banked

export function createDriftScorer(onChange) {
  const state = { current: 0, combo: 1, total: 0, best: 0, angle: 0, drifting: false };
  let sinceDrift = Infinity;
  let comboTimer = 0;

  try {
    state.best = Number(localStorage.getItem('pd-best')) || 0;
  } catch {}

  function finish(kept) {
    if (state.current > 0) {
      if (kept) {
        state.total += Math.round(state.current * state.combo);
        if (state.total > state.best) {
          state.best = state.total;
          try { localStorage.setItem('pd-best', state.best); } catch {}
        }
      }
      onChange(kept ? 'banked' : 'lost', state);
    }
    state.current = 0;
    state.combo = 1;
    comboTimer = 0;
  }

  return {
    state,
    // forward/velocity: {x, z} vectors on the ground plane
    update(dt, forward, velocity, grounded) {
      const speed = Math.hypot(velocity.x, velocity.z);
      let angle = 0;
      if (speed > 0.5) {
        const dot = (forward.x * velocity.x + forward.z * velocity.z) / speed;
        angle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
      }
      state.angle = angle;
      // Going backwards (angle > 100) is not a drift.
      state.drifting = grounded && speed > MIN_SPEED && angle > MIN_ANGLE && angle < 100;

      if (state.drifting) {
        sinceDrift = 0;
        state.current += angle * speed * dt * 0.5;
        comboTimer += dt;
        state.combo = 1 + Math.floor(comboTimer / 2) * 0.5; // +0.5x every 2 s
        onChange('drifting', state);
      } else {
        sinceDrift += dt;
        if (sinceDrift > BANK_DELAY) finish(true);
      }
    },
    crash() {
      finish(false);
    },
  };
}

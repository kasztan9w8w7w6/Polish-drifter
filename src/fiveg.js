// 5G as atmosphere (logic only, tested in Node): near a mast (blocks with `maszt`, map `masty`) the headlights flicker,
// the radio hisses and crackles, the engine misfires now and then, the picture gets interference, and the narrator
// sometimes says something paranoid. No meter and no penalty – just the mood. Every effect has its own strength
// (fivegSettings, lil-gui "5G").
export const fivegSettings = {
  radius: 36, // m: how far a mast is felt
  lights: 1, // 0..1 strength of each effect
  noise: 1,
  engine: 1,
  image: 1,
  comment: 55, // s at least between two narrator remarks
};

// masts: [{ x, z }], rand: () => 0..1 (injectable for tests)
export function createFiveG(masts, s = fivegSettings, rand = Math.random) {
  let flick = 0; // s left of a headlight dip
  let flickLevel = 1;
  let misfire = 0; // s left of an engine misfire
  let crackle = 0;
  let since = Infinity; // s since the last remark
  let wasNear = false;
  const out = { level: 0, lights: 1, throttle: 1, noise: 0, crackle: 0, glitch: 0, say: false, mast: null };

  return {
    state: out,
    // → out: level 0..1 (1 at the mast), lights (×headlights), throttle (×throttle), noise, crackle (0..1), glitch (0..1), say (a remark now)
    update(dt, pos) {
      let best = Infinity, mast = null;
      for (const m of masts) {
        const d = Math.hypot(m.x - pos.x, m.z - pos.z);
        if (d < best) (best = d), (mast = m);
      }
      // smooth falloff: 0 at the radius, 1 close to the mast
      const t = Math.max(0, Math.min(1, 1 - best / s.radius));
      const level = t * t * (3 - 2 * t);
      out.level = level;
      out.mast = level > 0 ? mast : null;
      // headlights: random short dips, more often and deeper the closer you are
      if (flick > 0) flick -= dt;
      else if (rand() < level * 2.5 * dt) {
        flick = 0.05 + rand() * 0.25;
        flickLevel = 1 - (0.4 + 0.6 * rand()) * level;
      }
      out.lights = flick > 0 ? 1 - (1 - flickLevel) * s.lights : 1;
      // engine: a misfire (the throttle drops out for a moment) now and then
      if (misfire > 0) misfire -= dt;
      else if (rand() < level * 0.6 * dt) misfire = 0.08 + rand() * 0.15;
      out.throttle = misfire > 0 ? 1 - 0.85 * s.engine : 1;
      // hiss with crackles
      crackle = Math.max(0, crackle - dt * 8);
      if (rand() < level * 6 * dt) crackle = 0.6 + 0.4 * rand();
      out.noise = level * s.noise;
      out.crackle = crackle * level * s.noise;
      // picture interference: a base level plus bursts with the crackles
      out.glitch = Math.min(1, (level * 0.2 + crackle * level * 0.6) * s.image);
      // narrator: when you come close, not too often
      since += dt;
      const near = level > 0.35;
      out.say = near && !wasNear && since > s.comment;
      if (out.say) since = 0;
      wasNear = near;
      return out;
    },
  };
}

// Where the masts are: roofs of blocks with `maszt` and the free-standing ones (`masty`)
export function mastsOf(map) {
  return [...(map.blocks ?? []).filter((b) => b.maszt && b.collide !== false).map((b) => ({ x: b.x, z: b.z })), ...(map.masty ?? [])];
}

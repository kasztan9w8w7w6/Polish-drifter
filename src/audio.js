import { Howl, Howler } from 'howler';

// Engine, tyre screech and impact sounds with Howler.js. Sounds: Kenney Starter Kit Racing (CC0).
// Mapping follows Kenney's vehicle.gd (effect_engine / effect_trails / impact), with pitch driven by our
// virtual rpm instead of speed. Browsers block audio until a user gesture, so start() is called on the first key/click.
const BASE = `${import.meta.env.BASE_URL}assets/kenney/racing/audio/`;
const dbToGain = (db) => 10 ** (db / 20);
const lerp = (a, b, k) => a + (b - a) * k;

export const audioSettings = { volume: 0.7, engine: 1, skid: 1, impact: 1, warning: 1 };

export function createAudio() {
  let engine, skid, impact, engineId, skidId;
  let started = false;
  let engVol = 0, engRate = 0.5, skidVol = 0, skidRate = 1, engOn = 1;
  let impactCooldown = 0;

  function start() {
    if (started) return;
    started = true;
    engine = new Howl({ src: [`${BASE}engine.ogg`], loop: true, volume: 0 });
    skid = new Howl({ src: [`${BASE}skid.ogg`], loop: true, volume: 0 });
    impact = new Howl({ src: [`${BASE}impact.ogg`], volume: 0.5 });
    engineId = engine.play();
    skidId = skid.play();
  }

  return {
    start,
    get started() {
      return started;
    },
    // state: vehicle.state, load = rpm between idle (0) and redline (1) from gearbox, throttle 0..1, dt seconds
    update(dt, state, load, throttle, engineOn = true) {
      if (!started) return;
      Howler.volume(audioSettings.volume);
      const r = load;
      // Kenney: volume −15..−5 dB with speed/throttle, pitch 0.5..3
      engVol = lerp(engVol, dbToGain(-15 + 10 * Math.min(1, (r + throttle * 0.5) / 1.5)), Math.min(1, dt * 5));
      engRate = lerp(engRate, 0.6 + r * 1.6 + (throttle > 0.1 ? 0.1 : 0), Math.min(1, dt * 8));
      engOn = lerp(engOn, engineOn ? 1 : 0, Math.min(1, dt * 3)); // battery flat: the engine dies away
      engine.volume(engVol * engOn * audioSettings.engine, engineId);
      engine.rate(engRate, engineId);
      // Kenney: screech from drift intensity, −10..0 dB, pitch clamp(speed, 1, 3)
      const slip = Math.abs(state.slipAngle);
      const intensity = state.grounded && state.speed > 4 ? Math.min(1, Math.max(0, (slip - 8) / 30)) : 0;
      skidVol = lerp(skidVol, intensity > 0 ? dbToGain(-10 + 10 * intensity) : 0, Math.min(1, dt * 10));
      skidRate = lerp(skidRate, 0.8 + Math.min(1, state.speed / 25) * 0.5, 0.1);
      skid.volume(skidVol * audioSettings.skid, skidId);
      skid.rate(skidRate, skidId);
      impactCooldown -= dt;
    },
    // Paused (app in the background): silence everything
    mute(on) {
      Howler.mute(on);
    },
    // Low-battery warning: a short square-wave beep (Web Audio through Howler's context, no sound file)
    beep() {
      const ctx = Howler.ctx;
      if (!started || !ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 1320;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12 * audioSettings.warning, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(Howler.masterGain);
      o.start(t);
      o.stop(t + 0.14);
    },
    // speed in m/s into the obstacle (vehicle.state.crash); Kenney maps impact speed 0..6 to −20..0 dB
    hit(speed) {
      if (!started || speed < 1.5 || impactCooldown > 0) return;
      impactCooldown = 0.25;
      const id = impact.play();
      impact.volume(dbToGain(-20 + 20 * Math.min(1, speed / 6)) * audioSettings.impact, id);
      impact.rate(0.9 + Math.random() * 0.2, id);
    },
  };
}

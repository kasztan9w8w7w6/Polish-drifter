import { Howl, Howler } from 'howler';

// Car radio (plan-mvp §9, biblia VIII): four stations, music only, no presenters. TECHNO is the hero's station (the
// start and the end of the night), DAD_ROCK is Kamil's (sc. 6), DISCO_POLO and RAP play in town.
// Until the real tracks exist (12 pastiches, docs/muzyka.md) every station plays a quiet placeholder loop made in
// Web Audio (a beat and one repeated motif in the station's style). Tracks put in public/muzyka/ and listed in
// public/muzyka/lista.json replace the loop of their station – no code change.
// The radio ducks while someone in the car talks (a passenger, not asleep), and says the station's name on the HUD.
export const STACJE = ['TECHNO', 'RAP', 'DISCO_POLO', 'DAD_ROCK'];
export const radioSettings = { glosnosc: 0.55, sciszenie: 0.3 };

const STYL = {
  TECHNO: { bpm: 128, root: 43, kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [], bass: [0, 0, 7, 0, 0, 12, 0, 10], stab: [], chord: [0, 3, 7] },
  RAP: { bpm: 88, root: 45, kick: [0, 7, 10], hat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], bass: [0, null, null, 0, null, null, 3, null], stab: [0], chord: [0, 3, 7, 10] },
  DISCO_POLO: { bpm: 132, root: 48, kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [4, 12], bass: [0, 7, 0, 7, 5, 12, 5, 12], stab: [2, 6, 10, 14], chord: [0, 4, 7] },
  DAD_ROCK: { bpm: 100, root: 40, kick: [0, 8, 10], hat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], bass: [0, 0, 0, 0, 5, 5, 3, 3], stab: [0, 8], chord: [0, 7, 12] },
};
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createRadio({ base = import.meta.env?.BASE_URL ?? '/' } = {}) {
  let ctx = null, out = null, stacja = 'TECHNO', on = true;
  let duck = 0, gasnie = false, fade = 1, nextT = 0, step = 0, noise = null;
  let lista = {};
  let howl = null, howlStation = null, trackIndex = {};
  fetch(`${base}muzyka/lista.json`).then((r) => (r.ok ? r.json() : {})).then((j) => (lista = j ?? {})).catch(() => {});

  function init() {
    if (ctx || !Howler.ctx) return !!ctx;
    ctx = Howler.ctx;
    out = ctx.createGain();
    out.gain.value = 0;
    out.connect(Howler.masterGain);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    nextT = ctx.currentTime + 0.1;
    return true;
  }
  const env = (g, t, peak, len) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  };
  function tone(type, f, t, len, peak, filter = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    let node = o;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filter;
      node = o.connect(lp);
    }
    node.connect(g).connect(out);
    env(g, t, peak, len);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }
  function hit(kind, t) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    src.connect(f).connect(g).connect(out);
    env(g, t, kind === 'hat' ? 0.05 : 0.18, kind === 'hat' ? 0.04 : 0.14);
    src.start(t);
    src.stop(t + 0.2);
  }
  function kick(t) {
    const o = tone('sine', 120, t, 0.28, 0.6);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
  }
  // one 16th of the placeholder loop
  function schedule(t) {
    const s = STYL[stacja];
    const k = step % 16;
    if (s.kick.includes(k)) kick(t);
    if (s.hat.includes(k)) hit('hat', t);
    if (s.snare.includes(k)) hit('snare', t);
    const b = s.bass[Math.floor(k / 2)];
    if (k % 2 === 0 && b !== null && b !== undefined) tone(stacja === 'DAD_ROCK' ? 'sawtooth' : 'sawtooth', midi(s.root + b), t, 60 / s.bpm / 2.2, stacja === 'TECHNO' ? 0.12 : 0.09, stacja === 'TECHNO' ? 500 + 300 * Math.sin(step / 16) : 900);
    if (s.stab.includes(k)) for (const n of s.chord) tone(stacja === 'DISCO_POLO' ? 'square' : 'triangle', midi(s.root + 24 + n), t, stacja === 'DAD_ROCK' ? 0.9 : 0.18, 0.025, 2400);
    step++;
  }
  function useTrack() {
    const files = lista[stacja];
    if (!files?.length) {
      howl?.stop();
      howl = null;
      howlStation = null;
      return false;
    }
    if (howlStation === stacja && howl) return true;
    howl?.stop();
    const i = (trackIndex[stacja] ?? -1) + 1;
    trackIndex[stacja] = i % files.length;
    howl = new Howl({ src: [`${base}muzyka/${files[trackIndex[stacja]]}`], html5: false, volume: 0, onend: () => ((howlStation = null), useTrack()) });
    howl.play();
    howlStation = stacja;
    return true;
  }
  // a short burst of static when the station changes
  function trzask() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    f.type = 'bandpass';
    f.frequency.value = 2500;
    src.connect(f).connect(g).connect(Howler.masterGain);
    env(g, t, 0.06 * radioSettings.glosnosc, 0.25);
    src.start(t);
    src.stop(t + 0.3);
  }

  return {
    get stacja() {
      return stacja;
    },
    set(name) {
      if (!STACJE.includes(name) || name === stacja) return;
      stacja = name;
      step = 0;
      trzask();
    },
    next() {
      this.set(STACJE[(STACJE.indexOf(stacja) + 1) % STACJE.length]);
      return stacja;
    },
    // 0..1: how much quieter (someone talking in the car)
    duck(level) {
      duck = level;
    },
    // the end screen: the song plays to its end, then quiet
    wygas(on = true) {
      gasnie = on;
      if (!on) fade = 1;
    },
    power(v) {
      on = v;
    },
    update(dt) {
      if (!init()) return;
      if (gasnie) fade = Math.max(0, fade - dt / 25); // (about one song's ending)
      const target = on ? radioSettings.glosnosc * (1 - duck * (1 - radioSettings.sciszenie)) * fade : 0;
      const hasTrack = useTrack();
      if (hasTrack) {
        howl?.volume(target);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      out.gain.setTargetAtTime(target * 0.9, ctx.currentTime, 0.15);
      const sixteenth = 60 / STYL[stacja].bpm / 4;
      if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05; // (after a pause)
      while (nextT < ctx.currentTime + 0.2) {
        schedule(nextT);
        nextT += sixteenth;
      }
    },
  };
}

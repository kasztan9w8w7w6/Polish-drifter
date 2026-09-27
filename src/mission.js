import { clean } from './typewriter.js';

// Mission runner (logic only, tested in Node). Missions are data files (src/missions/*.json): steps with goals and
// the narrator's lines, so new ones need no code.
//
// Step types:
//   reach   – get to map point `point` (map.points: x, z, r); with `stop: true` you also have to stop there
//   battery – charge the battery to at least `min` %
//   wait    – `time` seconds (lets the narrator talk)
//   talk    – stop by character `npc` and talk (dialogue `dialog`, src/story/dialogi); with `result` the talk has to end
//             that way (e.g. "zgoda"), otherwise `refuse` lines are said and the step waits for another talk
//   score   – drift at least `min` points inside zone `point` within `time` s (the clock starts on entering the zone);
//             time up → `fail` lines, a short pause, and another try
//   race    – race rival `rival` on map route `route`, `laps` laps (race.js drives it; main.js reports won / lost);
//             lost → `fail` lines and the race starts again
// Every step can have `goal` (short text on the HUD), `say` (narrator lines when it starts) and `done` (when it ends).
// `hints`: lines said on game events – { "on": "low" | "warn" | "dead" | "respawn" | "shop", "say": [...], "once": true }.
// Texts in mission files are for the scriptwriter to replace: docs/teksty.md.

const STOP_SPEED = 1.5; // m/s – "stopped" for a reach step with stop: true
const RETRY_PAUSE = 3; // s after a failed score step before the next try

// points: map points plus the characters' spots ("npc:seba"); texts: src/story/teksty.json (system lines)
export function createMission(def, points, texts = {}) {
  const state = {
    index: -1,
    step: null,
    stepTime: 0,
    time: 0,
    running: false,
    complete: false,
    startScore: 0,
    summary: null,
    show: null, // score step: { inside, clock, points, pause }
    raceResult: null,
  };
  const used = new Set(); // hints already said (once)

  const target = () => {
    const id = state.step?.type === 'talk' ? `npc:${state.step.npc}` : state.step?.point;
    const p = id ? points[id] : null;
    return p ? { r: 3, ...p, id } : null;
  };

  function enter(i, events) {
    state.index = i;
    state.step = def.steps[i] ?? null;
    state.stepTime = 0;
    state.show = state.step?.type === 'score' ? { inside: false, clock: 0, points: 0, pause: 0, last: null } : null;
    state.raceResult = null;
    if (!state.step) return;
    if (state.step.say) events.push({ type: 'say', lines: state.step.say });
    events.push({ type: 'step', step: state.step, index: i });
  }

  // score: drift points so far (drift.js total + what is still being scored)
  function start(score = 0) {
    const events = [];
    state.time = 0;
    state.running = true;
    state.complete = false;
    state.summary = null;
    state.startScore = score;
    used.clear();
    if (def.intro) events.push({ type: 'say', lines: def.intro });
    enter(0, events);
    return events;
  }

  // car.talk: { npc, dialog, result } on the frame a talk ends
  function done(step, car, events) {
    switch (step.type) {
      case 'talk': {
        const t = car.talk;
        if (!t || t.npc !== step.npc || (step.dialog && t.dialog !== step.dialog)) return false;
        if (step.result && t.result !== step.result) {
          if (step.refuse) events.push({ type: 'say', lines: step.refuse });
          return false;
        }
        return true;
      }
      case 'score':
        return scoreStep(step, car, events);
      case 'race': {
        if (car.race === 'won') return true;
        if (car.race === 'lost' && state.raceResult !== 'lost') {
          state.raceResult = 'lost';
          if (step.fail) events.push({ type: 'say', lines: step.fail });
          events.push({ type: 'retry', step });
        }
        if (car.race !== 'lost') state.raceResult = null;
        return false;
      }
      case 'reach': {
        const p = points[step.point];
        const near = Math.hypot(car.x - p.x, car.z - p.z) <= (step.r ?? p.r ?? 4);
        return near && (!step.stop || car.speed < STOP_SPEED);
      }
      case 'battery':
        return car.battery >= step.min;
      case 'wait':
        return state.stepTime >= step.time;
      default:
        return true;
    }
  }

  // Drift show: points count only inside the zone, the clock runs from entering it
  function scoreStep(step, car, events) {
    const sh = state.show;
    const p = points[step.point];
    const inside = Math.hypot(car.x - p.x, car.z - p.z) <= (step.r ?? p.r ?? 20);
    if (sh.pause > 0) {
      sh.pause -= car.dt ?? 0;
      sh.last = car.score;
      return false;
    }
    if (inside && sh.last !== null) {
      sh.points = Math.max(0, sh.points + (car.score - sh.last));
      if (!sh.inside) events.push({ type: 'show-start', step });
      sh.inside = true;
    }
    sh.last = car.score;
    if (sh.inside) sh.clock += car.dt ?? 0;
    if (sh.points >= step.min) return true;
    if (sh.inside && sh.clock >= step.time) {
      if (step.fail) events.push({ type: 'say', lines: step.fail });
      events.push({ type: 'retry', step });
      Object.assign(sh, { inside: false, clock: 0, points: 0, pause: RETRY_PAUSE });
    }
    return false;
  }

  // car: { x, z, speed (m/s), battery (%), score, talk?: { npc, dialog, result }, race?: 'won' | 'lost' | null }
  function update(dt, car) {
    const events = [];
    if (!state.running) return events;
    state.time += dt;
    state.stepTime += dt;
    // (a loop: several quick steps can finish in one frame, e.g. a battery step that is already met)
    car = { ...car, dt };
    for (let guard = 0; state.step && guard < 10 && done(state.step, car, events); guard++) {
      if (state.step.done) events.push({ type: 'say', lines: state.step.done });
      enter(state.index + 1, events);
    }
    if (!state.step) {
      state.running = false;
      state.complete = true;
      state.summary = { title: clean(def.title), id: def.id, time: state.time, driftPoints: Math.max(0, Math.round(car.score - state.startScore)) };
      if (def.outro) events.push({ type: 'say', lines: def.outro });
      events.push({ type: 'complete', summary: state.summary });
    }
    return events;
  }

  // Game events (survival.js / main.js) → narrator hints
  function notify(name) {
    const events = [];
    if (!state.running) return events;
    (def.hints ?? []).forEach((h, i) => {
      if (h.on !== name || (h.once && used.has(i))) return;
      used.add(i);
      events.push({ type: 'say', lines: h.say });
    });
    return events;
  }

  // "Kontynuuj": start again at step `index` (saved progress)
  function resume(index, score = 0) {
    const events = start(score);
    const lines = events.filter((e) => e.type === 'say').length;
    events.splice(0, events.length);
    if (lines && index > 0 && texts.powrot) events.push({ type: 'say', lines: [].concat(texts.powrot) });
    enter(Math.min(index, def.steps.length - 1), events);
    return events;
  }

  // Which dialogue a character uses now: the current talk step's, or null (their everyday one, postacie.json)
  const dialogFor = (npc) => (state.running && state.step?.type === 'talk' && state.step.npc === npc ? state.step.dialog ?? null : null);

  return { def, state, start, resume, update, notify, target, dialogFor, get goal() { return clean(state.step?.goal ?? ''); } };
}

// "2:05" for the summary
export function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

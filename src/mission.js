// Mission runner (logic only, tested in Node). Missions are data files (src/missions/*.json): steps with goals and
// the narrator's lines, so new ones need no code.
//
// Step types:
//   reach   – get to map point `point` (map.points: x, z, r); with `stop: true` you also have to stop there
//   battery – charge the battery to at least `min` %
//   wait    – `time` seconds (lets the narrator talk)
// Every step can have `goal` (short text on the HUD), `say` (narrator lines when it starts) and `done` (when it ends).
// `hints`: lines said on game events – { "on": "low" | "warn" | "dead" | "respawn" | "shop", "say": [...], "once": true }.

const STOP_SPEED = 1.5; // m/s – "stopped" for a reach step with stop: true

export function createMission(def, points) {
  const state = {
    index: -1,
    step: null,
    stepTime: 0,
    time: 0,
    running: false,
    complete: false,
    startScore: 0,
    summary: null,
  };
  const used = new Set(); // hints already said (once)

  const target = () => {
    const p = state.step?.point ? points[state.step.point] : null;
    return p ? { ...p, id: state.step.point } : null;
  };

  function enter(i, events) {
    state.index = i;
    state.step = def.steps[i] ?? null;
    state.stepTime = 0;
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

  function done(step, car) {
    switch (step.type) {
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

  // car: { x, z, speed (m/s), battery (%), score }
  function update(dt, car) {
    const events = [];
    if (!state.running) return events;
    state.time += dt;
    state.stepTime += dt;
    // (a loop: several quick steps can finish in one frame, e.g. a battery step that is already met)
    for (let guard = 0; state.step && guard < 10 && done(state.step, car); guard++) {
      if (state.step.done) events.push({ type: 'say', lines: state.step.done });
      enter(state.index + 1, events);
    }
    if (!state.step) {
      state.running = false;
      state.complete = true;
      state.summary = { title: def.title, time: state.time, driftPoints: Math.max(0, Math.round(car.score - state.startScore)) };
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
    if (lines && index > 0) events.push({ type: 'say', lines: ['Wracasz. Mgła ta sama, maszt ten sam, bateria prawie ta sama.'] });
    enter(Math.min(index, def.steps.length - 1), events);
    return events;
  }

  return { def, state, start, resume, update, notify, target, get goal() { return state.step?.goal ?? ''; } };
}

// "2:05" for the summary
export function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

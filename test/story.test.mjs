// v0.5b: dialogues, the campaign, missions 2 "Pokaz" and 3 "Wyścig z sąsiadem", the race, the onlookers, texts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createDialogue } from '../src/dialogue.js';
import { createMission } from '../src/mission.js';
import { createCampaign } from '../src/campaign.js';
import { createRoute, createRace, createTracker } from '../src/race.js';
import { createCrowd } from '../src/crowd.js';
import { clean } from '../src/typewriter.js';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const map = json('../src/maps/osiedle.json');
const people = json('../src/story/postacie.json').postacie;
const dialogs = Object.fromEntries(readdirSync(new URL('../src/story/dialogi/', import.meta.url)).map((f) => [f.replace('.json', ''), json(`../src/story/dialogi/${f}`)]));
const missions = Object.fromEntries(readdirSync(new URL('../src/missions/', import.meta.url)).map((f) => [f.replace('.json', ''), json(`../src/missions/${f}`)]));
const campaign = json('../src/story/kampania.json');
const points = { ...map.points, ...Object.fromEntries(map.npcs.map((n) => [`npc:${n.id}`, { x: n.x, z: n.z, r: 4 }])) };
const fmt = (n, d = 1) => Number(n).toFixed(d);
const DT = 1 / 60;

// Talk through a dialogue: `picks` = choice index per choice node on the way
function talk(def, picks = []) {
  const d = createDialogue(def);
  const said = [];
  let end = null;
  for (let guard = 0; guard < 200 && !end; guard++) {
    for (let i = 0; i < 400 && !d.state.choices && d.state.text.length < clean(d.state.node?.text).length; i++) d.update(DT);
    said.push(`${d.who}: ${d.state.text}`);
    const ev = d.state.choices ? d.choose(picks.shift() ?? 0) : d.advance();
    end = ev.find((e) => e.type === 'end');
  }
  return { said, result: end?.result, flags: end?.flags };
}

test('dialogi: węzły, wybory z rozgałęzieniem, wynik rozmowy, E kończy pisanie', (t) => {
  const yes = talk(dialogs['pokaz-start'], [0]);
  const why = talk(dialogs['pokaz-start'], [1, 0]);
  const no = talk(dialogs['pokaz-start'], [2]);
  t.diagnostic(`„${yes.said[0]}” … wybór 1 → ${yes.result} (flagi ${JSON.stringify(yes.flags)}); wybór 2 → dopytanie (${why.said.length} kwestie) → ${why.result}; wybór 3 → ${no.result}`);
  assert.equal(yes.result, 'zgoda');
  assert.equal(yes.flags.pokaz, true);
  assert.equal(why.result, 'zgoda');
  assert.ok(why.said.length > yes.said.length);
  assert.equal(no.result, 'odmowa');
  // E while typing shows the whole line at once; the choices appear only after the text
  const d = createDialogue(dialogs['pokaz-start']);
  d.update(0.2);
  assert.ok(d.state.text.length > 0 && d.state.text.length < 10);
  d.advance();
  assert.equal(d.state.text, clean(dialogs['pokaz-start'].nodes.a.text));
  assert.equal(d.state.choices, null);
  // every dialogue file: every node reachable ends, every speaker exists
  for (const [id, def] of Object.entries(dialogs)) {
    for (const [nid, n] of Object.entries(def.nodes)) {
      assert.ok(n.who === 'gracz' || people[n.who], `${id}/${nid}: kto mówi? ${n.who}`);
      for (const next of [n.next, ...(n.choices ?? []).map((c) => c.next)].filter(Boolean)) assert.ok(def.nodes[next], `${id}/${nid} → ${next}`);
    }
    assert.ok(talk(def).result, id);
  }
});

test('postacie i kampania: każda postać na mapie ma dane i rozmowę, misje w kolejności, Kontynuuj', (t) => {
  for (const n of map.npcs) {
    assert.ok(people[n.id], n.id);
    assert.ok(dialogs[people[n.id].dialog], `${n.id}: rozmowa ${people[n.id].dialog}`);
  }
  const c = createCampaign(campaign, missions);
  t.diagnostic(`kolejność: ${c.order.join(' → ')}; postacie na mapie: ${map.npcs.map((n) => people[n.id].imie).join(', ')}`);
  assert.deepEqual(c.order, ['paczka', 'pokaz', 'wyscig']);
  assert.equal(c.next('paczka'), 'pokaz');
  assert.equal(c.next('wyscig'), null);
  assert.deepEqual(c.resume(null), { mission: 'paczka', step: 0 });
  assert.deepEqual(c.resume({ mission: 'wyscig', step: 1 }), { mission: 'wyscig', step: 1 });
  assert.deepEqual(c.resume({ mission: 'nieznana', step: 3 }), { mission: 'paczka', step: 0 });
  // every step's points, characters, dialogues and routes exist
  for (const m of Object.values(missions)) {
    assert.ok(points[m.start.point], `${m.id}: start`);
    for (const s of m.steps) {
      if (s.point) assert.ok(points[s.point], `${m.id}/${s.id}: ${s.point}`);
      if (s.npc) assert.ok(points[`npc:${s.npc}`] && dialogs[s.dialog], `${m.id}/${s.id}: ${s.npc} ${s.dialog}`);
      if (s.route) assert.ok(map.routes[s.route] && people[s.rival]?.auto, `${m.id}/${s.id}: ${s.route}`);
    }
  }
});

test('misja 2 „Pokaz”: rozmowa (odmowa czeka), drift w strefie na czas, porażka = kolejna próba', (t) => {
  const m = createMission(missions.pokaz, points);
  const log = [];
  const run = (ev) => ev.forEach((e) => log.push(e.type === 'say' ? 'say' : e.type === 'step' ? `[${e.step.id}]` : e.type));
  run(m.start(0));
  const seba = points['npc:seba'];
  assert.deepEqual({ x: m.target().x, z: m.target().z }, { x: seba.x, z: seba.z }, 'cel = Seba');
  const car = { x: seba.x + 2, z: seba.z, speed: 0, battery: 80, score: 0 };
  run(m.update(DT, { ...car, talk: { npc: 'seba', dialog: 'pokaz-start', result: 'odmowa' } }));
  assert.equal(m.state.step.id, 'plac', 'odmowa: krok czeka');
  run(m.update(DT, { ...car, talk: { npc: 'seba', dialog: 'pokaz-start', result: 'zgoda' } }));
  assert.equal(m.state.step.id, 'drift');
  // Points outside the zone don't count
  const lot = points.lot;
  let score = 0;
  for (let i = 0; i < 120; i++) run(m.update(DT, { ...car, score: (score += 20) }));
  assert.equal(m.state.show.points, 0, 'poza placem się nie liczy');
  // In the zone, too slow: 30 pts/s for 60 s = 1800 < 3000 → fail and another try
  const inLot = { ...car, x: lot.x, z: lot.z, speed: 10 };
  let failedAt = 0;
  for (let i = 0; i < 61 * 60 && m.state.step.id === 'drift' && !log.includes('retry'); i++) {
    failedAt = m.state.show.points;
    run(m.update(DT, { ...inLot, score: (score += 0.5) }));
  }
  assert.ok(log.includes('retry'), 'czas minął = porażka');
  // Wait out the pause, then a good show: 80 pts/s → 3000 in ~38 s
  let tDone = 0;
  for (let i = 0; i < 70 * 60 && m.state.step.id === 'drift'; i++) {
    run(m.update(DT, { ...inLot, score: (score += 80 / 60) }));
    tDone = m.state.show?.clock ?? tDone;
  }
  assert.equal(m.state.step.id, 'gratulacje');
  run(m.update(DT, { ...car, talk: { npc: 'seba', dialog: 'pokaz-koniec', result: 'koniec' } }));
  t.diagnostic(`${log.join(' ')}; pierwsza próba: ${fmt(failedAt, 0)} pkt po 60 s, druga: 3000 pkt w ${fmt(tDone)} s`);
  assert.ok(m.state.complete);
});

test('wyścig: trasa po ulicach, okrążenia, przeciwnik bez teleportów, dopasowanie tempa, bez skrótów', (t) => {
  const route = createRoute(map.routes.petla);
  // the smoothed route stays on the streets (within 5 m of a road's axis)
  const onRoad = (x, z) => map.roads.some(([[x1, z1], [x2, z2]]) => {
    const lx = Math.min(x1, x2) - 5, hx = Math.max(x1, x2) + 5, lz = Math.min(z1, z2) - 5, hz = Math.max(z1, z2) + 5;
    return x >= lx && x <= hx && z >= lz && z <= hz;
  });
  for (let s = 0; s < route.length; s += 2) {
    const p = route.at(s);
    assert.ok(onRoad(p.x, p.z), `trasa na ulicy przy s = ${fmt(s)} (${fmt(p.x)}, ${fmt(p.z)})`);
  }
  // A scripted player driving the route at a steady speed
  const drive = (speed, laps = 2) => {
    const race = createRace(route, { laps });
    let s = -8, maxJump = 0, prev = { ...race.rival.state }, rivalTop = 0, maxGap = 0, t = 0;
    while (!race.state.result && t < 400) {
      if (race.state.time >= 0) s += speed * DT;
      const p = route.at(s);
      const rx = -p.dz, rz = p.dx; // left lane
      race.update(DT, { x: p.x - rx * 1.8, z: p.z - rz * 1.8, speed: race.state.time >= 0 ? speed : 0 });
      const r = race.rival.state;
      maxJump = Math.max(maxJump, Math.hypot(r.x - prev.x, r.z - prev.z));
      rivalTop = Math.max(rivalTop, r.speed);
      maxGap = Math.max(maxGap, Math.abs(race.state.gap));
      prev = { ...r };
      t += DT;
    }
    return { result: race.state.result, time: race.state.time, maxJump, rivalTop, maxGap, lap: race.state.lap };
  };
  const fast = drive(24), slow = drive(11), even = drive(17);
  t.diagnostic(`trasa ${fmt(route.length, 0)} m; gracz 86 km/h: ${fast.result} po ${fmt(fast.time)} s (maks. różnica ${fmt(fast.maxGap, 0)} m); 40 km/h: ${slow.result}; 61 km/h: ${even.result}, różnica maks. ${fmt(even.maxGap, 0)} m; przeciwnik maks. ${fmt(slow.rivalTop * 3.6, 0)} km/h, największy skok w klatce ${fmt(fast.maxJump, 2)} m`);
  assert.equal(fast.result, 'won');
  assert.equal(slow.result, 'lost');
  assert.ok(fast.maxJump < 0.6, 'przeciwnik nie teleportuje się (≤ 36 m/s)');
  assert.ok(even.maxGap < 80, 'tempo dopasowane: przeciwnik nie odjeżdża daleko');
  // Shortcut across the middle: no progress
  const tr = createTracker(route);
  tr.update(route.at(20).x, route.at(20).z);
  for (let s = 20; s < 60; s += 1) tr.update(route.at(s).x, route.at(s).z);
  const before = tr.total;
  tr.update(-15, 0); // the yard between the blocks
  tr.update(route.at(route.length / 2).x, route.at(route.length / 2).z); // teleported half a lap on
  t.diagnostic(`skrót przez podwórko: postęp ${fmt(before, 0)} → ${fmt(tr.total, 0)} m`);
  assert.ok(Math.abs(tr.total - before) < 45, 'skrót nie daje postępu');
});

test('misja 3 „Wyścig z sąsiadem”: rozmowa, przegrana = od nowa, wygrana, rozmowa na mecie', (t) => {
  const m = createMission(missions.wyscig, points);
  const log = [];
  const run = (ev) => ev.forEach((e) => log.push(e.type === 'step' ? `[${e.step.id}]` : e.type));
  run(m.start(0));
  const car = { x: 0, z: 0, speed: 0, battery: 80, score: 0 };
  run(m.update(DT, { ...car, talk: { npc: 'zbyszek', dialog: 'wyscig-start', result: 'start' } }));
  assert.equal(m.state.step.type, 'race');
  run(m.update(DT, { ...car, race: 'lost' }));
  run(m.update(DT, { ...car, race: 'lost' })); // (reported once per defeat)
  run(m.update(DT, { ...car, race: null }));
  run(m.update(DT, { ...car, race: 'won' }));
  run(m.update(DT, { ...car, talk: { npc: 'zbyszek', dialog: 'wyscig-koniec', result: 'koniec' } }));
  t.diagnostic(log.join(' '));
  assert.equal(log.filter((x) => x === 'retry').length, 1);
  assert.ok(m.state.complete);
});

test('chłopaki przy placu: dawaj przy dobrym drifcie, słabo przy słabym, reakcja na uderzenie', (t) => {
  const c = createCrowd();
  const shouts = [];
  const feed = (sec, car, show = true) => { for (let i = 0; i < sec * 60; i++) { const k = c.update(DT, { inZone: true, crash: 0, ...car }, show); if (k) shouts.push(k); } };
  feed(4, { drifting: true, angle: 35, speed: 14 });
  const good = shouts.filter((k) => k === 'dobrze').length;
  shouts.length = 0;
  feed(4, { drifting: true, angle: 14, speed: 10 });
  const weak = shouts.filter((k) => k === 'slabo').length;
  shouts.length = 0;
  feed(0.1, { drifting: false, angle: 0, speed: 10, crash: 8 });
  const hit = shouts[0];
  shouts.length = 0;
  feed(3, { drifting: true, angle: 40, speed: 15, inZone: false });
  t.diagnostic(`4 s dobrego driftu: ${good}× „dobrze”; 4 s nieśmiałego: ${weak}× „słabo”; uderzenie: ${hit}; poza placem: ${shouts.length}`);
  assert.ok(good >= 1 && good <= 2);
  assert.ok(weak >= 1);
  assert.equal(hit, 'uderzenie');
  assert.equal(shouts.length, 0);
});

test('teksty: każdy tekst w misjach, rozmowach i postaciach oznaczony PLACEHOLDER', (t) => {
  const texts = [];
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if (['say', 'done', 'intro', 'outro', 'goal', 'title', 'refuse', 'fail', 'text', 'koniec', 'dobrze', 'slabo', 'uderzenie', 'czekanie'].includes(key)) texts.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  const files = [...Object.values(missions), ...Object.values(dialogs), json('../src/story/postacie.json'), campaign];
  for (const f of files) {
    assert.match(f._teksty ?? '', /^PLACEHOLDER/, `${f.id ?? 'plik'}: znacznik _teksty`);
    walk(f);
  }
  const bare = texts.filter((s) => !s.startsWith('PLACEHOLDER'));
  t.diagnostic(`${texts.length} tekstów w ${files.length} plikach, bez znacznika: ${bare.length}; gracz widzi: „${clean(texts[0])}”`);
  assert.deepEqual(bare, []);
  assert.ok(!clean(texts[0]).includes('PLACEHOLDER'));
});

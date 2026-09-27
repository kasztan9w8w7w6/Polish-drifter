// v0.6d: fuel, cash, respect (economy.js) instead of the battery; dialogue conditions; missions unlocked by respect
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEconomy, economySettings as S } from '../src/economy.js';
import { createDrivetrain } from '../src/engine.js';
import { createDialogue, when } from '../src/dialogue.js';
import car from '../src/cars/polonez.json' with { type: 'json' };
import gle from '../src/engines/fso-16-gle.json' with { type: 'json' };
import teksty from '../src/story/teksty.json' with { type: 'json' };
import kampania from '../src/story/kampania.json' with { type: 'json' };
import seba from '../src/story/dialogi/seba.json' with { type: 'json' };
import halina from '../src/story/dialogi/halina.json' with { type: 'json' };
import paczka from '../src/missions/paczka.json' with { type: 'json' };
import pokaz from '../src/missions/pokaz.json' with { type: 'json' };
import wyscig from '../src/missions/wyscig.json' with { type: 'json' };

const fmt = (n, d = 1) => Number(n).toFixed(d);

// "Normal play": 5 s full gas, 6 s half, 3 s drifting, 2 s coasting, 2 s braking, on the real powertrain (fun 1.7)
function play(eco, maxS = 3600) {
  const d = createDrivetrain(car.real, gle, { fun: 1.7, shiftTime: 0.6, engineBrake: 0.12 });
  let v = 0, t = 0;
  const dt = 1 / 30;
  while (!eco.state.empty && t < maxS) {
    const c = t % 18;
    const r = d.update(dt, v, c < 5 ? 1 : c < 11 ? 0.5 : c < 14 ? 0.85 : 0);
    v = Math.max(0, Math.min(v + r.accel * dt, c < 11 ? 30 : 14));
    if (c >= 16) v = Math.max(0, v - 8 * dt);
    eco.update(dt, { rpm: r.rpm, load: r.load, drifting: c >= 11 && c < 14, running: true });
    t += dt;
  }
  return t;
}

test('paliwo: pełny bak starcza na 8–12 min zwykłej gry, drift pali więcej, rezerwa, pusty bak gasi silnik', (t) => {
  const eco = createEconomy({ engine: gle, tankL: car.real.tankL });
  const events = [];
  const upd = eco.update;
  eco.update = (dt, c) => { const e = upd(dt, c); events.push(...e); return e; };
  const minutes = play(eco) / 60;
  const idle = eco.flow(900, 0.05), drive = eco.flow(3500, 0.6), drift = drive * S.driftFuel;
  t.diagnostic(`bak ${car.real.tankL} l: ${fmt(minutes)} min gry (fuelScale ${S.fuelScale}); zużycie realne: bieg jałowy ${fmt(idle)} l/h, jazda 3500 obr/min ${fmt(drive)} l/h, drift ${fmt(drift)} l/h; zdarzenia: ${events.join(', ')}`);
  assert.ok(minutes >= 8 && minutes <= 12, 'pełny bak na 8–12 min');
  assert.ok(drift > drive && drive > idle);
  assert.deepEqual(events, ['rezerwa', 'pusty']);
  assert.ok(eco.state.empty && eco.state.fuel === 0);
  assert.deepEqual(eco.update(1, { rpm: 3000, load: 1, running: true }), [], 'pusty bak: nic się nie spala');
});

test('stacja, holowanie, dług: z pustym bakiem i pustym portfelem gra się nie blokuje', (t) => {
  const eco = createEconomy({ engine: gle, tankL: 45, fuel: 0, money: 0 });
  const canTow = eco.canTow;
  const towed = eco.tow(); // −30 zł on credit
  const afterTow = eco.state.money;
  const max = eco.affordable; // litres still possible on credit
  const got = eco.buyFuel(100);
  const over = eco.buyFuel(1); // over the limit now
  t.diagnostic(`holowanie ${towed ? 'tak' : 'nie'} (${fmt(afterTow, 2)} zł), potem na zeszyt ${fmt(max)} l → zatankowano ${fmt(got)} l, kasa ${fmt(eco.state.money, 2)} zł (limit −${S.debtLimit}); kolejny litr: ${over ? 'tak' : 'odmowa'}`);
  assert.ok(canTow && towed && afterTow === -S.towCost);
  assert.ok(got > 0 && !eco.state.empty, 'da się zatankować na zeszyt i jechać');
  assert.ok(eco.state.money >= -S.debtLimit - 1e-9);
  assert.equal(over, 0);
  // Full tank from money: price and litres
  const rich = createEconomy({ engine: gle, tankL: 45, fuel: 10, money: 500 });
  const cost = rich.price(rich.space);
  rich.buyFuel(rich.space);
  t.diagnostic(`do pełna z 10 l: ${fmt(cost, 2)} zł (${S.fuelPrice} zł/l), zostaje ${fmt(rich.state.money, 2)} zł`);
  assert.equal(rich.state.fuel, 45);
  assert.ok(Math.abs(rich.state.money - (500 - cost)) < 0.01);
});

test('kasa i szacun: drift w misji i w pokazie płaci, przy ludziach daje szacun, energetyk ×2, poziomy z nazwami', (t) => {
  const eco = createEconomy({ engine: gle, levels: teksty.szacun });
  const free = eco.drift(2000, {});
  const inMission = eco.drift(2000, { mission: true });
  const inShow = eco.drift(2000, { mission: true, show: true });
  const seen = eco.drift(2000, { nearPeople: true });
  eco.state.money = 10;
  eco.buyEnergy();
  const boosted = eco.drift(2000, { nearPeople: true });
  const lv = eco.level();
  t.diagnostic(`2000 pkt: poza misją ${free.kasa} zł, w misji ${inMission.kasa} zł, w pokazie ${inShow.kasa} zł; przy ludziach +${fmt(seen.szacun)} szacunu, z energetykiem +${fmt(boosted.szacun)}; poziom: ${lv.name} (${fmt(eco.state.respect)}, następny od ${lv.next}); poziomy: ${teksty.szacun.map((l) => `${l.od} ${l.nazwa.replace('PLACEHOLDER: ', '')}`).join(', ')}`);
  assert.equal(free.kasa, 0);
  assert.ok(inShow.kasa > inMission.kasa && inMission.kasa > 0);
  assert.ok(seen.szacun > 0 && boosted.szacun === seen.szacun * S.energyBoost);
  assert.ok(teksty.szacun.length >= 4 && lv.index >= 1);
  // save / restore
  const snap = eco.snapshot();
  const other = createEconomy({ engine: gle, levels: teksty.szacun });
  other.restore(snap);
  assert.deepEqual(other.snapshot(), snap);
});

test('odblokowanie misji szacunem i warunki w rozmowach', (t) => {
  // rewards of the missions before cover what the next one needs (plus drifting near people)
  const need = kampania.wymagania;
  t.diagnostic(`wymagania: ${JSON.stringify(need)}; nagrody: paczka ${JSON.stringify(paczka.reward)}, pokaz ${JSON.stringify(pokaz.reward)}, wyścig ${JSON.stringify(wyscig.reward)}`);
  assert.ok(paczka.reward.szacun >= need.pokaz, 'po misji 1 wystarczy na misję 2');
  assert.ok(paczka.reward.szacun + pokaz.reward.szacun >= need.wyscig, 'po misji 2 wystarczy na misję 3');
  // conditions
  assert.ok(when({ szacun: 50 }, { szacun: 60 }) && !when({ szacun: 50 }, { szacun: 10 }));
  assert.ok(when({ flaga: 'x' }, { flags: { x: true } }) && !when({ kasa: 5 }, { kasa: 1 }));
  const low = createDialogue(seba, undefined, { szacun: 0 });
  const high = createDialogue(seba, undefined, { szacun: 200 });
  low.advance();
  high.advance();
  assert.notEqual(low.state.text, high.state.text, 'Seba mówi inaczej przy dużym szacunie');
  const poor = createDialogue(halina, undefined, { kasa: 0 });
  const rich = createDialogue(halina, undefined, { kasa: 20 });
  poor.advance();
  rich.advance();
  t.diagnostic(`Seba (szacun 0): „${low.state.text.slice(0, 40)}…”, (szacun 200): „${high.state.text.slice(0, 40)}…”; Halina odpowiedzi: bez kasy ${poor.state.choices.length}, z kasą ${rich.state.choices.length}`);
  assert.equal(rich.state.choices.length, poor.state.choices.length + 1, 'odpowiedź tylko z kasą');
});

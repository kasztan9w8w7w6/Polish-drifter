import { torqueCurve, torqueAt } from './engine.js';

// Fuel, cash and respect (logic only, tested in Node) – the loop of v0.6d: drive → drift → earn → spend → unlock.
// - Fuel: the tank from the car profile; the engine burns what it really makes (power at this rpm × load, through the
//   engine's specific consumption `bsfc`) plus idling, a drift burns more (the rear wheels spin up), all sped up by
//   `fuelScale` so a full tank lasts ~8–12 minutes of play (test/economy.test.mjs). Empty tank: the engine stops –
//   push the car or call a mate (a tow to the station, for cash). No game over.
// - Cash (zł): mission rewards and drifting during missions (banked points × rate, more during a show).
// - Respect ("szacun"): mission rewards and spectacular drifts near people; levels with names (teksty.json → szacun);
//   it unlocks missions (kampania.json) and changes what people say (dialogue conditions).
// - Debt: the station and the mate let you go into the red down to −debtLimit (paid back from what you earn next),
//   so an empty tank with an empty wallet never locks the game.
export const economySettings = {
  fuelScale: 22, // consumption speed-up (1 = real litres per real hour)
  driftFuel: 1.35, // × consumption while drifting
  reserve: 0.15, // share of the tank: the reserve lamp
  fuelPrice: 2.99, // zł per litre
  debtLimit: 40, // zł you may owe
  towCost: 30, // zł for a mate towing you to the station
  driftRate: 0.01, // zł per banked drift point during a mission…
  showRate: 0.03, // …during a show (score step)
  respectRate: 1 / 60, // respect per drift point banked near people…
  respectMax: 40, // …at most this much for one drift
  crowdRadius: 25, // m: "near people"
  energyPrice: 6, // zł – the energy drink at Żappka
  energyTime: 60, // s it works
  energyBoost: 2, // × respect while it works
};

// levels: [{ od: points, nazwa }], lowest first
export function createEconomy({ engine, tankL = 45, fuel = tankL, money = 0, respect = 0, levels = [{ od: 0, nazwa: '' }] }, s = economySettings) {
  const curve = torqueCurve(engine);
  const density = engine.fuelDensity ?? 745; // g/l
  const st = { fuel, tank: tankL, money, respect, energy: 0, empty: fuel <= 0, reserve: fuel < tankL * s.reserve, lph: 0 };

  // litres per REAL hour at this rpm and load (0..1)
  function flow(rpm, load) {
    const kw = (torqueAt(curve, rpm) * load * rpm * 2 * Math.PI) / 60 / 1000;
    return (engine.idleLph ?? 0.8) + (Math.max(0, kw) * (engine.bsfc ?? 300)) / density;
  }
  const level = (points = st.respect) => {
    let i = 0;
    while (i + 1 < levels.length && points >= levels[i + 1].od) i++;
    return { index: i, name: levels[i].nazwa, from: levels[i].od, next: levels[i + 1]?.od ?? null };
  };
  const pay = (zl) => {
    if (st.money - zl < -s.debtLimit - 1e-9) return false;
    st.money = Math.round((st.money - zl) * 100) / 100;
    return true;
  };

  return {
    state: st,
    level,
    flow,
    // car: { rpm, load, drifting, running (engine on) } → events: 'rezerwa', 'pusty'
    update(dt, car) {
      const ev = [];
      st.energy = Math.max(0, st.energy - dt);
      if (st.empty || !car.running) return ev;
      st.lph = flow(car.rpm, car.load) * (car.drifting ? s.driftFuel : 1);
      const was = st.fuel;
      st.fuel = Math.max(0, st.fuel - (st.lph * s.fuelScale * dt) / 3600);
      const reserveAt = st.tank * s.reserve;
      st.reserve = st.fuel < reserveAt;
      if (was >= reserveAt && st.fuel < reserveAt) ev.push('rezerwa');
      if (st.fuel <= 0) {
        st.empty = true;
        ev.push('pusty');
      }
      return ev;
    },
    // a drift was banked: points, during a mission / a show, near people → { kasa, szacun } earned
    drift(points, { mission = false, show = false, nearPeople = false } = {}) {
      const kasa = mission || show ? Math.round(points * (show ? s.showRate : s.driftRate) * 100) / 100 : 0;
      const szacun = nearPeople ? Math.min(s.respectMax, points * s.respectRate) * (st.energy > 0 ? s.energyBoost : 1) : 0;
      st.money = Math.round((st.money + kasa) * 100) / 100;
      const before = level().index;
      st.respect += szacun;
      return { kasa, szacun, levelUp: level().index > before };
    },
    reward({ kasa = 0, szacun = 0 } = {}) {
      const before = level().index;
      st.money = Math.round((st.money + kasa) * 100) / 100;
      st.respect += szacun;
      return { levelUp: level().index > before };
    },
    // Station: litres that fit, the price of filling up, buying (false: not enough even on credit)
    get space() {
      return Math.max(0, st.tank - st.fuel);
    },
    price: (litres) => Math.round(litres * s.fuelPrice * 100) / 100,
    // how many litres `zl` buys, and how many can be bought at all (money + credit)
    litresFor: (zl) => Math.floor((zl / s.fuelPrice) * 10) / 10,
    get affordable() {
      return Math.max(0, Math.floor(((st.money + s.debtLimit) / s.fuelPrice) * 10) / 10);
    },
    // buys as much of `litres` as fits in the tank and as money + credit allow → litres bought
    buyFuel(litres) {
      const credit = Math.floor(((st.money + s.debtLimit) / s.fuelPrice) * 10) / 10;
      const l = Math.min(litres, st.tank - st.fuel, credit);
      if (l <= 0 || !pay(Math.round(l * s.fuelPrice * 100) / 100)) return 0;
      st.fuel += l;
      st.empty = st.fuel <= 0;
      st.reserve = st.fuel < st.tank * s.reserve;
      return l;
    },
    tow() {
      return pay(s.towCost);
    },
    get canTow() {
      return st.money - s.towCost >= -s.debtLimit;
    },
    buyEnergy() {
      if (!pay(s.energyPrice)) return false;
      st.energy = s.energyTime;
      return true;
    },
    // for the save ("Kontynuuj")
    snapshot: () => ({ fuel: Math.round(st.fuel * 100) / 100, money: st.money, respect: Math.round(st.respect * 10) / 10 }),
    restore(p = {}) {
      if (typeof p.fuel === 'number') st.fuel = Math.max(0, Math.min(st.tank, p.fuel));
      if (typeof p.money === 'number') st.money = p.money;
      if (typeof p.respect === 'number') st.respect = p.respect;
      st.empty = st.fuel <= 0;
      st.reserve = st.fuel < st.tank * s.reserve;
    },
  };
}

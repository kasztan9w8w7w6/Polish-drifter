// How long a smooth night takes (plan-mvp §2: ~60 min, ~45 with smooth driving): reading every line and choice at the
// game's pace (typewriter + hold, ui.js), the drives between the places (route lengths on the map, town ~35 km/h,
// the road out ~60 km/h), the free drive on the Park, the runs, the time-jump fades. `node test/czas.mjs`
import fs from 'node:fs';
import { createStory } from '../src/fabula/silnik.js';
import { typeSettings } from '../src/typewriter.js';
const json = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const dane = json('../docs/fabula/dane-mvp.json');
const insc = json('../src/fabula/inscenizacja.json');
const UI = { hold: 1.7, perChar: 0.045, czytanie: 1.4, wybor: 3, ekran: 1.1 };
const typ = (t) => t.length / typeSettings.charsPerSec * 1.25; // (+ stops after commas and full stops)
// route lengths (m) along the streets of the map, and speeds (m/s)
const TRASY = { 1: [300, 9.7], 3: [330, 9.7], 4: [700 + 520, 12], 6: [2010, 16.7], 9: [2010, 16.7], 10: [590 + 400, 11], 11: [220, 9.7] };
export function czasNocy({ sc0 = 240, kombi = true } = {}) {
  const s = createStory(dane, { inscenizacja: insc, wymus: { NOC_BMW: 3, RANO_BUS: 3, RANO_GRACZ: 4 } });
  const perScene = {};
  let a = s.start();
  const add = (k, v) => (perScene[k] = (perScene[k] ?? 0) + v);
  for (let g = 0; g < 3000 && a.typ !== 'koniec'; g++) {
    const sc = s.state.lista === 'sceny' ? s.state.scena : 'koniec';
    if (a.typ === 'kwestia') add(sc, typ(a.tekst) + (a.tryb === 'postoj' ? UI.czytanie : UI.hold + UI.perChar * a.tekst.length));
    if (a.typ === 'wybor') add(sc, UI.wybor);
    if (a.typ === 'ekran') add(sc, UI.ekran);
    if (a.typ === 'polecenie') add(sc, { skok_czasu: 2.5, zaklad: 8, przejazd: a.npc ? 16 : 75, scenka: 7.5, telefon: 1.4 }[a.polecenie] ?? 0);
    if (a.typ === 'brama') {
      const b = a.brama;
      if (b.typ === 'strefa') add(sc, sc0);
      else if (b.typ === 'czas') add(sc, b.sekundy);
      else if (b.typ === 'tankowanie') add(sc, 6);
    }
    if (a.typ === 'brama') a = s.done({ spelniona: kombi });
    else if (a.typ === 'wybor') a = s.choose(0);
    else if (a.typ === 'polecenie' && a.polecenie === 'zaklad') (s.bet(a.id, 'tak', 10), (a = s.done()));
    else a = s.done();
  }
  for (const [k, [m, v]] of Object.entries(TRASY)) add(Number(k), m / v);
  const suma = Object.values(perScene).reduce((x, y) => x + y, 0);
  return { suma, perScene };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const o of [{ sc0: 240, kombi: true }, { sc0: 180, kombi: false }]) {
    const r = czasNocy(o);
    console.log(JSON.stringify(o), `${(r.suma / 60).toFixed(1)} min`, Object.entries(r.perScene).map(([k, v]) => `${k}:${(v / 60).toFixed(1)}`).join(' '));
  }
}

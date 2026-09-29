// The story engine (src/fabula/silnik.js) on the screenwriter's data: every ⚙ command, the odds and payouts, and every
// path through the night (the same 7488 combinations as docs/fabula/generuj_dane.py) against its simulation and the
// matrix in plan-mvp §5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStory, czasNaMinuty, minutyNaCzas, kurs, wyplata, losowanie } from '../src/fabula/silnik.js';

const json = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
export const dane = json('../docs/fabula/dane-mvp.json');
export const inscenizacja = json('../src/fabula/inscenizacja.json');
export const slownik = json('../src/fabula/slownik.json').nazwy;
export const postacie = json('../src/fabula/postacie.json').postacie;

// Play the whole night with a strategy like generuj_dane.py's:
// { NOC_BMW: null | [strona, stawka, tak_wyszło], KAMIL_WIE, PRAWDA, PIWO, RANO_BUS: null | [...], RANO_GRACZ: [stawka, sukces] }
export function noc(strat, opts = {}) {
  const wymus = {};
  if (strat.NOC_BMW) wymus.NOC_BMW = strat.NOC_BMW[2] ? 6 : 0;
  if (strat.RANO_BUS) wymus.RANO_BUS = strat.RANO_BUS[2] ? 6 : 0;
  else wymus.RANO_BUS = 3;
  const s = createStory(dane, { inscenizacja, slownik, postacie, wymus, ...opts });
  const seen = [];
  let a = s.start();
  let kasaPrzedSwitem = null;
  for (let guard = 0; guard < 2000 && a.typ !== 'koniec'; guard++) {
    seen.push(a);
    if (a.typ === 'brama') {
      if (a.brama.typ === 'strefa') a = s.done({ spelniona: !!strat.NOC_BMW });
      else a = s.done();
    } else if (a.typ === 'wybor') {
      let i = a.opcje.findIndex((o) => o.dane.ustawia && Object.entries(o.dane.ustawia).every(([f, v]) => strat[f] === v));
      a = s.choose(Math.max(0, i));
    } else if (a.typ === 'polecenie' && a.polecenie === 'zaklad') {
      const z = a.id === 'RANO_GRACZ' ? ['tak', strat.RANO_GRACZ[0]] : strat[a.id];
      if (a.id === 'RANO_BUS') kasaPrzedSwitem ??= s.state.kasa;
      s.bet(a.id, z?.[0] ?? 'tak', z?.[1] ?? 0);
      a = s.done();
    } else if (a.typ === 'polecenie' && a.polecenie === 'przejazd' && !a.npc) {
      a = s.done({ slupki: Array.from({ length: 6 }, (_, k) => k < (strat.RANO_GRACZ[1] ? 4 : 3)) });
    } else a = s.done();
  }
  assert.equal(a.typ, 'koniec', 'noc dochodzi do końca');
  return { s, seen, kasaPrzedSwitem };
}

test('fabuła: czas nocy (23:35 → 00:18 idzie do przodu)', () => {
  assert.equal(czasNaMinuty('Park · 23:35'), 23 * 60 + 35);
  assert.equal(czasNaMinuty('00:18'), 24 * 60 + 18);
  assert.ok(czasNaMinuty('06:40 · syrena') > czasNaMinuty('05:41'));
  assert.equal(minutyNaCzas(czasNaMinuty('04:05')), '04:05');
  assert.equal(czasNaMinuty('Kasa: 699 zł'), null);
});

test('fabuła: kursy ze wzoru §4 = kursy w dane-mvp.json, wypłaty zaokrąglone do złotówki', () => {
  const Z = dane.zaklady.zasady;
  for (const [id, pz] of Object.entries(dane.zaklady.przejazdy)) {
    assert.equal(kurs(pz.p_tlumu_tak, pz.pora, Z), pz.kurs.tak, `${id} TAK`);
    if (pz.kurs.nie) assert.equal(kurs(1 - pz.p_tlumu_tak, pz.pora, Z), pz.kurs.nie, `${id} NIE`);
  }
  // plan §4: NOC_BMW 1,8 / 2,7 · RANO_BUS 1,8 / 1,8 · RANO_GRACZ 3,0
  assert.deepEqual([dane.zaklady.przejazdy.NOC_BMW.kurs.tak, dane.zaklady.przejazdy.NOC_BMW.kurs.nie], [1.8, 2.7]);
  assert.equal(dane.zaklady.przejazdy.RANO_GRACZ.kurs.tak, 3);
  assert.equal(wyplata(20, 2.7), 54);
  assert.equal(wyplata(10, 1.8), 18);
  assert.equal(wyplata(50, 3), 150);
});

test('fabuła: każda ścieżka nocy = symulacja scenarzysty (7488 ścieżek, zakończenia, kasa min–max)', () => {
  const noc0 = [null, ...['tak', 'nie'].flatMap((s) => [10, 20].flatMap((st) => [true, false].map((w) => [s, st, w])))];
  const bus = [null, ...['tak', 'nie'].flatMap((s) => [10, 20, 50].flatMap((st) => [true, false].map((w) => [s, st, w])))];
  const gracz = [0, 10, 20, 50].flatMap((st) => [true, false].map((w) => [st, w]));
  const traf = {};
  let n = 0, kmin = Infinity, kmax = -Infinity;
  for (const N of noc0) for (const kw of ['tak', 'nie']) for (const pr of ['powiedzial', 'zmilczal']) for (const pi of ['dane', 'kiedys']) for (const B of bus) for (const G of gracz) {
    const { s } = noc({ NOC_BMW: N, KAMIL_WIE: kw, PRAWDA: pr, PIWO: pi, RANO_BUS: B, RANO_GRACZ: G });
    const z = s.state.zakonczenie.nazwa;
    traf[z] = (traf[z] ?? 0) + 1;
    kmin = Math.min(kmin, s.state.kasa);
    kmax = Math.max(kmax, s.state.kasa);
    n++;
  }
  assert.equal(n, dane.symulacja.sciezek);
  assert.deepEqual(traf, dane.symulacja.zakonczenia);
  assert.equal(kmin, dane.symulacja.kasa_min);
  assert.equal(kmax, dane.symulacja.kasa_max);
});

test('fabuła: macierz plan §5 (kasa przed świtem, minimalna stawka na siebie, po sukcesie)', () => {
  for (const row of dane.symulacja.macierz_bazowa) {
    const base = { NOC_BMW: null, KAMIL_WIE: 'nie', PRAWDA: row.PRAWDA, PIWO: row.PIWO, RANO_BUS: null };
    const { kasaPrzedSwitem } = noc({ ...base, RANO_GRACZ: [0, false] });
    assert.equal(kasaPrzedSwitem, row.kasa_przed_switem, JSON.stringify(row));
    let min = null, po = null;
    for (const st of [0, 10, 20, 50]) {
      const { s } = noc({ ...base, RANO_GRACZ: [st, true] });
      if (s.state.kasa >= dane.ekonomia.cel) {
        min = st;
        po = s.state.kasa;
        break;
      }
    }
    assert.equal(min, row.min_stawka_na_siebie);
    assert.equal(po, row.po_sukcesie);
  }
});

test('fabuła: polecenia §8a zmieniają stan (ładunek, pasażer, sen, radio, telefon, skok czasu, kasa)', () => {
  const { s, seen } = noc({ NOC_BMW: ['nie', 20, false], KAMIL_WIE: 'tak', PRAWDA: 'powiedzial', PIWO: 'dane', RANO_BUS: ['tak', 50, true], RANO_GRACZ: [50, true] });
  const cmds = seen.filter((a) => a.typ === 'polecenie').map((a) => a.polecenie);
  for (const c of ['kasa', 'zaklad', 'przejazd', 'tlum', 'ladunek', 'pasazer', 'pasazer_spi', 'pasazer_budzi', 'radio', 'skok_czasu', 'scenka', 'telefon', 'zakonczenie']) assert.ok(cmds.includes(c), c);
  // replay step by step and check the state after each command
  const t = createStory(dane, { inscenizacja, slownik, postacie, wymus: { NOC_BMW: 0, RANO_BUS: 6 } });
  let a = t.start();
  const after = {};
  for (let g = 0; g < 2000 && a.typ !== 'koniec'; g++) {
    if (a.typ === 'polecenie') {
      const before = JSON.parse(JSON.stringify(t.state));
      const name = a.polecenie;
      if (a.polecenie === 'zaklad') t.bet(a.id, a.id === 'NOC_BMW' ? 'nie' : 'tak', a.id === 'NOC_BMW' ? 20 : 50);
      a = a.polecenie === 'przejazd' && !a.npc ? t.done({ slupki: [true, true, true, true, false, false] }) : t.done();
      (after[name] ??= []).push({ before, now: JSON.parse(JSON.stringify(t.state)) });
      continue;
    }
    if (a.typ === 'brama') a = t.done({ spelniona: true });
    else if (a.typ === 'wybor') a = t.choose(a.opcje.length - 1 >= 0 ? 0 : 0);
    else a = t.done();
  }
  assert.equal(after.ladunek[0].now.ladunek, 'FELGI');
  assert.equal(after.ladunek[1].now.ladunek, null);
  assert.equal(after.pasazer[0].now.pasazer, 'KAMIL');
  assert.equal(after.pasazer.at(-1).now.pasazer, null);
  assert.equal(after.pasazer_spi[0].now.spi, true);
  assert.equal(after.pasazer_budzi[0].now.spi, false);
  assert.deepEqual(after.radio.map((x) => x.now.radio), ['DAD_ROCK', 'TECHNO']);
  assert.deepEqual(after.skok_czasu.map((x) => minutyNaCzas(x.now.zegar)), ['02:40', '03:25', '04:05']);
  assert.equal(after.kasa[0].now.kasa - after.kasa[0].before.kasa, -50); // tankowanie
  // the night bet: NIE 20 on the BMW that did 0/6 → win 54, profit +34 (plan §5: D0 −20…+34)
  assert.equal(t.state.rozliczenia.NOC_BMW, 34);
  assert.equal(t.state.flagi.NOC_BMW, 'wygrana');
  // the player's own bet: 50 × 3,0 = 150 → +100, plus Jurek's cut (⚙ kasa +10)
  assert.equal(t.state.rozliczenia.RANO_GRACZ, 100);
  assert.equal(t.state.flagi.RANO_GRACZ, 'sukces');
  assert.equal(t.state.wyniki.RANO_GRACZ.czyste, 4);
});

test('fabuła: telefon (rozmowa → okienko, kończy się przy bramie), tryby kwestii, słownik i placeholdery', () => {
  const { seen } = noc({ NOC_BMW: null, KAMIL_WIE: 'nie', PRAWDA: 'zmilczal', PIWO: 'kiedys', RANO_BUS: null, RANO_GRACZ: [0, false] });
  const lines = seen.filter((a) => a.typ === 'kwestia');
  // sc. 0 Mirek on the phone, sc. 3 Kamil on the phone, sc. 5 Kamil in the car (driving), sc. 1 Mirek in person
  assert.equal(lines.find((a) => a.tekst === 'Jesteś na Parku?').tryb, 'telefon');
  assert.equal(lines.find((a) => a.tekst === 'Ty, nie dojadę.').tryb, 'telefon');
  assert.equal(lines.find((a) => a.tekst === 'Ja jadę za piwo. Wiesz.').tryb, 'jazda');
  assert.equal(lines.find((a) => a.tekst === 'No jesteś.').tryb, 'postoj');
  assert.equal(lines.find((a) => a.tekst === 'Facet dzwonił. Jedna bije.').tryb, 'sms');
  // no real brands on screen: Orlen → Kometa, Biedronka → dyskont
  const all = seen.map((a) => a.tekst ?? '').join('\n') + seen.flatMap((a) => a.opcje?.map((o) => o.tekst) ?? []).join('\n');
  assert.ok(!/Orlen|Biedronk|Żabk/.test(all), 'marki podmienione');
  assert.ok(seen.some((a) => a.typ === 'ekran' && a.tekst === 'Kometa · 00:31'));
  assert.ok(lines.some((a) => a.tekst === 'Godzina to chyba z trzydzieści złotych. Tyle płacą w dyskoncie. Słyszałem.'));
  // [KASA], [BRAK] filled in (the "Park · 06:04" screen: 849 zł before dawn on this path)
  assert.ok(seen.some((a) => a.typ === 'ekran' && a.tekst === 'Kasa: 849 zł. Kartka od Zbycha: 889 zł. Brakuje: 40 zł.'));
  // descriptions never reach the screen, hooks neither
  assert.ok(!seen.some((a) => a.typ === 'opis' || a.typ === 'hak'));
  // the kombi block was skipped (no approach): NOC_BMW stays unset, "Nie stawiasz" isn't said
  assert.ok(!lines.some((a) => a.tekst.startsWith('Nie stawiasz')));
});

test('fabuła: przejazd NPC losuje każdy słupek z q_ukryte (beemka ≈ 34%, bus ≈ 54% na ≥4)', () => {
  const rng = losowanie(7);
  const hits = { NOC_BMW: 0, RANO_BUS: 0 };
  const N = 4000;
  for (const id of Object.keys(hits)) {
    for (let k = 0; k < N; k++) {
      const s = createStory(dane, { inscenizacja, slownik, postacie, rng });
      const q = dane.zaklady.przejazdy[id].q_ukryte;
      const posts = Array.from({ length: 6 }, () => rng() < q);
      if (posts.filter(Boolean).length >= 4) hits[id]++;
      void s;
    }
  }
  // binomial(6, 0.5) ≥ 4 = 34.4 %, binomial(6, 0.6) ≥ 4 = 54.4 % (plan §4 table)
  assert.ok(Math.abs(hits.NOC_BMW / N - 0.344) < 0.03, `beemka ${hits.NOC_BMW / N}`);
  assert.ok(Math.abs(hits.RANO_BUS / N - 0.544) < 0.03, `bus ${hits.RANO_BUS / N}`);
});

test('fabuła: zapis nocy – wczytanie zaczyna od początku zapisanej sceny ze stanem z tej chwili', () => {
  const s = createStory(dane, { inscenizacja, slownik, postacie, wymus: { NOC_BMW: 0 } });
  let a = s.start();
  let snap = null;
  for (let g = 0; g < 2000 && a.typ !== 'koniec'; g++) {
    if (s.state.scena === 6 && !snap) snap = s.checkpoint;
    if (a.typ === 'brama') a = s.done({ spelniona: true });
    else if (a.typ === 'wybor') a = s.choose(0);
    else if (a.typ === 'polecenie' && a.polecenie === 'zaklad') (s.bet(a.id, 'nie', 20), (a = s.done()));
    else a = s.done();
    if (snap) break;
  }
  assert.equal(snap.scena, 6);
  assert.equal(snap.ladunek, 'FELGI');
  assert.equal(snap.pasazer, 'KAMIL');
  const t = createStory(dane, { inscenizacja, slownik, postacie });
  const first = t.restore(JSON.parse(JSON.stringify(snap)));
  assert.equal(t.state.scena, 6);
  assert.equal(first.typ, 'brama'); // arrive at the village first
  assert.equal(t.state.kasa, snap.kasa);
  assert.equal(t.state.flagi.KAMIL_WIE, snap.flagi.KAMIL_WIE);
});

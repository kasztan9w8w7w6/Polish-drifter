// The story engine of "W nocy robota" (logic only, no DOM – tested in Node). It walks the screenwriter's data
// (docs/fabula/dane-mvp.json, generated from scenariusz-mvp.md) node by node and hands the game one ACTION at a time;
// the game shows / plays it and says when it is done. The world, the UI and the driving live in gra.js.
//
// Actions (story.action):
//   { typ: 'brama', brama }            – staging from inscenizacja.json: wait until the player is somewhere / has driven
//                                        (the data doesn't say where the car is; the staging does). done(flags?)
//   { typ: 'ekran', tekst, godzina }    – technical text (hour, cash, place); `godzina` (minutes) moves the clock
//   { typ: 'kwestia', kto, imie, tekst, tryb }  – a line; tryb: 'postoj' | 'jazda' | 'telefon' | 'sms'
//   { typ: 'wybor', opcje: [{ tekst }], tryb }  – choose(i)
//   { typ: 'polecenie', polecenie, argumenty, ... } – ⚙ commands (plan-mvp §8a); the state part is applied here,
//                                        the world part (animation, boards, fades) by the game, then done()
//   { typ: 'dzwiek', tekst }            – music / sound direction (not text on screen)
//   { typ: 'koniec' }                   – the night is over (after the ending and the epilogue)
// Description nodes ("opis", pokaz: false) and hooks ("hak") are never shown – they are skipped.
//
// Flags: set by choices (`ustawia`), by staging gates (PODJECHAL_DO_KOMBI) and by the bet runs (NOC_BMW, RANO_BUS,
// RANO_GRACZ). A condition on a flag that was never set is not met (like the screenwriter's simulation).

export const MINUTY_DOBY = 24 * 60;

// "23:35" → minutes, after midnight counted on (00:18 → 1458), so the night's clock only goes forward
export function czasNaMinuty(tekst) {
  const m = /(\d{1,2}):(\d{2})/.exec(tekst ?? '');
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min < 12 * 60 ? min + MINUTY_DOBY : min;
}
export function minutyNaCzas(min) {
  const m = Math.floor(min) % MINUTY_DOBY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
// "−50" / "+150" (the screenplay uses the real minus sign)
export const kwota = (s) => Number(String(s).replace('−', '-').replace('+', ''));

// Odds from plan-mvp §4: round(0.9 / p × time-of-day multiplier, 1); payout = round(stake × odds)
export function kurs(p, pora, zasady) {
  return Math.round(((1 - zasady.marza_trzymajacego) / p) * zasady.mnoznik_pory[pora] * 10) / 10;
}
export const wyplata = (stawka, k) => Math.round(stawka * k);

// Deterministic random numbers for tests (mulberry32)
export function losowanie(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// dane: dane-mvp.json; inscenizacja: src/fabula/inscenizacja.json (where scenes happen, gates, modes);
// slownik: display-name replacements (no real brands in the game); postacie: speaker names; rng: () => 0..1
export function createStory(dane, { inscenizacja = { sceny: {} }, slownik = {}, postacie = {}, rng = Math.random, wymus = {} } = {}) {
  const Z = dane.zaklady.zasady;
  const przejazdy = dane.zaklady.przejazdy;
  const cel = dane.ekonomia.cel;

  const st = {
    lista: 'sceny', // 'sceny' | 'zakonczenie' | 'epilog' | 'koniec'
    scena: 0,
    i: 0, // node index in the current list
    flagi: {},
    kasa: dane.ekonomia.kasa_start,
    zegar: null, // minutes (see czasNaMinuty)
    radio: 'TECHNO',
    ladunek: null,
    pasazer: null,
    spi: false,
    telefon: null, // { tryb: 'ROZMOWA' | 'SMS', kto }
    zaklady: {}, // id → { strona, stawka } placed on the board
    wyniki: {}, // id → { slupki: [bool × 6], czyste, tak: czyste >= próg }
    rozliczenia: {}, // id → cash change of the player's bet
    zakonczenie: null, // { id, nazwa }
    decyzje: [], // [{ scena, tekst, ustawia }] – for the summary screen
    bramy: {}, // gates already passed in this scene: key → true
  };
  const slowa = Object.entries(slownik).sort((a, b) => b[0].length - a[0].length); // (longer first: "Orlenie" before "Orlen")
  let akcja = null;
  let wstawka = null; // a synthetic action shown before going on (the answer after a choice)
  let checkpoint = null;
  const log = []; // everything that happened, for tests

  const lista = () => (st.lista === 'sceny' ? dane.sceny[st.scena]?.wezly ?? [] : st.lista === 'zakonczenie' ? dane.zakonczenia.find((z) => z.id === st.zakonczenie?.id)?.wezly ?? [] : st.lista === 'epilog' ? dane.epilog : []);
  const insc = () => (st.lista === 'sceny' ? inscenizacja.sceny?.[st.scena] ?? {} : inscenizacja.zakonczenia ?? {});
  const spelnia = (w) => Object.entries(w.warunek ?? {}).every(([f, v]) => st.flagi[f] === v);

  // Display text: the dictionary (Orlen → Kometa…) and the placeholders [KASA], [BRAK]
  function tekst(t) {
    let s = String(t ?? '');
    for (const [z, na] of slowa) s = s.split(z).join(na);
    return s.replaceAll('[KASA]', `${st.kasa} zł`).replaceAll('[BRAK]', `${Math.max(0, cel - st.kasa)} zł`);
  }
  const imie = (kto) => postacie[kto]?.imie ?? kto.charAt(0) + kto.slice(1).toLowerCase();

  function tryb(kto) {
    if (st.telefon && (kto === st.telefon.kto || kto === 'GRACZ')) return st.telefon.tryb === 'SMS' ? 'sms' : 'telefon';
    return insc().tryb ?? 'postoj';
  }

  // Staging gates for the node at index i (or the scene start): matched by the node's content, not its line number,
  // so edits to the screenplay don't move them
  function bramaDla(i, w) {
    const bramy = insc().bramy ?? [];
    for (const [k, b] of bramy.entries()) {
      const key = `${k}`;
      if (st.bramy[key]) continue;
      const p = b.przed;
      const trafia =
        p === 'start' ? i === 0 :
        p?.ekran ? w?.typ === 'ekran' && w.tekst.includes(p.ekran) :
        p?.polecenie ? w?.typ === 'mechanika' && w.polecenie === p.polecenie && (!p.argument || w.argumenty[0] === p.argument) :
        p?.kwestia ? w?.typ === 'kwestia' && w.kto === p.kwestia :
        p?.warunek ? Object.keys(w?.warunek ?? {}).includes(p.warunek) :
        false;
      if (trafia) return { key, ...b };
    }
    return null;
  }

  function skonczTelefon(powod) {
    if (st.telefon) log.push({ typ: 'telefon-koniec', powod });
    st.telefon = null;
  }

  // Move to the next action (skipping what isn't shown or whose condition fails)
  function dalej() {
    akcja = null;
    for (let guard = 0; guard < 10000; guard++) {
      if (st.lista === 'koniec') return (akcja = { typ: 'koniec' });
      const l = lista();
      if (st.i >= l.length) {
        // end of the list: the next scene, or after the last one → the ending, the epilogue, the end
        skonczTelefon('koniec sceny');
        if (st.lista === 'sceny' && st.scena + 1 < dane.sceny.length) {
          st.scena++;
          st.i = 0;
          st.bramy = {};
          zapiszCheckpoint();
          continue;
        }
        if (st.lista === 'zakonczenie') {
          st.lista = 'epilog';
          st.i = 0;
          st.bramy = {};
          continue;
        }
        st.lista = 'koniec';
        continue;
      }
      const w = l[st.i];
      // a gate before this node (checked before the node's own condition: a gate can set the flag it tests)
      const b = bramaDla(st.i, w);
      if (b) {
        skonczTelefon('brama');
        return (akcja = { typ: 'brama', brama: b });
      }
      if (!spelnia(w) || w.typ === 'opis' || w.typ === 'hak' || w.pokaz === false) {
        st.i++;
        continue;
      }
      if (w.typ === 'kwestia' && st.telefon && w.kto !== st.telefon.kto) skonczTelefon('ktoś inny mówi');
      akcja = zbuduj(w);
      if (akcja) return akcja;
      st.i++;
    }
    throw new Error('fabuła: pętla bez końca');
  }

  function zbuduj(w) {
    switch (w.typ) {
      case 'ekran': {
        const godzina = czasNaMinuty(w.tekst);
        return { typ: 'ekran', tekst: tekst(w.tekst), godzina, tryb: st.telefon ? (st.telefon.tryb === 'SMS' ? 'sms' : 'telefon') : insc().tryb ?? 'postoj', wezel: w };
      }
      case 'kwestia':
        return { typ: 'kwestia', kto: w.kto, imie: imie(w.kto), tekst: tekst(w.tekst), tryb: tryb(w.kto), wezel: w };
      case 'wybor': {
        const opcje = w.opcje.filter((o) => spelnia(o));
        return { typ: 'wybor', opcje: opcje.map((o) => ({ tekst: tekst(o.tekst ?? `(${o.akcja})`), niema: !o.tekst, dane: o })), tryb: tryb('GRACZ'), wezel: w };
      }
      case 'dzwiek':
        return { typ: 'dzwiek', tekst: w.tekst, wezel: w };
      case 'koniec':
        st.lista = 'koniec';
        return { typ: 'koniec' };
      case 'mechanika':
        return polecenie(w);
    }
    return null;
  }

  // ⚙ commands: the state part here, the world part in the game (plan-mvp §8a)
  function polecenie(w) {
    const [a0, a1] = w.argumenty;
    const base = { typ: 'polecenie', polecenie: w.polecenie, argumenty: w.argumenty, wezel: w };
    log.push({ typ: 'polecenie', polecenie: w.polecenie, argumenty: w.argumenty, scena: st.scena });
    // (the state changes when the game finishes the action – done() – so what it shows and the state agree)
    switch (w.polecenie) {
      case 'kasa': {
        const n = kwota(a0);
        return { ...base, zmiana: n, efekt: () => (st.kasa += n) };
      }
      case 'ladunek':
        return { ...base, efekt: () => (st.ladunek = a0 === 'BRAK' ? null : a0) };
      case 'pasazer':
        return { ...base, efekt: () => ((st.pasazer = a0 === 'BRAK' ? null : a0), (st.spi = false)) };
      case 'pasazer_spi':
        return { ...base, efekt: () => (st.spi = true) };
      case 'pasazer_budzi':
        return { ...base, efekt: () => (st.spi = false) };
      case 'radio':
        return { ...base, efekt: () => (st.radio = a0) };
      case 'skok_czasu': {
        const g = czasNaMinuty(a0);
        return { ...base, godzina: g, efekt: () => (st.zegar = Math.max(st.zegar ?? 0, g)) };
      }
      case 'telefon':
        return { ...base, tryb: a0 === 'SMS' ? 'sms' : 'telefon', kto: a1, imie: imie(a1), efekt: () => (st.telefon = { tryb: a0, kto: a1 }) };
      case 'zaklad': {
        const pz = przejazdy[a0];
        const kursy = Object.fromEntries(pz.strony.map((s) => [s, kurs(s === 'tak' ? pz.p_tlumu_tak : 1 - pz.p_tlumu_tak, pz.pora, Z)]));
        return { ...base, id: a0, przejazd: pz, kursy, stawki: [0, ...pz.stawki], strony: pz.strony };
      }
      case 'przejazd': {
        const pz = przejazdy[a0];
        const npc = pz.q_ukryte != null;
        // NPC: every post drawn from the hidden success rate q (forced results for tests: wymus[id] = clean count)
        const slupki = npc ? losujSlupki(a0, pz.q_ukryte) : null;
        return { ...base, id: a0, przejazd: pz, npc, slupki };
      }
      case 'tlum':
        return { ...base, id: a0, tlum: przejazdy[a0].tlum ?? [] };
      case 'scenka':
        return { ...base, id: a0, scenka: inscenizacja.scenki?.[a0] ?? {} };
      case 'zakonczenie': {
        const z = wybierzZakonczenie();
        st.zakonczenie = { id: z.id, nazwa: z.nazwa };
        return { ...base, zakonczenie: st.zakonczenie };
      }
    }
    return base;
  }

  function losujSlupki(id, q) {
    const n = Z.slupki;
    if (wymus[id] != null) return Array.from({ length: n }, (_, k) => k < wymus[id]);
    return Array.from({ length: n }, () => rng() < q);
  }

  function wybierzZakonczenie() {
    for (const z of dane.zakonczenia) {
      const ok = Object.entries(z.warunek).every(([f, v]) => {
        if (f !== 'kasa') return st.flagi[f] === v;
        return v.op === '>=' ? st.kasa >= v.wartosc : st.kasa < v.wartosc;
      });
      if (ok) return z;
    }
    throw new Error(`fabuła: brak zakończenia dla ${JSON.stringify(st.flagi)}, kasa ${st.kasa}`);
  }

  // Settle a run: the flag and the player's bet (plan §4: win = round(stake × odds), profit = win − stake, loss = −stake)
  function rozlicz(id, slupki) {
    const pz = przejazdy[id];
    const czyste = slupki.filter(Boolean).length;
    const tak = czyste >= Z.prog_wygranej;
    st.wyniki[id] = { slupki, czyste, tak };
    const z = st.zaklady[id];
    let zmiana = 0;
    if (pz.kierowca === 'GRACZ') {
      st.flagi[id] = tak ? 'sukces' : 'porazka';
      if (z?.stawka) zmiana = tak ? wyplata(z.stawka, kurs(pz.p_tlumu_tak, pz.pora, Z)) - z.stawka : -z.stawka;
    } else if (!z?.stawka) st.flagi[id] = 'bez_zakladu';
    else {
      const wygrana = (z.strona === 'tak') === tak;
      st.flagi[id] = wygrana ? 'wygrana' : 'przegrana';
      const k = kurs(z.strona === 'tak' ? pz.p_tlumu_tak : 1 - pz.p_tlumu_tak, pz.pora, Z);
      zmiana = wygrana ? wyplata(z.stawka, k) - z.stawka : -z.stawka;
    }
    st.kasa += zmiana;
    st.rozliczenia[id] = zmiana;
    log.push({ typ: 'rozliczenie', id, czyste, tak, zmiana, flaga: st.flagi[id] });
    return { czyste, tak, zmiana, flaga: st.flagi[id] };
  }

  function zapiszCheckpoint() {
    checkpoint = snapshot();
    log.push({ typ: 'scena', scena: st.scena });
  }
  function snapshot() {
    return JSON.parse(JSON.stringify({ lista: st.lista, scena: st.scena, i: 0, flagi: st.flagi, kasa: st.kasa, zegar: st.zegar, radio: st.radio, ladunek: st.ladunek, pasazer: st.pasazer, spi: st.spi, zaklady: {}, wyniki: st.wyniki, rozliczenia: st.rozliczenia, zakonczenie: st.zakonczenie, decyzje: st.decyzje }));
  }

  const api = {
    state: st,
    log,
    get action() {
      return akcja;
    },
    start() {
      st.zegar = czasNaMinuty(dane.sceny[0].wezly.find((w) => w.typ === 'ekran' && czasNaMinuty(w.tekst))?.tekst) ?? 23 * 60;
      zapiszCheckpoint();
      return dalej();
    },
    // Back to the start of a saved scene (checkpoint from snapshot())
    restore(snap) {
      Object.assign(st, JSON.parse(JSON.stringify(snap)), { i: 0, bramy: {}, telefon: null, zaklady: {} });
      zapiszCheckpoint();
      return dalej();
    },
    // The saved state at the start of the current scene (the game adds the car's place and fuel)
    get checkpoint() {
      return checkpoint;
    },
    // Finish the current action. For a gate: flags it sets ({ PODJECHAL_DO_KOMBI: 'tak' }). For the player's run:
    // done({ slupki: [bool × 6] }).
    done(wynik = {}) {
      const a = akcja;
      if (!a) return null;
      if (a === wstawka) {
        wstawka = null;
        return dalej();
      }
      if (a.typ === 'brama') {
        st.bramy[a.brama.key] = true;
        Object.assign(st.flagi, wynik.flagi ?? {});
        if (a.brama.flaga && wynik.flagi?.[a.brama.flaga[0]] === undefined) st.flagi[a.brama.flaga[0]] = wynik.spelniona === false ? a.brama.inaczej?.[1] : a.brama.flaga[1];
        log.push({ typ: 'brama', key: a.brama.key, flagi: { ...st.flagi } });
        return dalej();
      }
      if (a.typ === 'ekran' && a.godzina != null && st.lista === 'sceny') st.zegar = Math.max(st.zegar ?? 0, a.godzina);
      if (a.typ === 'polecenie') {
        a.efekt?.();
        if (a.polecenie === 'przejazd') {
          const slupki = a.npc ? a.slupki : wynik.slupki ?? Array.from({ length: Z.slupki }, (_, k) => k < (wymus[a.id] ?? wynik.czyste ?? 0));
          a.wynik = rozlicz(a.id, slupki);
        }
        if (a.polecenie === 'zakonczenie') {
          st.lista = 'zakonczenie';
          st.i = 0;
          st.bramy = {};
          return dalej();
        }
      }
      if (a.typ === 'wybor') throw new Error('fabuła: wybór wymaga choose(i)');
      st.i++;
      return dalej();
    },
    choose(i) {
      const a = akcja;
      if (a?.typ !== 'wybor') return null;
      const o = a.opcje[i]?.dane;
      if (!o) return null;
      Object.assign(st.flagi, o.ustawia ?? {});
      if (o.ustawia) st.decyzje.push({ scena: st.scena, tekst: o.tekst ?? o.akcja, ustawia: o.ustawia });
      log.push({ typ: 'wybor', scena: st.scena, tekst: o.tekst ?? o.akcja, ustawia: o.ustawia ?? null });
      st.i++;
      if (o.odpowiedz) {
        const kto = o.odpowiedz.kto;
        wstawka = { typ: 'kwestia', kto, imie: imie(kto), tekst: tekst(o.odpowiedz.tekst), tryb: tryb(kto), odpowiedz: true };
        return (akcja = wstawka);
      }
      return dalej();
    },
    // The bet board: side 'tak' / 'nie', stake 0 = no bet (the run happens anyway)
    bet(id, strona, stawka) {
      st.zaklady[id] = { strona, stawka };
      log.push({ typ: 'zaklad', id, strona, stawka });
    },
    // The next scripted time after the current action (the game's clock never runs past it)
    nextTime() {
      const scan = (l, from) => {
        for (let k = from; k < l.length; k++) {
          const w = l[k];
          const t = w.typ === 'ekran' ? czasNaMinuty(w.tekst) : w.typ === 'mechanika' && w.polecenie === 'skok_czasu' ? czasNaMinuty(w.argumenty[0]) : null;
          if (t != null && t > (st.zegar ?? 0)) return t;
        }
        return null;
      };
      if (st.lista !== 'sceny') return null;
      for (let s = st.scena; s < dane.sceny.length; s++) {
        const t = scan(dane.sceny[s].wezly, s === st.scena ? st.i : 0);
        if (t != null) return t;
      }
      return null;
    },
    cel,
    kurs: (id, strona) => {
      const pz = przejazdy[id];
      return kurs(strona === 'tak' ? pz.p_tlumu_tak : 1 - pz.p_tlumu_tak, pz.pora, Z);
    },
    tekst,
    imie,
  };
  return api;
}

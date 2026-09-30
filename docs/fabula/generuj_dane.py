#!/usr/bin/env python3
"""
Generuje dane-mvp.json ze scenariusz-mvp.md i sprawdza spójność.

Użycie:  python3 generuj_dane.py            (generuje + waliduje + symuluje)
         python3 generuj_dane.py --bez-symulacji

Źródłem prawdy jest scenariusz-mvp.md. Nie edytuj JSON-a ręcznie —
popraw scenariusz albo stałe poniżej i uruchom skrypt ponownie.
"""
import json, re, sys, itertools
from pathlib import Path

KATALOG = Path(__file__).resolve().parent
SCENARIUSZ = KATALOG / "scenariusz-mvp.md"
WYJSCIE = KATALOG / "dane-mvp.json"

# ---------------------------------------------------------------- STAŁE GRY
EKONOMIA = {
    "waluta": "zł",
    "kasa_start": 699,
    "cel": 889,
    "kartka_zbycha": [
        {"pozycja": "badanie techniczne", "kwota": 149},
        {"pozycja": "łata na próg", "kwota": 300},
        {"pozycja": "tarcze i klocki przód", "kwota": 170},
        {"pozycja": "tłumik końcowy", "kwota": 120},
        {"pozycja": "robota Zbycha", "kwota": 150},
    ],
    "termin_dni": 21,
    "paliwo": {"cena_za_litr": 6.99, "tankowanie_zl": 50, "litry": 7.15,
               "trasa_km": 70, "spalanie_l_na_100km": 9.5},
}

ZAKLADY = {
    "zasady": {
        "slupki": 6,
        "prog_wygranej": 4,
        "marza_trzymajacego": 0.10,
        "mnoznik_pory": {"noc": 1.2, "rano": 1.0},
        "wzor_kursu": "round(0.9 / p_tlumu * mnoznik_pory, 1)",
        "wyplata": "round(stawka * kurs)  (zysk = wyplata - stawka)",
    },
    "przejazdy": {
        "NOC_BMW": {"scena": 0, "pora": "noc", "kierowca": "NPC (beemka e34)",
                    "q_ukryte": 0.5, "p_tlumu_tak": 0.6,
                    "strony": ["tak", "nie"], "stawki": [10, 20],
                    "trzyma": "FACET Z TERMOSEM", "opcjonalny": True},
        "RANO_BUS": {"scena": 11, "pora": "rano", "kierowca": "NPC (Zdzichu, służbowy bus)",
                     "q_ukryte": 0.6, "p_tlumu_tak": 0.5,
                     "strony": ["tak", "nie"], "stawki": [10, 20, 50],
                     "trzyma": "HENIO", "opcjonalny": True},
        "RANO_GRACZ": {"scena": 11, "pora": "rano", "kierowca": "GRACZ",
                       "q_ukryte": None, "p_tlumu_tak": 0.3,
                       "strony": ["tak"], "stawki": [10, 20, 50],
                       "trzyma": "HENIO", "opcjonalny": False,
                       "tlum": [{"kto": "HENIO", "strona": "nie", "stawka": 20},
                                {"kto": "ZDZICHU", "strona": "nie", "stawka": 20},
                                {"kto": "JUREK", "strona": "tak", "stawka": 20}],
                       "dola_przy_sukcesie": 10},
    },
}

FLAGI_Z_ROZGRYWKI = {
    "PODJECHAL_DO_KOMBI": {"wartosci": ["tak", "nie"], "domyslna": "nie",
                           "opis": "Gracz wjechał w strefę przy kombi w scenie 0."},
}

def kurs(p, pora):
    return round(0.9 / p * ZAKLADY["zasady"]["mnoznik_pory"][pora], 1)

for pid, pz in ZAKLADY["przejazdy"].items():
    pz["kurs"] = {"tak": kurs(pz["p_tlumu_tak"], pz["pora"])}
    if "nie" in pz["strony"]:
        pz["kurs"]["nie"] = kurs(1 - pz["p_tlumu_tak"], pz["pora"])

# ---------------------------------------------------------------- PARSER
RE_SCENA = re.compile(r"^# SCENA (\d+) — (.+)$")
RE_ZAK = re.compile(r"^### ZAKOŃCZENIE (\d+) — (.+)$")
RE_WARUNEK_BLOK = re.compile(r"^#### jeśli ([A-Z_]+) = (\S+)\s*$")
RE_KWESTIA = re.compile(r"^\*\*([A-ZĄĆĘŁŃÓŚŹŻ ]+):\*\*\s*(.+)$")
RE_EKRAN = re.compile(r"^▭ \*\*\((.+)\)\*\*\s*$")
RE_FLAGA = re.compile(r"⚑\s*\**([A-Z_]+)\s*=\s*([^\s*]+)\**")
RE_OPCJA = re.compile(r"^▸ \**\[([A-Z0-9]+)\]\**\s*(.*)$")
RE_CYTAT = re.compile(r"„([^”\"]+)[”\"]")

bledy, ostrzezenia = [], []

def parsuj(tekst):
    sceny, zakonczenia, epilog = [], [], []
    cel = None           # lista węzłów, do której dopisujemy
    warunek = None
    biezaca_opcje = None
    biezace_zak = None
    for nr, surowa in enumerate(tekst.splitlines(), 1):
        l = surowa.rstrip()
        s = l.strip()
        def dodaj(wezel):
            nonlocal biezaca_opcje
            if cel is None:
                return
            if warunek:
                wezel["warunek"] = dict(warunek)
            wezel["linia"] = nr
            cel.append(wezel)
        if not s.startswith("▸"):
            biezaca_opcje = None
        m = RE_SCENA.match(s)
        if m:
            sc = {"id": int(m.group(1)), "tytul": m.group(2), "wezly": []}
            sceny.append(sc); cel = sc["wezly"]; warunek = None; continue
        if s.startswith("## ZAKOŃCZENIA"):
            cel = None; warunek = None; continue
        m = RE_ZAK.match(s)
        if m:
            biezace_zak = {"id": int(m.group(1)), "nazwa": m.group(2).strip(), "warunek": {}, "wezly": []}
            zakonczenia.append(biezace_zak); cel = biezace_zak["wezly"]; warunek = None; continue
        if s.startswith("## EPILOG"):
            cel = epilog; warunek = None; biezace_zak = None; continue
        if s.startswith("## ") :
            cel = None; warunek = None; continue
        if cel is None or not s or s == "---":
            continue
        if s.startswith("Warunek:") and biezace_zak is not None:
            for kawalek in s[len("Warunek:"):].split("·"):
                k = kawalek.strip()
                mm = re.match(r"([A-Z_]+) = (\S+)", k)
                if mm:
                    biezace_zak["warunek"][mm.group(1)] = mm.group(2)
                elif k.startswith("kasa"):
                    mm = re.match(r"kasa\s*(≥|<)\s*(\d+)", k)
                    biezace_zak["warunek"]["kasa"] = {"op": ">=" if mm.group(1) == "≥" else "<",
                                                     "wartosc": int(mm.group(2))}
            continue
        m = RE_WARUNEK_BLOK.match(s)
        if m:
            warunek = {m.group(1): m.group(2)}; continue
        if s == "#### dalej":
            warunek = None; continue
        if s == "**KONIEC**":
            dodaj({"typ": "koniec"}); continue
        m = RE_EKRAN.match(s)
        if m:
            dodaj({"typ": "ekran", "tekst": m.group(1)}); continue
        if s.startswith("♪"):
            dodaj({"typ": "dzwiek", "tekst": s[1:].strip().strip("*").strip()}); continue
        if s.startswith("⚙"):
            cz = s[1:].split()
            dodaj({"typ": "mechanika", "polecenie": cz[0], "argumenty": cz[1:]}); continue
        if s.startswith("⟶"):
            dodaj({"typ": "hak", "tekst": s[1:].strip().strip("*").strip(), "pokaz": False}); continue
        m = RE_OPCJA.match(s)
        if m:
            reszta = m.group(2)
            opcja = {"id": m.group(1)}
            akcja = re.match(r"^\*\((.+?)\)\*", reszta)
            if akcja:
                opcja["akcja"] = akcja.group(1)
            przed, _, po = reszta.partition("→")
            c = RE_CYTAT.search(przed)
            if c:
                opcja["tekst"] = c.group(1)
            elif not akcja:
                bledy.append(f"linia {nr}: opcja bez tekstu: {s}")
            if po:
                mk = RE_KWESTIA.match(RE_FLAGA.sub("", po).strip())
                if mk:
                    opcja["odpowiedz"] = {"kto": mk.group(1), "tekst": mk.group(2).strip()}
            for f, v in RE_FLAGA.findall(reszta):
                opcja.setdefault("ustawia", {})[f] = v
            if biezaca_opcje is None:
                biezaca_opcje = {"typ": "wybor", "opcje": []}
                dodaj(biezaca_opcje)
            biezaca_opcje["opcje"].append(opcja)
            continue
        m = RE_KWESTIA.match(s)
        if m:
            dodaj({"typ": "kwestia", "kto": m.group(1).strip(), "tekst": m.group(2).strip()}); continue
        if s.startswith("*") and s.endswith("*"):
            dodaj({"typ": "opis", "tekst": s.strip("*").strip(), "pokaz": False}); continue
        if s.startswith("|") or s.startswith(">") or s.startswith("#"):
            continue
        ostrzezenia.append(f"linia {nr}: nierozpoznana linia: {s[:70]}")
    return sceny, zakonczenia, epilog

# ---------------------------------------------------------------- WALIDACJA
ZNANE_POLECENIA = {"kasa", "zaklad", "przejazd", "ladunek", "pasazer", "pasazer_spi",
                   "pasazer_budzi", "radio", "skok_czasu", "scenka", "tlum", "zakonczenie", "telefon"}

def waliduj(sceny, zakonczenia, epilog):
    ids = [s["id"] for s in sceny]
    if ids != list(range(len(ids))):
        bledy.append(f"numeracja scen nieciągła: {ids}")
    zdefiniowane = {f: set(v["wartosci"]) for f, v in FLAGI_Z_ROZGRYWKI.items()}
    zdefiniowane.update({pid: {"wygrana", "przegrana", "bez_zakladu"}
                         for pid in ZAKLADY["przejazdy"] if pid != "RANO_GRACZ"})
    zdefiniowane["RANO_GRACZ"] = {"sukces", "porazka"}
    wszystkie = [w for s in sceny for w in s["wezly"]] + \
                [w for z in zakonczenia for w in z["wezly"]] + epilog
    for w in wszystkie:
        if w["typ"] == "wybor":
            for o in w["opcje"]:
                for f, v in o.get("ustawia", {}).items():
                    zdefiniowane.setdefault(f, set()).add(v)
    for w in wszystkie:
        for f, v in w.get("warunek", {}).items():
            if f not in zdefiniowane:
                bledy.append(f"linia {w['linia']}: warunek na niezdefiniowanej fladze {f}")
            elif v not in zdefiniowane[f]:
                bledy.append(f"linia {w['linia']}: {f} nie przyjmuje wartości '{v}' (ma: {sorted(zdefiniowane[f])})")
        if w["typ"] == "mechanika":
            if w["polecenie"] not in ZNANE_POLECENIA:
                bledy.append(f"linia {w['linia']}: nieznane polecenie ⚙ {w['polecenie']}")
            if w["polecenie"] in ("zaklad", "przejazd", "tlum") and w["argumenty"][0] not in ZAKLADY["przejazdy"]:
                bledy.append(f"linia {w['linia']}: nieznany przejazd {w['argumenty']}")
        if w["typ"] == "kwestia" and len(w["tekst"].split()) > 14:
            ostrzezenia.append(f"linia {w['linia']}: długa kwestia ({len(w['tekst'].split())} słów): {w['tekst'][:50]}")
    for z in zakonczenia:
        for f, v in z["warunek"].items():
            if f != "kasa" and v not in zdefiniowane.get(f, set()):
                bledy.append(f"zakończenie {z['id']}: zły warunek {f}={v}")
    return {f: sorted(v) for f, v in zdefiniowane.items()}

# ---------------------------------------------------------------- SYMULACJA
def symuluj(sceny, zakonczenia, strategia):
    """strategia: dict flag wyborów + zakłady: {'NOC_BMW': ('tak',20,wynik_bool) | None, ...,
       'RANO_GRACZ': (stawka, sukces_bool)}"""
    flagi = {"PODJECHAL_DO_KOMBI": "tak" if strategia.get("NOC_BMW") is not None else "nie"}
    kasa = EKONOMIA["kasa_start"]
    def spelnia(w):
        return all(flagi.get(f) == v for f, v in w.get("warunek", {}).items())
    for sc in sceny:
        for w in sc["wezly"]:
            if not spelnia(w):
                continue
            if w["typ"] == "wybor":
                opcje = [o for o in w["opcje"] if o.get("ustawia")]
                if opcje:
                    f = list(opcje[0]["ustawia"])[0]
                    wybrana = next(o for o in opcje if o["ustawia"][f] == strategia[f])
                    flagi.update(wybrana["ustawia"])
            elif w["typ"] == "mechanika":
                p, a = w["polecenie"], w["argumenty"]
                if p == "kasa":
                    kasa += int(a[0].replace("−", "-").replace("+", ""))
                elif p == "przejazd":
                    pid = a[0]; pz = ZAKLADY["przejazdy"][pid]
                    if pid == "RANO_GRACZ":
                        stawka, sukces = strategia["RANO_GRACZ"]
                        flagi[pid] = "sukces" if sukces else "porazka"
                        if stawka:
                            kasa += round(stawka * pz["kurs"]["tak"]) - stawka if sukces else -stawka
                    else:
                        z = strategia.get(pid)
                        if z is None:
                            flagi[pid] = "bez_zakladu"
                        else:
                            strona, stawka, tak_wyszlo = z
                            wygrana = (strona == "tak") == tak_wyszlo
                            flagi[pid] = "wygrana" if wygrana else "przegrana"
                            kasa += round(stawka * pz["kurs"][strona]) - stawka if wygrana else -stawka
                assert kasa >= 0, "kasa ujemna"
    for z in zakonczenia:
        war = z["warunek"]
        ok = all(flagi.get(f) == v for f, v in war.items() if f != "kasa")
        k = war.get("kasa")
        if k:
            ok = ok and (kasa >= k["wartosc"] if k["op"] == ">=" else kasa < k["wartosc"])
        if ok:
            return z["nazwa"], kasa, flagi
    raise AssertionError(f"brak zakończenia dla {flagi}, kasa {kasa}")

def pelna_symulacja(sceny, zakonczenia):
    noc = [None] + [(s, st, w) for s in ("tak", "nie") for st in (10, 20) for w in (True, False)]
    bus = [None] + [(s, st, w) for s in ("tak", "nie") for st in (10, 20, 50) for w in (True, False)]
    gracz = [(st, w) for st in (0, 10, 20, 50) for w in (True, False)]
    wyniki, trafione = [], {}
    for n, kw, pr, pi, b, g in itertools.product(noc, ("tak", "nie"), ("powiedzial", "zmilczal"),
                                                 ("dane", "kiedys"), bus, gracz):
        strat = {"NOC_BMW": n, "KAMIL_WIE": kw, "PRAWDA": pr, "PIWO": pi, "RANO_BUS": b, "RANO_GRACZ": g}
        nazwa, kasa, _ = symuluj(sceny, zakonczenia, strat)
        trafione[nazwa] = trafione.get(nazwa, 0) + 1
        wyniki.append((strat, nazwa, kasa))
    # macierz bazowa (bez zakładu nocnego i na busa)
    macierz = []
    for pr, pi in itertools.product(("zmilczal", "powiedzial"), ("kiedys", "dane")):
        wiersz = {"PRAWDA": pr, "PIWO": pi}
        _, przed, _ = symuluj(sceny, zakonczenia, {"NOC_BMW": None, "KAMIL_WIE": "nie", "PRAWDA": pr,
                                                   "PIWO": pi, "RANO_BUS": None, "RANO_GRACZ": (0, False)})
        wiersz["kasa_przed_switem"] = przed
        wiersz["min_stawka_na_siebie"] = None
        for st in (0, 10, 20, 50):
            nazwa, kasa, _ = symuluj(sceny, zakonczenia, {"NOC_BMW": None, "KAMIL_WIE": "nie", "PRAWDA": pr,
                                                          "PIWO": pi, "RANO_BUS": None, "RANO_GRACZ": (st, True)})
            if kasa >= EKONOMIA["cel"]:
                wiersz["min_stawka_na_siebie"] = st; wiersz["po_sukcesie"] = kasa; break
        macierz.append(wiersz)
    return len(wyniki), trafione, macierz, min(k for _, _, k in wyniki), max(k for _, _, k in wyniki)

# ---------------------------------------------------------------- MAIN
def main():
    tekst = SCENARIUSZ.read_text(encoding="utf-8")
    sceny, zakonczenia, epilog = parsuj(tekst)
    flagi = waliduj(sceny, zakonczenia, epilog)
    dane = {
        "tytul": "W nocy robota",
        "wersja": "MVP 4 · 29.09.2026",
        "zrodlo": "scenariusz-mvp.md (nie edytuj JSON-a ręcznie)",
        "ekonomia": EKONOMIA,
        "zaklady": ZAKLADY,
        "flagi": {f: {"wartosci": v} for f, v in flagi.items()},
        "flagi_z_rozgrywki": FLAGI_Z_ROZGRYWKI,
        "placeholdery_ekranu": {"[KASA]": "aktualna kasa gracza w zł",
                                "[BRAK]": "max(0, cel - kasa) w zł"},
        "sceny": sceny,
        "zakonczenia": zakonczenia,
        "epilog": epilog,
    }
    WYJSCIE.write_text(json.dumps(dane, ensure_ascii=False, indent=2), encoding="utf-8")
    liczniki = {}
    for sc in sceny:
        for w in sc["wezly"]:
            liczniki[w["typ"]] = liczniki.get(w["typ"], 0) + 1
    print(f"Zapisano {WYJSCIE.name}: {len(sceny)} scen, {len(zakonczenia)} zakończenia, węzły: {liczniki}")
    print(f"Flagi: {flagi}")
    if "--bez-symulacji" not in sys.argv and not bledy:
        n, traf, macierz, kmin, kmax = pelna_symulacja(sceny, zakonczenia)
        print(f"Symulacja: {n} ścieżek, kasa końcowa {kmin}–{kmax} zł, zakończenia: {traf}")
        for w in macierz:
            print("  ", w)
        dane["symulacja"] = {"sciezek": n, "zakonczenia": traf, "macierz_bazowa": macierz,
                             "kasa_min": kmin, "kasa_max": kmax}
        WYJSCIE.write_text(json.dumps(dane, ensure_ascii=False, indent=2), encoding="utf-8")
    for o in ostrzezenia:
        print("OSTRZEŻENIE:", o)
    for b in bledy:
        print("BŁĄD:", b)
    sys.exit(1 if bledy else 0)

if __name__ == "__main__":
    main()

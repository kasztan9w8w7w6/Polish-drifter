# Braki – czego potrzeba do kolejnych sesji

Stan po v0.6f. Priorytety:
- **P1** – blokuje najbliższą sesję;
- **P2** – potrzebne w danej wersji;
- **P3** – kiedyś.

Wersje według [`ROADMAP.md`](../ROADMAP.md):
- S2 v0.7 – jazda, dźwięk i orientacja;
- S3 v0.8 – polski świat;
- S4 v0.9 – większa mapa;
- S5 – fabuła;
- później – trasa nad wodą.

> Zdjęcia referencyjne jeszcze nie dotarły (`docs/referencje/` było puste), więc lista zdjęć niżej to „czego szukać”,
> a nie „czego brakuje w tym, co przyszło”. Po wgraniu zdjęć ten plik zostanie przejrzany jeszcze raz.

## Top 10

| # | Co | Dla | Kto | P |
|---|---|---|---|---|
| 1 | **Zdjęcia referencyjne w repo** (`docs/referencje/`, instrukcja w README tam) – bez nich nie ma KATALOG, STYL i planu mapy | v0.8, v0.9 | Ty | P1 |
| 2 | **Dźwięk silnika Poloneza** (nagranie: jałowy, stałe obroty 1500/3000/4500, gaz do odcięcia; najlepiej 3 pętle) – teraz gra generyczny silnik Kenneya | v0.7 | Ty (nagranie) albo ja (szukam CC0/CC-BY) | P1 |
| 3 | **Eksport OSM osiedla-wzoru** (`.osm` albo GeoJSON, obszar ok. 1 × 1 km) + ujęcia z drona tego samego miejsca | v0.9 | Ty | P1 |
| 4 | **Orientacja na mapie**: minimapa / kompas / strzałki do celu, nazwy ulic na tabliczkach | v0.7 | ja z kodu | P1 |
| 5 | **Muzyka**: 2–4 utwory na „radio” (doomer, zimna fala, disco polo w krzywym zwierciadle) – licencja pozwalająca na grę | v0.7 radio | Ty (wybór/zamówienie) albo ja (CC-BY z list) | P2 |
| 6 | **Auta z epoki na parkingach i w ruchu**: Maluch, Duży Fiat, Żuk/Nysa, Tico, Lanos – teraz są auta Kenneya | v0.8 | ja: low-poly z kodu; Ty: zgoda na płatne/CC-BY modele | P2 |
| 7 | **Postacie**: modele zamiast brył (dres, emeryt, sąsiad z wąsem, pani ze sklepu) + animacja stania/gestu | v0.8 | ja: próba z CC0 (Quaternius/Kenney); Ty: decyzja o stylu | P2 |
| 8 | **Nocne zdjęcia oświetlenia**: sodowe latarnie (pomarańcz), świetlówki na klatkach, neony sklepów, okna – do kolorów świateł | v0.8 | Ty | P2 |
| 9 | **Dźwięki otoczenia**: szum miasta nocą, pies, tramwaj z daleka, brzęczenie latarni/świetlówki, drzwi klatki, kroki | v0.7 | ja (CC0: freesound, Kenney) | P2 |
| 10 | **Teksty docelowe** od scenarzysty (misje, dialogi, narrator; teraz wszystko `PLACEHOLDER`, instrukcja `docs/teksty.md`) | S5 | scenarzysta | P2 |

## Zdjęcia i ujęcia (Ty)

Szczegóły folderów: [`referencje/README.md`](referencje/README.md).

| Co | Ujęcia | P |
|---|---|---|
| Bloki | elewacja na wprost (dzień), klatka z bliska (drzwi, daszek, domofon, luksfery), balkony, szczyt bloku, dach z maszynownią; to samo nocą | P1 |
| Nawierzchnie | asfalt z łatami i dziurami, płyty chodnikowe (trylinka, „sześciokąty”), krawężniki, studzienki, bruk – z góry, prostopadle | P1 |
| Dron | osiedle z góry (układ bloków, podwórka, parkingi), ukos 45° jak kamera w grze | P1 |
| Noc | latarnie sodowe i LED z daleka, klatki, okna, sklep nocny, stacja – bez flesza | P2 |
| Sklepy i pawilony | szyldy (kształt, liternictwo), kraty, witryny, kioski, budka z kebabem | P2 |
| Stacja paliw | wiata, dystrybutor, kiosk, oświetlenie (lokalna/stara, nie sieciowa) | P2 |
| Garaże | rząd blaszaków, bramy, zamki, plac przed nimi | P2 |
| Auta z epoki | bok, przód, tył (do low-poly), tablice rejestracyjne starego wzoru | P2 |
| Nad wodą | bulwar, nabrzeże, most, parking przy wodzie, oświetlenie nocne | P3 |

## Modele

| Co | Teraz | Plan | Kto | P |
|---|---|---|---|---|
| Polonez gracza | Sketchfab Standard (patrz CREDITS – licencja przy publicznym repo) | zgoda autora albo własny low-poly | Ty (kontakt z autorem) | P2 |
| Auta tła | Kenney Car Kit (sedan, suv, van, taxi…) | Maluch, Duży Fiat, Żuk, Nysa, Tico, Lanos low-poly | ja z kodu (bryły jak bloki) | P2 |
| Rywal Zbyszek | Kenney sedan-sports | Duży Fiat / BMW E30 „z Niemiec” | ja | P3 |
| Postacie | bryły z kodu (`src/npc.js`) | modele CC0 z animacją | ja (jeśli pobiorę) / Ty (wybór stylu) | P2 |
| Sklepy, pawilony | Kenney City Kit Commercial | pawilon handlowy PRL, kiosk RUCH-owy, budka | ja z kodu | P2 |
| Garaże | Kenney City Builder | blaszaki z falistej blachy, różne kolory i rdza | ja z kodu | P2 |
| Drzewa, płoty | Kenney Suburban | brzozy, topole, siatka, betonowy płot „jodełka” | ja z kodu | P3 |
| Detale | – | kosze, wiaty śmietnikowe, słupki, tablice ogłoszeń, anteny satelitarne na balkonach | ja z kodu | P3 |

## Dźwięk i muzyka

| Co | Teraz | Brakuje | Kto | P |
|---|---|---|---|---|
| Silnik | `engine.ogg` Kenneya (pitch z obrotów) | prawdziwy Polonez 1.6: pętle na kilku obrotach, zmiana biegu, gaśnięcie, rozruch | Ty (nagranie) / ja (CC-BY) | P1 |
| Opony | `skid.ogg` | pisk na betonie vs asfalcie, szuranie po trawie | ja | P3 |
| Uderzenia | `impact.ogg` | blacha, beton, siatka, słupek | ja (CC0) | P2 |
| Otoczenie | szum 5G (Web Audio) | noc na osiedlu (ambient), pies, tramwaj, świetlówka, klatka | ja (CC0) | P2 |
| UI | klik maszyny do pisania (Web Audio) | kasa, szacun w górę, rezerwa (jest pisk) | ja z kodu | P3 |
| Muzyka / radio | brak | 2–4 utwory + szum strojenia, jingle „stacji” | Ty (wybór, licencja) / ja (CC-BY) | P2 |
| Głosy | brak | okrzyki „e, dobre!”, „słabo”, mruknięcia do dymków (bez pełnego dubbingu) | Ty (nagrania znajomych) | P3 |

## Co zrobię sam z kodu

- Orientacja: minimapa (render z góry lub z danych mapy), strzałka/kompas, tabliczki z nazwami ulic, nazwy stref przy wjeździe.
- Auta z epoki, pawilony, garaże, kioski i detale jako bryły z kodu (jak bloki w `src/blocks.js`), kolory ze `STYL.md`.
- Paleta i oświetlenie według `STYL.md`: kolory latarni (sód / LED), okien, szyldów, nawierzchnie w teksturze podłoża.
- Większa mapa z eksportu OSM: skrypt OSM → `src/maps/*.json` (drogi, obrysy bloków, parkingi) rozwijający `scripts/build-map.py`.
- Dźwięki proceduralne (UI, szum, brzęczenie świetlówki) i wyszukanie CC0/CC-BY (każdy wpis do `CREDITS.md`).
- Decyzje z ostatniej rozmowy (w v0.7): kasa za drift w wolnej jeździe tylko przy ludziach (ok. 1/3 stawki z misji),
  tankowanie „na zeszyt” z limitem −40 zł i spłatą długu przy następnym tankowaniu.

## Co musisz dostarczyć

- Zdjęcia, drony, eksporty OSM i screeny w `docs/referencje/` (P1) – z `opis.txt`.
- Wybór miejsca-wzoru dla większej mapy (jedno konkretne osiedle albo „zlepek” kilku) i miejsca nad wodą.
- Nagranie Poloneza (albo zgoda na szukanie CC-BY z przypisem autora).
- Decyzja o muzyce: styl, czy mogą być utwory z licencją CC-BY (z przypisem), czy tylko własne/zamówione.
- Decyzja o Polonezie z Sketchfab przy publicznym repo (licencja).
- Teksty scenarzysty (S5).

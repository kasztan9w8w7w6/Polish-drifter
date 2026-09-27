# Changelog – Agro Drifter

Wersje do v0.4c mają lokalne tagi w git (serwer odrzuca wypychanie tagów); od v0.5 wersję znajdziesz po commicie „v0.5a – …”.
Plan dalszych wersji: [`ROADMAP.md`](ROADMAP.md).

## v0.5c – prawdziwe osiedle
- **Bloki z wielkiej płyty z kodu** (`src/blocks.js`) zamiast rozciągniętych budynków Kenneya:
  - płyty ze spoinami i zaciekami, rzędy okien (ok. 22% zapalonych: ciepłe, pomarańczowe, zimne, niebieskie od telewizora, z firankami);
  - nad każdą klatką pionowy pas luksferów, przy wejściu drzwi, daszek, lampka i plama światła na chodniku;
  - balkony z kolorowymi balustradami od podwórka, maszynownie wind i anteny na dachu, na Bloku 1 maszt 5G z migającym światłem;
  - 4 i 10 pięter, 1–4 klatek; za płotem kolejne bloki jako tło.
- **Nowy układ** (plan w `docs/mapa.md`, generator `scripts/build-map.py`):
  - ulice w zamkniętych pętlach (duża: Kosmonautów–Gagarina–Tereszkowej–Lotników, dzielona ul. Komarowa na północną i południową);
  - główna 10 m z liniami i pasami, uliczki osiedlowe 6 m bez linii;
  - między blokami podwórka (trawa, chodniki, plac zabaw, trzepaki, ławki), parkingi osobno;
  - garaże z placem przy ul. Tereszkowej; plac pod Supersamem z wjazdami z Gagarina i z głównej.
- **Podłoże jako jedna pikselowa tekstura** (`src/ground.js`, 0,25 m na teksel):
  - jezdnie, chodniki z płyt, asfalt placów, bruk, trawa, krawężniki;
  - narożniki i skrzyżowania zaokrąglone automatycznie (zamknięcie morfologiczne), więc zniknął źle obrócony zakręt
    i wszystkie kafle Kenneya (`roads.js` usunięty).
- **Przeciwnik w wyścigu szybszy:** 97 km/h na prostej, szybciej przyspiesza i bierze zakręty; na nowej trasie (433 m) wyścig jest wyrównany.
- **Testy:**
  - pętle zamknięte, narożniki zaokrąglone, pasy wolne, podwórka to nie jezdnia, place i garaże połączone z ulicami;
  - wszystkie cele misji 1–3 i postacie osiągalne autem;
  - pełny wyścig autopilota Poloneza z przeciwnikiem po kolizjach mapy.

## v0.5b – postacie, rozmowy, misje 2–3 (MVP)
- **Postacie na osiedlu:** Seba, Kamil i Dawid przy placu pod Supersamem, Sąsiad Zbyszek pod Blokiem 2,
  Pani Halina przy Bloku 1, Mietek przy garażach, Pan Zdzisio przed Żappką.
  - Wygląd: niskopoligonowe bryły z kodu (dresy z paskami, czapki, kaptur, brzuch, papieros, reklamówka),
    bo modeli CC0 nie dało się pobrać; model `.gltf` podmienia się wpisem w danych.
  - Ruch: animacja bezczynności (oddech, kiwanie, palenie, ręce za plecami), głowa odwraca się do auta,
    kolizja jak z człowiekiem, nie przejedziesz przez nich.
- **Rozmowy:**
  - stań obok postaci, pojawi się podpowiedź; rozmowę zaczyna E / B na padzie / przycisk „rozmowa” na dotyku;
  - okienko u dołu z imieniem i pikselowym portretem (rysowanym z kolorów postaci), tekst pisany jak narrator
    (z kliknięciami), dalej E / Enter / A, wybory odpowiedzi (↑↓, 1–4, dotyk) z rozgałęzieniami i wynikiem rozmowy;
  - rozmowy to pliki JSON (`src/story/dialogi`).
- **Misja 2 „Pokaz”:** rozmowa z Sebą (odmowa = poczeka), potem 3000 pkt driftu na placu w 60 s (zegar od wjazdu,
  liczą się tylko punkty na placu), porażka = kolejna próba. Chłopaki reagują dymkami („dawaj!” przy głębokim
  szybkim drifcie, „słabo” przy nieśmiałym, coś przy uderzeniu i przy staniu) i podnoszą ręce.
- **Misja 3 „Wyścig z sąsiadem”:** Zbyszek w aucie z Car Kit, 2 okrążenia dookoła osiedla, meta pod blokiem.
  - Przeciwnik jedzie po wygładzonej trasie z mapy (Catmull-Rom z three.js): hamuje przed zakrętami, łagodnie
    dopasowuje tempo do gracza, omija gracza zamiast przez niego przejechać i nie teleportuje się (maks. 0,43 m na klatkę).
  - Na ekranie: odliczanie, okrążenie, pozycja, przewaga, strzałka na trasę; skrót przez podwórko nie liczy się do postępu.
  - Przegrana = start od nowa. Po wygranej Zbyszek wysiada przy swoim aucie na rozmowę.
- **Kolejność misji** w `src/story/kampania.json`. Po podsumowaniu Enter / dotknięcie = następna misja.
  „Kontynuuj” wraca do ostatniej misji i kroku, po ostatniej misji – wolna jazda.
- **Teksty:** wszystkie teksty (misje, rozmowy, narrator, okrzyki, teksty systemowe w `src/story/teksty.json`)
  są oznaczone `PLACEHOLDER` i do podmiany bez kodu – instrukcja w `docs/teksty.md`.

## v0.5a – szybkie poprawki
- **Obraz ściśnięty na komputerze (błąd krytyczny):** rozmiar canvasu jest teraz sprawdzany w każdej klatce (i przy `resize`),
  nie tylko po wczytaniu. Wcześniej zmiana rozmiaru okna/ramki w trakcie ładowania (maksymalizacja, ramka artefaktu)
  zostawiała canvas w pierwszym rozmiarze. Sprawdzone: 1366×768, 1920×1080, 2560×1440, zmiana rozmiaru w czasie ładowania, telefon w poziomie.
- **Piksele:** Drobne / Średnie / Grube ≈ 540 / 360 / 270 linii (1080p: piksel 2 / 3 / 4) i zawsze trzy różne rozmiary
  (przy każdej wysokości ekranu każdy grubszy poziom ma piksel co najmniej o 1 większy).
- **Pisk opon:** tylko przy poślizgu bocznym (nowy `sideSlip` 0–90°, taki sam w przód i wstecz) i buksowaniu przy ruszaniu
  pełnym gazem; cofanie już nie piszczy i nie zostawia śladów.
- **Obrót (Normalny/Pro):** najwyżej jeden – obrót nadwozia jest tłumiony od wykrycia bączka (dokłada ~250° w `proSpinTime`),
  auto wytraca prędkość i staje; przez 1 s po obrocie nie da się wejść w nowy poślizg.
- **Garaż:** obracanie auta przeciąganiem myszą / palcem, z bezwładnością; po 2,5 s bezczynności wraca powolny auto-obrót.
- **Narrator:** wolniejsze pisanie jak na maszynie (przerwy po przecinkach i kropkach), ciche kliknięcie przy każdej literze
  (losowa wysokość, bez dźwięku na spacjach), głośność „Pisanie” w ustawieniach dźwięku, tekst zostaje dłużej.

## v0.4c – logiczne osiedle
- Plan osiedla w `docs/mapa.md` (szkic ASCII, strefy, zasady) i zbudowana z niego mapa 200 × 200 m.
- Ulica główna z latarniami po obu stronach, przystankiem i pasami; uliczki osiedlowe; kafle skrzyżowań dobierane automatycznie.
- Bloki równolegle / prostopadle wzdłuż uliczek, podwórko (plac zabaw, trzepaki, ławki, zieleń), parking przed blokiem,
  rząd garaży, pawilony i Żappka 24h przy głównej, market „Supersam” z dużym placem do driftu, paczkomat przy wejściu do bloku.
- Test: nic nie stoi na jezdni, każda ulica przejezdna, cele misji i plac do driftu wolne. Misja 1 przestawiona na nową mapę.
- Widok `?plan` (cała mapa z góry).

## v0.4b – kamera, zegary, menu
- Kamera Diorama niżej (35°) i obrócona 28° od osi mapy; piksele nadal przyciągane do siatki.
- Rozmiar piksela z rozdzielczości ekranu: Drobne / Średnie / Grube (≈ 540 / 360 / 240 linii), domyślnie Średnie.
- Zegary w stylu aut z bloku wschodniego: analogowy prędkościomierz i obrotomierz, bateria jak zegar paliwa, kontrolki, okienko biegu,
  bębenkowy licznik punktów; ciepłe podświetlenie, pikselowe.
- Menu po polsku: Graj / Kontynuuj / Garaż (obracający się Polonez, lakiery z epoki) / Ustawienia (grafika, dźwięk, sterowanie
  z przypisywaniem klawiszy i poziomem jazdy), menu pauzy (Esc / Start). Ustawienia i postęp w localStorage.

## v0.4a – trudniejsza jazda i bateria
- Nowy domyślny preset **Normalny** (wymagający): zwykły skręt trzyma przyczepność. Poślizg wywołuje dopiero ręczny od ~40 km/h,
  gwałtowne odpuszczenie gazu w szybkim zakręcie (od ~54 km/h, przeniesienie masy) albo pełny gaz z pełnym skrętem od ~61 km/h.
- W poślizgu kąt nie trzyma się sam: rośnie z gazem, kontra go zmniejsza, za mało gazu – auto się prostuje, zaniedbany drift = obrót,
  za mocna kontra przy wyjściu – zarzuca w drugą stronę. Auto ma pęd: w szybkim zakręcie i w drifcie wynosi je na zewnątrz.
- **Pro** jeszcze trudniejszy (wyższe progi, szybciej ucieka tył, obrót od 55°). **Łatwy** (dawna jazda z asystą) zostaje jako opcja dostępności.
- Bateria: bez driftu gaśnie po 60–90 s jazdy; ładuje tylko porządny drift (≥ 20°, ≥ 32 km/h), tym szybciej, im dłuższa czysta seria;
  uderzenie przerywa serię i ładowanie na 2 s. Misja 1 startuje z 60%.

## v0.3d – testowe sterowanie mobilne
- Dotyk wykrywany po możliwościach ekranu; joystick nipplejs lub przyciski ◀ ▶, gaz, hamulec, ręczny (kilka palców naraz).
- Pełny ekran z próbą blokady poziomu, plansza „Obróć telefon”, niższa jakość na dotyku, FPS w panelu, pauza w tle.

## v0.3c – bateria, sklep, misja 1
- Bateria ładowana tylko driftem, reflektory zależne od baterii, 0% = gaśnięcie i restart z punktu zapisu.
- Żappka 24h jako punkt zapisu (świecące pole), narrator, misje w JSON, misja 1 „Paczka”.

## v0.3b – ręczna mapa osiedla
- Mapa w pliku danych (`src/maps/osiedle.json`), kolizje z geometrii modeli na wysokości karoserii.

## v0.3a – profile aut, kontra
- Profil Poloneza 1500 w JSON (realne dane + wartości arcade), paleta lakierów z epoki.
- Wizualna kontra przednich kół; w Pro prawdziwa kontra.

## v0.2e – Polonez i assety
- Model Poloneza (koła na kościach), osiedle z Kenney City Kit / Car Kit.
- Uderzenia karoserią: kolizje w faktycznych wymiarach, odbicie zależne od materiału.

## v0.2d – diorama i pixel-art
- Kamera Diorama (orto 3/4, piksele przyciągane do siatki), materiały toon, obrysy, mgła radialna.

## v0.2c – poprawki jazdy
- Płynny kąt driftu, power oversteer w Pro, bez odbić, bez utykania.

## v0.2b – noc, PS1, assety, dźwięk
- Noc, efekt PS1, pierwsze assety, dźwięk (Howler), HUD.

## v0.2a – fizyka arcade
- Auto jako toczona kula (Kenney Starter Kit Racing) + drift na wierzchu, nowa kamera.

## v0.1.5 – Rapier
- Rapier i model opon (RaycastVehicle); zastąpione w v0.2a.

## v0.1 – pierwsza jazda
- Przeglądarkowa gra driftingowa na three.js + cannon-es.

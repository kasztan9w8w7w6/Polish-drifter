# Agro Drifter – pamięć projektu

> Ten plik czytają asystenci AI pracujący nad repo (kopia: `GEMINI.md`). Aktualizuj oba razem.

## O grze

**Agro Drifter** to mroczna, groteskowa gra fabularna o jeździe starym polskim autem
(Polonez, napęd na tył) nocą po osiedlu. Estetyka: czysty pixel-art 3D jak diorama (kamera 3/4), polish doomer, satyra:
gracz ucieka przed „promieniowaniem 5G”.

- **Jazda:** arcade. Drift ma być łatwy, płynny i widowiskowy, a auto nie dachuje.
- **Klimat:** noc, czarna mgła, bloki z wielkiej płyty, dziurawe drogi, garaże, nocne sklepy z fikcyjnymi nazwami.
- **Przyszłe mechaniki:**
  - (zrobione: v0.3 narrator i misje; v0.6d pętla paliwo → drift → kasa → wydatki → szacun odblokowuje misje, zamiast baterii),
  - kolejne misje i dialogi,
  - radio zmieniające mgłę i przyczepność,
  - uszkodzenia.

## Warstwy (roadmapa)

Tabela wersji jest w [`ROADMAP.md`](ROADMAP.md) (tam dopisuj nowe). Teraz: v0.5 – MVP (misje, postacie, dialogi,
osiedle z wielkiej płyty); dopracowanie sterowania mobilnego w v0.15.

## Zasady pracy

1. **Gotowce zamiast kodu od zera.** Najpierw szukaj paczki, silnika, shadera lub przykładu; własny kod tylko jako klej i logika gry.
2. **Nie modyfikuj bibliotek** (`node_modules`, vendorowanego kodu). Obejścia rób w naszym kodzie z komentarzem.
3. **Małe kroki z testami.** Zmiana fizyki = uruchom `npm test` (scenariusze jazdy w Node) i podaj zmierzone wartości.
4. **Każdy asset** (model, tekstura, dźwięk, font) wpisz do `CREDITS.md` ze źródłem i licencją.
5. Nie przepisuj niezwiązanego kodu. Dostosowuj go do zmian.
6. **Stała zasada: po każdej wersji otwórz PR do `main` i scal go, jeśli testy przechodzą** (`npm test`, `npm run typecheck`,
   build). Potem kolejna praca zaczyna się od świeżego `main`.
7. Wszystko musi działać bez klawiatury: dotyk (przyciski / „dotknij”) i pad. Wybory = panel.js (przyciski), sprawdzenie:
   `scripts/e2e-dotyk.cjs` (misje 1→2→3 samym dotykiem) i `scripts/e2e-pad.cjs`.

## Architektura (v0.3)

```
src/physics.js  – jedyne miejsce z Rapierem poza vehicle.ts: świat, stały krok 60 Hz, przeszkody (`surface` → SURFACES), debugRender
src/vehicle.ts  – auto arcade (port Kenney Starter Kit Racing, vehicle.gd): toczona KULA r = 1 m + drift na wierzchu.
                  Wejście: { throttle, brake, steer (+ = lewo), handbrake } 0..1 / -1..1
                  Wyjście: vehicle.state { position, quaternion, velocity, speed, slipAngle, driftAngle, drifting,
                  sideSlip (0–90°, cofanie ≠ poślizg), wheelspin, bodyRoll, bodyPitch, wheels[] }
src/tuning.ts   – wszystkie parametry jazdy i kamery + presety „Normalny” (domyślny, wymagający), „Pro”, „Łatwy” (dostępność)
src/cars/*.json – profile aut (real: silnik, przełożenia, opony, Cd, masa, bak, źródła; arcade: odniesienie prowadzenia; paleta
                  lakierów FSO z kodami, model); nowe auto = nowy plik
src/engines/*.json – silniki (moc/obroty, moment/obroty, obroty jałowe/maks., zużycie, źródła) – pod swapy w garażu
src/engine.js   – NAPĘD z realnych danych (docs/fizyka-aut.md): krzywa momentu z punktów, automatyczna skrzynia, przełożenie
                  główne, sprawność, opór powietrza i toczenia, masy wirujące, czynnik zabawy `fun` (lil-gui); bez DOM
src/cars.js     – applyCar (masa, odniesienie prowadzenia → tuning), carDrivetrain (profil + silnik → engine.js)
src/camera.ts   – kamera „Diorama” (orto, 35° w dół, obrócona 28° od osi mapy, przyciągana do siatki pikseli) i „Za autem” (port view.gd), klawisz C
src/car.js      – wygląd auta: model Poloneza (koła = kości, kręcą się i skręcają), przechył, reflektory; zastępcze bryły
src/track.js    – podłoże fizyczne i trawa za płotem, ściany, słupki opon, pachołki (pozycje z mapy)
src/maps/*.json – mapa w pliku danych (plan i strefy: docs/mapa.md): ulice (streets: osie, szerokość, chodnik, glowna = linie),
                  areas (asfalt placów/parkingów, bruk, ziemia), paths (chodniki na podwórkach), crossings, blocks (wielka płyta),
                  obiekty Kenneya (model, x, z, yaw, rozmiar, kolizja, materiał), props z własnej geometrii, latarnie, dziury, parkingi,
                  szyldy, paczkomat, sklep, punkty misji, npcs, routes. Edytuj tu, nie w kodzie; opis pól w `_help`.
                  scripts/build-map.py generuje ją z planu (v0.5c).
src/ground.js   – podłoże jako jedna pikselowa tekstura (0,25 m/teksel) z danych mapy: rasterize() bez DOM (testy), zaokrąglone
                  narożniki przez zamknięcie morfologiczne maski jezdni (EDT), krawężniki, linie i pasy tylko na głównej
src/blocks.js   – bloki z wielkiej płyty z kodu: płyty ze spoinami, okna (część zapalona, kolory), klatki (luksfery, drzwi, daszek,
                  lampka, plama światła), balkony, maszynownie, maszt 5G; blockLayout() bez DOM (wymiary, wejścia, obrys)
src/map.js      – buduje mapę z pliku: podłoże (ground.js), bloki (blocks.js), modele Kenneya, latarnie, dziury (tylko wygląd), linie parkingowe, paczkomat,
                  ławki / trzepaki / piaskownica / huśtawka / przystanek, szyldy. Kolizja modelu = obrys jego geometrii na wysokości
                  karoserii (0,1–2,2 m): drzewo = pień. `?plan` w adresie: cała mapa z góry (docs/mapa.png).
src/pixelart.js – pixel-art: RenderPixelatedPass (przykład three.js webgl_postprocessing_pixel), materiały toon z N stopniami,
                  posteryzacja jasności, mgła radialna wokół auta (podmienione chunki fog_*), opcjonalne drżenie PS1
src/economy.js  – paliwo, kasa, szacun (logika bez DOM, testy w Node): spalanie z prawdziwych obrotów i obciążenia (bsfc
                  silnika × fuelScale), rezerwa, pusty bak (pchanie / holowanie), stacja, dług (bez blokady gry), kasa za drift
                  w misji i pokazie, szacun za drift przy ludziach, poziomy, energetyk; zapis (snapshot/restore)
src/panel.js    – (patrz niżej) panele stacji „Kometa”, pustego baku, sklepu w Żappce
src/typewriter.js – pisanie jak na maszynie (przerwy po znakach interpunkcyjnych, `keys` = litery do kliknięć); narrator i dialogi
src/narrator.js – narrator: tekst u góry, pisany typewriter.js, kliknięcie na literę (audio.type), znika po kilku sekundach, nie pauzuje gry
src/mission.js  – wykonawca misji z plików danych; src/missions/*.json – kroki (reach / battery / wait / talk / score / race),
                  cele, teksty, podpowiedzi
src/campaign.js – kolejność misji (src/story/kampania.json) i „Kontynuuj” (postęp { mission, step, save })
src/story/      – teksty fabularne (wszystkie PLACEHOLDER, docs/teksty.md): postacie.json (imię, wygląd, rozmowa, okrzyki),
                  dialogi/*.json (węzły, wybory, wynik), teksty.json (systemowe), kampania.json
src/dialogue.js – logika rozmowy (węzły, wybory, wynik, pisanie), bez DOM; src/dialogueui.js – okienko u dołu z portretem, E/pad/dotyk
src/npc.js      – postacie: bryły z kodu (albo .gltf z danych), animacja bezczynności, głowa za autem, dymki (DOM), portret pikselowy
src/crowd.js    – kiedy chłopaki przy placu krzyczą (dobrze / słabo / uderzenie / czekanie), bez DOM
src/race.js     – wyścig bez DOM: trasa z mapy (densify + CatmullRomCurve3), postęp i okrążenia, przeciwnik po trasie
                  (hamowanie przed zakrętami, dopasowanie tempa, omijanie gracza); src/rival.js – jego auto (Car Kit, światła, kolizja)
src/marker.js   – znacznik celu misji: słup światła nad celem + strzałka nad autem
src/occlusion.js – obiekty zasłaniające auto robią się półprzezroczyste
src/audio.js    – Howler.js: silnik (pitch z obrotów), pisk opon (z kąta), uderzenia
src/input.js    – klawiatura (płynna rampa) + pad (Gamepad API, standard mapping) + dodatkowe źródła (dotyk), wyłączenie na pauzę
src/touchstate.js – dotyk bez DOM (testy w Node): isTouchDevice (po możliwościach, nie user-agencie; ?touch=1/0 wymusza),
                  stan przycisków dla kilku palców, rampy jak klawiatura
src/touch.js    – warstwa dotykowa (tylko na urządzeniach dotykowych): joystick nipplejs / przyciski ←→, gaz, hamulec, ręczny,
                  pełny ekran + screen.orientation.lock; w main.js: niższa jakość, FPS w panelu, pauza w tle, plansza „Obróć telefon”
src/settings.js – ustawienia gracza w localStorage (try/catch, gra działa bez), klawisze do przypisania, piksele wg rozdzielczości
                  (Drobne/Średnie/Grube ≈ 540/360/270 linii, zawsze różne), postęp dla „Kontynuuj”
src/dashboard.js – zegary jak w autach z bloku wschodniego (prędkościomierz, obrotomierz, bateria jak zegar paliwa, kontrolki,
                  okienko biegu, bębenkowy licznik punktów): canvas 256×100 powiększony bez wygładzania
src/turntable.js – obrotnica w garażu (przeciąganie, bezwładność, powrót auto-obrotu), bez DOM
src/panel.js    – panel wyboru na środku ekranu (podsumowanie misji, stacja, sklep, pusty bak): przyciski dla palca, myszy,
                  klawiatury (strzałki, Enter/E, 1–9, Esc) i pada (d-pad, A, B); nie znika sam
src/menu.js     – menu (Graj / Kontynuuj / Garaż / Ustawienia), garaż (obracający się Polonez, lakiery), ustawienia
                  (grafika, dźwięk, sterowanie + trudność), pauza (Esc / Start); mysz, klawiatura, pad, dotyk
src/drift.js    – punktacja driftu
src/effects.js  – dym i ślady opon
src/main.js     – scena nocna (mgła radialna), HUD (w tym bateria), lil-gui (G), debug kolizji (F), klej bateria/misja/narrator, pętla
public/assets/  – assety (Kenney CC0), public/models/polonez/ – Polonez; każdy wpisany w CREDITS.md
assets-src/     – źródła assetów (zipy Kenneya, .glb Poloneza, tablica); scripts/convert-assets.mjs → public/
test/           – testy scenariuszy jazdy (`npm test`, node:test, bez przeglądarki; Node ≥ 22.18 czyta .ts)
```

TypeScript tylko przez usuwanie typów (bez enumów itp.), importy z rozszerzeniem `.ts`; `npm run typecheck` = `tsc`.
Osie auta: +X przód, +Y góra, +Z prawo. `slipAngle` > 0 = wektor prędkości na lewo od maski (drift w lewo daje ujemny).

## Paliwo, kasa, szacun i misje (skrót)

- **Paliwo** (v0.6d, zamiast baterii):
  - bak z profilu auta (45 l);
  - spalanie = (bieg jałowy + moc z obrotów i obciążenia × bsfc) × `fuelScale` (22: pełny bak ≈ 10 min gry); drift ×1,35;
  - rezerwa 15% (kontrolka + pisk);
  - pusty bak: silnik gaśnie, panel „Pchaj / Zadzwoń po kumpla”:
    - pchanie: gaz popycha auto do ok. 6 km/h (vehicle `push()`);
    - holowanie: 30 zł, ściemnienie, auto przy dystrybutorze;
  - brak game over.
- **Stacja paliw „Kometa”** (`map.station`, cel `points.stacja`): stój przy dystrybutorze → panel:
  - do pełna / za 20 zł / za 50 zł, cena 2,99 zł/l;
  - dług do −40 zł (na zeszyt), żeby pusty bak z pustym portfelem nie blokował gry.
- **Kasa:** nagrody misji (`reward.kasa`) + drift w misji (0,01 zł/pkt) i w pokazie (0,03 zł/pkt).
- **Szacun:** nagrody misji (`reward.szacun`) + drift przy ludziach (< 25 m od postaci, 1/60 pkt, maks. 40 na drift).
  - Poziomy z nazwami są w `teksty.json` → `szacun`.
  - Szacun odblokowuje misje (`kampania.json` → `wymagania`: pokaz 50, wyscig 150); do tego czasu wolna jazda, a potem panel „Nowa misja”.
  - Zmienia kwestie postaci (warunki w rozmowach).
- **Żappka:** stój na polu → zapis (pozycja + paliwo, kasa, szacun, flagi rozmów) + sklep: energetyk „Tygrys 5G” (6 zł, 60 s szacun ×2).
- Wszystkie liczby są w `economySettings` (lil-gui: „Paliwo, kasa, szacun i misja”).
- **Misja** = plik JSON:
  - `start` (punkt z mapy, `paliwo` % przy nowej grze), `intro`;
  - `steps` (type, point/min/time, goal, say, done), `outro`, `reward`;
  - `hints` (on: rezerwa / pusty / holowanie / stacja / zapis).
  Punkty celów są w pliku mapy (`points`), postacie w `npcs` (cel `npc:<id>`), trasy wyścigów w `routes`. Nowa misja = nowy
  plik + wpis w `src/story/kampania.json`, bez kodu.
- **Kroki:** `reach`, `money` (min zł od początku kroku), `refuel` (min % baku), `wait`, `talk` (npc, dialog, result, refuse),
  `score` (strefa `point`, `min` pkt w `time` s od wjazdu, `fail`), `race` (route, laps, rival – postać z `auto`, `fail`).
  Rozmowa: stój < 1,5 m/s przy postaci (< 4,5 m), E / pad B / dotyk.
- **Warunki w rozmowach** (`dialogue.js` `when`): `alt` (inny tekst), `if` przy odpowiedzi / węźle (`else`); `szacun`, `kasa`, `flaga`.

## Model jazdy (skrót)

- **Napęd (v0.6c, hybryda):** w grze auto napędza `engine.js` (realne dane Caro 1.6 GLE): przyspieszenie z silnika przez
  biegi minus opory trafia wprost do prędkości kuli wzdłuż toru + pasujący obrót (ω = v/r); hamulec 8,5 m/s²; tłumienia
  kuli = 0. Kalibracja (fun = 1): 0–100 16,1 s, vmax 158 km/h (katalog 16,3 s / 155). `fun` (domyślnie 1,7) = lżejsza
  masa efektywna: szybciej, vmax bez zmian. Bez `drivetrain` (stare testy) działa dawny napęd Kenneya niżej.
- **Kula (Kenney):** masa z profilu auta (Polonez 1110 kg), gravity scale 1,5, tarcie 5. Gaz dodaje obrót kuli wokół osi prostopadłej do kierunku jazdy;
  prędkość maks. ≈ `power / angularDamping` (w grze już tylko odniesienie prowadzenia: 108 km/h). Bez gazu działa `coastDamping` (hamowanie silnikiem).
  `sideGrip` wygasza ruch w bok, więc kula trzyma się toru.
- **Model auta** to osobny obiekt: pozycja kuli − promień, obrót = kurs, nachylenie do normalnej z raycastu w dół (lerp 0,2). Nie może dachować.
- **Dwa kąty:** `travel` (tor ruchu) i kurs maski = `travel + angle`. W przyczepności `angle` = 0.
- **Presety (v0.4a):** Normalny (domyślny) i Pro używają modelu prawdziwej kontry (`realCounter` = 1, niżej); Łatwy to model
  z asystą opisany w punkcie „Drift” (kąt goni cel). Stare testy scenariuszy jadą na Łatwym (test/sim.mjs), nowe na Normalnym.
- **Wejście w poślizg** (zwykły skręt nigdy nie ślizga): ręczny + |skręt| > `handbrakeSteer` powyżej `driftMinSpeed`;
  odpuszczenie gazu (spadek > `liftDrop` w `liftWindow` s) przy |skręcie| > `liftSteer` powyżej `liftSpeed`;
  pełny gaz z mocnym skrętem (`sharpSteer`, `sharpThrottle`, `sharpSpeed`, `sharpTime`).
- **Pęd:** przyczepność boczna kuli `sideGrip` maleje do `sideGripHigh` przy prędkości maks. i do `driftSideGrip` w drifcie,
  więc szybkie auto wynosi na zewnątrz łuku.
- **Drift (Łatwy):**
  - wejście: jak wyżej (w Łatwym `liftSpeed` = 999, czyli wyłączone);
  - kąt docelowy to funkcja ciągła: `strona·(driftAngleBase + gaz·driftAngleThrottle + ręczny·driftAngleHandbrake) + skręt·driftAngleSteer`,
    razy skala prędkości (`driftAngleLowSpeed`), z twardym limitem `driftAngleMax` (bez bączków);
    kąt dochodzi do celu z `driftAngleRate` (trzymanie skrętu dłużej = głębszy kąt);
  - samoczynne prostowanie: część „base + gaz + ręczny” działa tylko przy skręcie w stronę poślizgu (pełna od 0,6);
    po puszczeniu skrętu wygasa z `selfAlign` (jak wracająca kierownica), auto się prostuje i drift się kończy;
  - kontra powyżej `transitionSteer` przesuwa cel na drugą stronę, kąt przechodzi płynnie przez zero;
  - tor zakręca z `driftTurnRate` proporcjonalnie do kąta;
  - wyjście: brak gazu dłużej niż `driftExitDelay`; auto prostuje się z `straightenRate`.
- **Kontra:** w drifcie przednie koła same pokazują kontrę (`counterSteerVisual` × kąt driftu), niezależnie od wejścia.
  Normalny/Pro (`realCounter` = 1): kąt nie goni celu, tylko sam rośnie (`proGrow` + (gaz − `proThrottleNeutral`) · `proGrowThrottle`
  + ręczny `proGrowHandbrake`; za mało gazu = kąt maleje i auto łapie przyczepność poniżej 4°);
  kontra go zmniejsza (`proSteer` °/s na pełny skręt), skręt w zakręt pogłębia (`proSteerInto`).
  **Strefa balansu (v0.6b):** pełny gaz pogłębia kąt stopniowo (Normalny +12°/s, Pro +15°/s), ok. pół gazu trzyma, odpuszczenie
  zmniejsza. Powyżej `proDangerAngle` (50° / 45°) liczy się czas bez korekty (bez kontry i bez odpuszczenia gazu); po
  `proSpinDelay` (1,1 s / 0,85 s) obrót, a wcześniej ostrzeżenie `state.spinWarning` 0..1 (głośniejszy i wyższy pisk,
  drżenie kamery `shakeWarning`); korekta cofa licznik 2× szybciej. `proSpinAngle` (72° / 65°) = twardy limit, obrót od razu.
  Obrót (`proSpinTime`: bez gazu, tłumiony – dokłada ~250°, najwyżej jeden – auto staje; 1 s bez nowego poślizgu). Łatwy: bez zmian.
- **Kontakt:** kula ma restitution 0; prędkość „od podłoża” jest tłumiona (`landingDamping`), model podąża za wysokością
  kuli z opóźnieniem (`suspension`).
- **Przeszkody** (kolidery z `surface`, grupa kolizji OBSTACLE_GROUP) mają kolizję dokładnie taką, jak wyglądają. Kula ich
  nie widzi (tylko toczy się po ziemi). Uderza w nie karoseria: prostokąt 4,3 × 1,7 m (wysoki, więc wypycha zawsze w bok),
  przesuwany po każdym kroku (`collide()`: castShape od poprzedniej pozycji, potem wypchnięcie z nakładek).
  Reakcja zależy od materiału (`SURFACES`: rebound, scrape) i od `crashRebound`, `crashStun`, `crashMinSpeed`:
  odbicie, utrata prędkości przy otarciu, koniec driftu i chwila bez gazu w stronę przeszkody (cofanie działa).
  `state.crash` = prędkość uderzenia (m/s) napędza wstrząs kamery, dźwięk i przerwanie combo.
  Wypchnięcie (`unstuckTime`) zostało tylko dla zakleszczenia: kula w powietrzu/na krawędzi albo karoseria ściśnięta z dwóch stron.
- **Klawiatura:** skręt narasta 0→1 w 0,4 s (`KEY_RAMP` w input.js), pad działa wprost proporcjonalnie.
- **Modele:** `.gltf` z buforem w base64 wczytuje `src/gltf.js` (sam składa GLB w pamięci), bo CSP strony artefaktu
  blokuje fetch adresów `data:`; tekstury są osobnymi plikami `.png`.
- **Kamera** patrzy wzdłuż wektora prędkości, nie maski. Diorama: środek kadru = auto + wyprzedzenie (bez opóźnienia przy
  stałej prędkości), zoom w skokach (każda zmiana skali przesuwa siatkę pikseli).
- **Światło nocą:** ciemność robi mgła (czarno dalej niż `visibility` od auta), światła mają `decay` 1 (szerokie plamy).

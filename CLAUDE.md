# Agro Drifter – pamięć projektu

> Ten plik czytają asystenci AI pracujący nad repo (kopia: `GEMINI.md`). Aktualizuj oba razem.

## O grze

**Agro Drifter** to mroczna, groteskowa gra fabularna o jeździe starym polskim autem
(Polonez, napęd na tył) nocą po osiedlu. Estetyka: czysty pixel-art 3D jak diorama (kamera 3/4), polish doomer, satyra:
gracz ucieka przed „promieniowaniem 5G”.

- **Jazda:** arcade. Drift ma być łatwy, płynny i widowiskowy, a auto nie dachuje.
- **Klimat:** noc, czarna mgła, bloki z wielkiej płyty, dziurawe drogi, garaże, nocne sklepy z fikcyjnymi nazwami.
- **Przyszłe mechaniki:**
  - (zrobione w v0.3: bateria ładowana TYLKO driftem, reflektory zależne od baterii, sklep jako punkt zapisu, misja z narratorem),
  - kolejne misje i dialogi,
  - radio zmieniające mgłę i przyczepność,
  - uszkodzenia.

## Warstwy (roadmapa)

Tabela wersji jest w [`ROADMAP.md`](ROADMAP.md) (tam dopisuj nowe). Teraz: v0.3d – sterowanie mobilne w wersji testowej;
dopracowanie sterowania mobilnego w v0.15; następne: v0.4 MVP.

## Zasady pracy

1. **Gotowce zamiast kodu od zera.** Najpierw szukaj paczki, silnika, shadera lub przykładu; własny kod tylko jako klej i logika gry.
2. **Nie modyfikuj bibliotek** (`node_modules`, vendorowanego kodu). Obejścia rób w naszym kodzie z komentarzem.
3. **Małe kroki z testami.** Zmiana fizyki = uruchom `npm test` (scenariusze jazdy w Node) i podaj zmierzone wartości.
4. **Każdy asset** (model, tekstura, dźwięk, font) wpisz do `CREDITS.md` ze źródłem i licencją.
5. Nie przepisuj niezwiązanego kodu. Dostosowuj go do zmian.

## Architektura (v0.3)

```
src/physics.js  – jedyne miejsce z Rapierem poza vehicle.ts: świat, stały krok 60 Hz, przeszkody (`surface` → SURFACES), debugRender
src/vehicle.ts  – auto arcade (port Kenney Starter Kit Racing, vehicle.gd): toczona KULA r = 1 m + drift na wierzchu.
                  Wejście: { throttle, brake, steer (+ = lewo), handbrake } 0..1 / -1..1
                  Wyjście: vehicle.state { position, quaternion, velocity, speed, slipAngle, driftAngle, drifting,
                  bodyRoll, bodyPitch, wheels[] }
src/tuning.ts   – wszystkie parametry jazdy i kamery + presety „Normalny” (domyślny, wymagający), „Pro”, „Łatwy” (dostępność)
src/cars/*.json – profile aut (realne dane + wartości arcade, przełożenia, paleta lakierów, model); nowe auto = nowy plik
src/cars.js     – applyCar (masa, moc z prędkości maks., napęd → tuning), gearsOf (biegi i obroty dla gearbox.js)
src/camera.ts   – kamera „Diorama” (orto, 35° w dół, obrócona 28° od osi mapy, przyciągana do siatki pikseli) i „Za autem” (port view.gd), klawisz C
src/car.js      – wygląd auta: model Poloneza (koła = kości, kręcą się i skręcają), przechył, reflektory; zastępcze bryły
src/track.js    – podłoże: asfalt, ściany, słupki opon, pachołki (pozycje z mapy)
src/maps/*.json – ręcznie ułożona mapa (lista obiektów: model, x, z, yaw, rozmiar, kolizja, materiał; latarnie, dziury, parkingi,
                  paczkomat, sklep, punkty misji). Edytuj tu, nie w kodzie. Opis pól w `_help` w pliku.
src/map.js      – buduje mapę z pliku: pętla ulic, modele Kenneya, latarnie, dziury (tylko wygląd), linie parkingowe, paczkomat,
                  szyld sklepu. Kolizja modelu = obrys jego geometrii na wysokości karoserii (0,1–2,2 m): drzewo = pień.
src/pixelart.js – pixel-art: RenderPixelatedPass (przykład three.js webgl_postprocessing_pixel), materiały toon z N stopniami,
                  posteryzacja jasności, mgła radialna wokół auta (podmienione chunki fog_*), opcjonalne drżenie PS1
src/survival.js – pętla przetrwania (logika bez DOM, testy w Node): bateria (rozładowanie, ładowanie driftem jak punkty),
                  reflektory (headlightLevel), 0% → gaśnięcie → ciemny ekran → restart z punktu zapisu, pole przed Żappką = 100% + zapis
src/narrator.js – narrator: tekst u góry, pisany litera po literze, znika po kilku sekundach, nie pauzuje gry
src/mission.js  – wykonawca misji z plików danych; src/missions/*.json – kroki (reach / battery / wait), cele, teksty, podpowiedzi
src/marker.js   – znacznik celu misji: słup światła nad celem + strzałka nad autem
src/occlusion.js – obiekty zasłaniające auto robią się półprzezroczyste
src/audio.js    – Howler.js: silnik (pitch z obrotów), pisk opon (z kąta), uderzenia
src/gearbox.js  – wirtualne biegi/obroty dla HUD i dźwięku (fizyka nie ma biegów)
src/input.js    – klawiatura (płynna rampa) + pad (Gamepad API, standard mapping) + dodatkowe źródła (dotyk), wyłączenie na pauzę
src/touchstate.js – dotyk bez DOM (testy w Node): isTouchDevice (po możliwościach, nie user-agencie; ?touch=1/0 wymusza),
                  stan przycisków dla kilku palców, rampy jak klawiatura
src/touch.js    – warstwa dotykowa (tylko na urządzeniach dotykowych): joystick nipplejs / przyciski ←→, gaz, hamulec, ręczny,
                  pełny ekran + screen.orientation.lock; w main.js: niższa jakość, FPS w panelu, pauza w tle, plansza „Obróć telefon”
src/settings.js – ustawienia gracza w localStorage (try/catch, gra działa bez), klawisze do przypisania, piksele wg rozdzielczości
                  (Drobne/Średnie/Grube ≈ 540/360/240 linii), postęp dla „Kontynuuj”
src/dashboard.js – zegary jak w autach z bloku wschodniego (prędkościomierz, obrotomierz, bateria jak zegar paliwa, kontrolki,
                  okienko biegu, bębenkowy licznik punktów): canvas 256×100 powiększony bez wygładzania
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

## Bateria i misje (skrót)

- Bateria 0–100%: `drainIdle` + `drainDrive` × prędkość/maks. + `drainHighBeam` (długie, klawisz L) %/s (bez driftu 60–90 s);
  ładowanie tylko w porządnym drifcie (≥ `chargeMinAngle`, ≥ `chargeMinSpeed`): `chargeRate` × kąt × prędkość × (1 + `streakBonus` ×
  seria/`streakTime`); uderzenie > `hitSpeed` zeruje serię i blokuje ładowanie na `hitCooldown`. Wszystko w `batterySettings` (lil-gui).
- Reflektory: jasność 0,25–1 i zasięg 0,35–1 z baterią; poniżej `low` (20%) migoczą, poniżej `warn` (10%) piszczy ostrzeżenie.
- 0%: silnik gaśnie (bez gazu i wstecznego), auto się toczy, `dyingTime` ciemnienie, `darkTime` komunikat, restart z punktu zapisu
  (bateria co najmniej `respawnMin`). Misja nie cofa się.
- Żappka: stój (< 1 m/s) na polu `map.shop.pad` → ładowanie `shopCharge` %/s do 100% → zapis punktu odrodzenia.
- Misja = plik JSON: `start` (punkt z mapy, bateria), `intro`, `steps` (type, point/min/time, goal, say, done), `outro`, `hints` (on: low/warn/dead/respawn/shop).
  Punkty celów są w pliku mapy (`points`). Nowa misja = nowy plik, bez kodu (na razie main.js startuje `paczka.json`).

## Model jazdy (skrót)

- **Kula (Kenney):** masa z profilu auta (Polonez 1110 kg), gravity scale 1,5, tarcie 5. Gaz dodaje obrót kuli wokół osi prostopadłej do kierunku jazdy;
  prędkość maks. ≈ `power / angularDamping`. Bez gazu działa `coastDamping` (hamowanie silnikiem).
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
  kontra go zmniejsza (`proSteer` °/s na pełny skręt), skręt w zakręt pogłębia (`proSteerInto`), powyżej `proSpinAngle`
  obrót (`proSpinTime`: bez gazu, auto wytraca prędkość, potem odjeżdża w stronę, w którą patrzy). Łatwy: bez zmian.
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

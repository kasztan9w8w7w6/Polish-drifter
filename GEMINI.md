# Agro Drifter – pamięć projektu

> Ten plik czytają asystenci AI pracujący nad repo (kopia: `GEMINI.md`). Aktualizuj oba razem.

## O grze

**Agro Drifter** to mroczna, groteskowa gra fabularna o jeździe starym polskim autem
(Polonez-podobne, napęd na tył) nocą po osiedlu. Estetyka PS1 / polish doomer, satyra:
gracz ucieka przed „promieniowaniem 5G”.

- **Jazda:** arcade. Drift ma być łatwy, płynny i widowiskowy, a auto nie dachuje.
- **Klimat:** noc, czarna mgła, bloki z wielkiej płyty, dziurawe drogi, garaże, nocne sklepy z fikcyjnymi nazwami.
- **Przyszłe mechaniki:**
  - bateria ładowana TYLKO driftem,
  - reflektory zależne od baterii,
  - sklepy jako punkty zapisu,
  - misje z dialogami,
  - radio zmieniające mgłę i przyczepność,
  - uszkodzenia.

## Warstwy (roadmapa)

| Wersja | Zakres | Stan |
|---|---|---|
| v0.1 | jazda | zrobione |
| v0.1.5 | Rapier + model opon (RaycastVehicle) | zastąpione przez v0.2a |
| v0.2a | fizyka arcade: kula Kenneya + drift na wierzchu, nowa kamera | zrobione |
| v0.2b | noc + PS1 + assety + dźwięk + HUD | **zrobione** (bez City Kit/Car Kit – kenney.nl niedostępny) |
| v0.3 | bateria + sklep + misja | następne |
| v0.4 | MVP | |

## Zasady pracy

1. **Gotowce zamiast kodu od zera.** Najpierw szukaj paczki, silnika, shadera lub przykładu; własny kod tylko jako klej i logika gry.
2. **Nie modyfikuj bibliotek** (`node_modules`, vendorowanego kodu). Obejścia rób w naszym kodzie z komentarzem.
3. **Małe kroki z testami.** Zmiana fizyki = uruchom `npm test` (scenariusze jazdy w Node) i podaj zmierzone wartości.
4. **Każdy asset** (model, tekstura, dźwięk, font) wpisz do `CREDITS.md` ze źródłem i licencją.
5. Nie przepisuj niezwiązanego kodu. Dostosowuj go do zmian.

## Architektura (v0.2a)

```
src/physics.js  – jedyne miejsce z Rapierem poza vehicle.ts: świat, stały krok 60 Hz, przeszkody, debugRender
src/vehicle.ts  – auto arcade (port Kenney Starter Kit Racing, vehicle.gd): toczona KULA r = 1 m + drift na wierzchu.
                  Wejście: { throttle, brake, steer (+ = lewo), handbrake } 0..1 / -1..1
                  Wyjście: vehicle.state { position, quaternion, velocity, speed, slipAngle, driftAngle, drifting,
                  bodyRoll, bodyPitch, wheels[] }
src/tuning.ts   – wszystkie parametry jazdy i kamery + presety „Łatwy” (domyślny), „Pro”
src/camera.ts   – kamera pościgowa (port view.gd + wyprzedzanie, FOV, drżenie)
src/car.js      – wyłącznie wygląd auta (bryły) z wizualnym przechyłem, synchronizowany ze state
src/track.js    – plac manewrowy; przeszkody statyczne mają kolizję grubszą o promień kuli (PAD)
src/district.js – osiedle wokół placu: garaże, pawilony, sklep „Żappka 24h”, latarnie (GLB Kenneya, CC0)
src/ps1.js      – wygląd PS1: RenderPixelatedPass + bloom + 15-bit dithering, snapping wierzchołków, NearestFilter
src/audio.js    – Howler.js: silnik (pitch z obrotów), pisk opon (z kąta), uderzenia
src/gearbox.js  – wirtualne biegi/obroty dla HUD i dźwięku (fizyka nie ma biegów)
src/input.js    – klawiatura (płynna rampa) + pad (Gamepad API, standard mapping)
src/drift.js    – punktacja driftu
src/effects.js  – dym i ślady opon
src/main.js     – scena nocna (FogExp2), HUD, lil-gui (G), debug kolizji (F), pętla
public/assets/  – assety (Kenney CC0); każdy wpisany w CREDITS.md
test/           – testy scenariuszy jazdy (`npm test`, node:test, bez przeglądarki; Node ≥ 22.18 czyta .ts)
```

TypeScript tylko przez usuwanie typów (bez enumów itp.), importy z rozszerzeniem `.ts`; `npm run typecheck` = `tsc`.
Osie auta: +X przód, +Y góra, +Z prawo. `slipAngle` > 0 = wektor prędkości na lewo od maski (drift w lewo daje ujemny).

## Model jazdy (skrót)

- **Kula (Kenney):** masa 1000, gravity scale 1,5, tarcie 5. Gaz dodaje obrót kuli wokół osi prostopadłej do kierunku jazdy;
  prędkość maks. ≈ `power / angularDamping`. Bez gazu działa `coastDamping` (hamowanie silnikiem).
  `sideGrip` wygasza ruch w bok, więc kula trzyma się toru.
- **Model auta** to osobny obiekt: pozycja kuli − promień, obrót = kurs, nachylenie do normalnej z raycastu w dół (lerp 0,2). Nie może dachować.
- **Dwa kąty:** `travel` (tor ruchu) i kurs maski = `travel + angle`. W przyczepności `angle` = 0.
- **Drift:**
  - wejście: ręczny + skręt powyżej `driftMinSpeed` albo ostry skręt (`sharpSteer`) z gazem powyżej `sharpSpeed`;
  - kąt dąży do `driftAngleBase ± driftAngleSteer (w zakręt / kontra) + driftAngleThrottle·gaz + driftAngleHandbrake`,
    z twardym limitem `driftAngleMax` (bez bączków);
  - tor zakręca z `driftTurnRate`; mocna kontra (> `transitionSteer`) przerzuca drift na drugą stronę;
  - wyjście: brak gazu dłużej niż `driftExitDelay`; auto prostuje się z `straightenRate`.
- **Kamera** patrzy wzdłuż wektora prędkości, nie maski.

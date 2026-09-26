# Agro Drifter – pamięć projektu

> Ten plik czytają asystenci AI pracujący nad repo (kopia: `GEMINI.md`). Aktualizuj oba razem.

## O grze

**Agro Drifter** to mroczna, groteskowa gra fabularna o jeździe starym polskim autem
(Polonez, napęd na tył) nocą po osiedlu. Estetyka: czysty pixel-art 3D jak diorama (kamera 3/4), polish doomer, satyra:
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
| v0.2b | noc + PS1 + assety + dźwięk + HUD | zrobione |
| v0.2c | poprawki jazdy: płynny kąt, power oversteer w Pro, bez odbić, bez utykania | zrobione |
| v0.2d | kamera Diorama + pixel-art (toon, obrysy, mgła radialna) | zrobione |
| v0.2e | Polonez (koła na kościach) + osiedle z City Kit / Car Kit | zrobione |
| v0.3 | bateria + sklep + misja | następne |
| v0.4 | MVP | |

## Zasady pracy

1. **Gotowce zamiast kodu od zera.** Najpierw szukaj paczki, silnika, shadera lub przykładu; własny kod tylko jako klej i logika gry.
2. **Nie modyfikuj bibliotek** (`node_modules`, vendorowanego kodu). Obejścia rób w naszym kodzie z komentarzem.
3. **Małe kroki z testami.** Zmiana fizyki = uruchom `npm test` (scenariusze jazdy w Node) i podaj zmierzone wartości.
4. **Każdy asset** (model, tekstura, dźwięk, font) wpisz do `CREDITS.md` ze źródłem i licencją.
5. Nie przepisuj niezwiązanego kodu. Dostosowuj go do zmian.

## Architektura (v0.2e)

```
src/physics.js  – jedyne miejsce z Rapierem poza vehicle.ts: świat, stały krok 60 Hz, przeszkody, debugRender
src/vehicle.ts  – auto arcade (port Kenney Starter Kit Racing, vehicle.gd): toczona KULA r = 1 m + drift na wierzchu.
                  Wejście: { throttle, brake, steer (+ = lewo), handbrake } 0..1 / -1..1
                  Wyjście: vehicle.state { position, quaternion, velocity, speed, slipAngle, driftAngle, drifting,
                  bodyRoll, bodyPitch, wheels[] }
src/tuning.ts   – wszystkie parametry jazdy i kamery + presety „Łatwy” (domyślny), „Pro”
src/camera.ts   – kamera „Diorama” (orto 3/4, przyciągana do siatki pikseli) i „Za autem” (port view.gd), klawisz C
src/car.js      – wygląd auta: model Poloneza (koła = kości, kręcą się i skręcają), przechył, reflektory; zastępcze bryły
src/track.js    – plac manewrowy; przeszkody statyczne mają kolizję grubszą o promień kuli (PAD)
src/district.js – osiedle z Kenney City Kit/Car Kit: pętla ulic, latarnie, bloki, pawilony, sklep „Żappka 24h”, garaże, zaparkowane auta
src/pixelart.js – pixel-art: RenderPixelatedPass (przykład three.js webgl_postprocessing_pixel), materiały toon z N stopniami,
                  posteryzacja jasności, mgła radialna wokół auta (podmienione chunki fog_*), opcjonalne drżenie PS1
src/occlusion.js – obiekty zasłaniające auto robią się półprzezroczyste
src/audio.js    – Howler.js: silnik (pitch z obrotów), pisk opon (z kąta), uderzenia
src/gearbox.js  – wirtualne biegi/obroty dla HUD i dźwięku (fizyka nie ma biegów)
src/input.js    – klawiatura (płynna rampa) + pad (Gamepad API, standard mapping)
src/drift.js    – punktacja driftu
src/effects.js  – dym i ślady opon
src/main.js     – scena nocna (mgła radialna), HUD, lil-gui (G), debug kolizji (F), pętla
public/assets/  – assety (Kenney CC0), public/models/polonez/ – Polonez; każdy wpisany w CREDITS.md
assets-src/     – źródła assetów (zipy Kenneya, .glb Poloneza, tablica); scripts/convert-assets.mjs → public/
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
  - wejście: ręczny + skręt powyżej `driftMinSpeed` albo gaz w ostrym zakręcie (power oversteer:
    `sharpSteer`, `sharpThrottle`, `sharpSpeed`, `sharpTime`; w Pro trudniej);
  - kąt docelowy to funkcja ciągła: `strona·(driftAngleBase + gaz·driftAngleThrottle + ręczny·driftAngleHandbrake) + skręt·driftAngleSteer`,
    razy skala prędkości (`driftAngleLowSpeed`), z twardym limitem `driftAngleMax` (bez bączków);
    kąt dochodzi do celu z `driftAngleRate` (trzymanie skrętu dłużej = głębszy kąt);
  - kontra powyżej `transitionSteer` przesuwa cel na drugą stronę, kąt przechodzi płynnie przez zero;
  - tor zakręca z `driftTurnRate` proporcjonalnie do kąta;
  - wyjście: brak gazu dłużej niż `driftExitDelay`; auto prostuje się z `straightenRate`.
- **Kontakt:** kula ma restitution 0; prędkość „od podłoża” jest tłumiona (`landingDamping`), model podąża za wysokością
  kuli z opóźnieniem (`suspension`). Pedał wciśnięty bez ruchu przez `unstuckTime` → wypchnięcie w najbliższe wolne miejsce.
- **Klawiatura:** skręt narasta 0→1 w 0,4 s (`KEY_RAMP` w input.js), pad działa wprost proporcjonalnie.
- **Kamera** patrzy wzdłuż wektora prędkości, nie maski. Diorama: środek kadru = auto + wyprzedzenie (bez opóźnienia przy
  stałej prędkości), zoom w skokach (każda zmiana skali przesuwa siatkę pikseli).
- **Światło nocą:** ciemność robi mgła (czarno dalej niż `visibility` od auta), światła mają `decay` 1 (szerokie plamy).

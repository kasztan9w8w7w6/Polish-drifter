# Agro Drifter – pamięć projektu

> Ten plik czytają asystenci AI pracujący nad repo (kopia: `GEMINI.md`). Aktualizuj oba razem.

## O grze

**Agro Drifter** to mroczna, groteskowa gra fabularna o jeździe starym polskim autem
(Polonez-podobne, napęd na tył) nocą po osiedlu. Estetyka PS1 / polish doomer, satyra:
gracz ucieka przed „promieniowaniem 5G”.

- **Jazda:** zręcznościowa/simcade. Drift ma być łatwy, płynny i widowiskowy, a auto nie dachuje.
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
| v0.1.5 | nowa fizyka (Rapier) i dobry drift | **zrobione** |
| v0.2 | noc + PS1 + assety + dźwięk | następne |
| v0.3 | bateria + sklep + misja | |
| v0.4 | MVP | |

## Zasady pracy

1. **Gotowce zamiast kodu od zera.** Najpierw szukaj paczki, silnika, shadera lub przykładu; własny kod tylko jako klej i logika gry.
2. **Nie modyfikuj bibliotek** (`node_modules`, vendorowanego kodu). Obejścia rób w naszym kodzie z komentarzem.
3. **Małe kroki z testami.** Zmiana fizyki = uruchom `npm test` (scenariusze jazdy w Node) i podaj zmierzone wartości.
4. **Każdy asset** (model, tekstura, dźwięk, font) wpisz do `CREDITS.md` ze źródłem i licencją.
5. Nie przepisuj niezwiązanego kodu. Dostosowuj go do zmian.

## Architektura (v0.1.5)

```
src/physics.js  – jedyne miejsce z Rapierem poza vehicle.js: świat, stały krok 60 Hz, przeszkody, debugRender
src/vehicle.js  – fizyka auta: Rapier DynamicRayCastVehicleController + asysty driftu.
                  Wejście: { throttle, brake, steer (+ = lewo), handbrake } 0..1 / -1..1
                  Wyjście: vehicle.state { position, quaternion, velocity, speed, slipAngle, drifting, wheels[] }
src/tuning.js   – wszystkie parametry jazdy + presety „Przyczepny”, „Drift łatwy” (domyślny), „Drift pro”
src/car.js      – wyłącznie wygląd auta (bryły), synchronizowany ze state
src/track.js    – plac manewrowy (wygląd + przeszkody przez physics.js)
src/input.js    – klawiatura (płynna rampa) + pad (Gamepad API, standard mapping)
src/drift.js    – punktacja driftu
src/effects.js  – dym i ślady opon
src/main.js     – scena, kamera, HUD, lil-gui (G), debug kolizji (F), pętla
test/           – testy scenariuszy jazdy (`npm test`, node:test, bez przeglądarki)
```

Osie auta: +X przód, +Y góra, +Z prawo. `slipAngle` > 0 = wektor prędkości na lewo od maski.

## Model driftu (skrót)

- **Utrata przyczepności tyłu** (`rearLoss`, 0..1, płynnie). Sposoby wejścia, każdy od ~25 km/h:
  - ręczny,
  - gaz + skręt (`powerOversteer`),
  - muśnięcie hamulca w zakręcie (`brakeDrift`),
  - puszczenie gazu w zakręcie (`liftOffLoss`).

  Gaz w trwającym poślizgu go podtrzymuje. Przy wejściu działa `entryKick`.
- **Tryb driftu z histerezą:** wejście powyżej 12°, wyjście po puszczeniu gazu albo gdy kąt jest < 4° dłużej niż `transitionGrace`, dzięki czemu przekładka przez 0° nie gasi driftu.
- **Kierownica w drifcie** wybiera docelowy kąt poślizgu:
  - w zakręt → max,
  - puszczona → środek,
  - lekka kontra → min,
  - mocna kontra (powyżej `counterSteerSwitch`) → cel po drugiej stronie, czyli przekładka.

  Kątem steruje regulator PD obrotu (`driftAngleControl`/`driftAngleDamping`).
- **Asysta kontry:** przednie koła podążają za kierunkiem jazdy (`counterSteerAssist`), a limit kontry (`counterSteerLimit`) nie pozwala im odbić auta.
- **Anty-bączek** powyżej `driftAngleMax − 5°` (`angleHold`), `speedKeep` ogranicza utratę prędkości w drifcie.
- **Niski środek masy** i asysta pionu (`uprightAssist`), żeby auto nie dachowało.

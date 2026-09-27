# Fizyka aut – jak to robią inni i jak robi to Agro Drifter (v0.6c)

**Krótko:** napęd jest z realnych danych, a prowadzenie i drift to arcade.

- **Napęd:** silnik, skrzynia, opory i masa pochodzą z danych Poloneza. Dzięki temu przyspieszenie i prędkość maksymalna
  zgadzają się z katalogiem, a różne silniki różnią się naprawdę.
- **Prowadzenie i drift:** zostają tocząca się kula z driftem na wierzchu (v0.2a, port Kenneya). Ten układ daje łatwy,
  płynny, widowiskowy drift i auto, które nie dachuje.

Kod jest w dwóch miejscach:
- `src/engine.js`: napęd, logika bez przeglądarki, testowana w Node (`test/engine.test.mjs`);
- `src/vehicle.ts`: kula, drift i kolizje.

## Źródła i co z nich bierzemy

> Strony źródłowe były w tym środowisku zablokowane przez proxy. Opis opiera się na wiedzy o tych tekstach i na wynikach
> wyszukiwania (tytuły i streszczenia). Wzory są standardowe; przy okazji warto sprawdzić cytaty u źródła.

### Marco Monster, „Car Physics for Games” (2003)
[kopia na asawicki.info](https://www.asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html)

Klasyczne wprowadzenie; na nim opiera się m.in. Jolt Physics.

- **Kluczowy pomysł:** siły **wzdłużne** (napęd, hamowanie, opór toczenia, opór powietrza) liczy się osobno od
  **poprzecznych** (skręt, przyczepność boczna).
- **Siła na kole:** moment silnika × przełożenie biegu × przełożenie główne × sprawność (u niego ok. 0,7) ÷ promień koła.
- **Obroty silnika** z prędkości koła: obroty koła × przełożenia × 60 / 2π.
- **Opór powietrza:** `C_drag · v · |v|`; **opór toczenia:** `C_rr · v`, gdzie `C_rr ≈ 30 · C_drag`.
- **Krzywa momentu:** kilka punktów z liniową interpolacją.
- Omawia też przenoszenie ciężaru i kąt poślizgu opon (przyczepność boczna).

**Bierzemy:** rozdzielenie sił wzdłużnych od poprzecznych, wzory na siłę i obroty, krzywą z punktów, opory.
**Nie bierzemy:** modelu opon z kątem poślizgu – prowadzenie zostaje arcade.

### Edy (Angel García), Vehicle Physics Pro – silnik, sprzęgło, skrzynia
[edy.es: „Engine, clutch and gearbox in Vehicle Physics Pro”](https://www.edy.es/dev/2015/02/engine-clutch-and-gearbox-in-vehicle-physics-pro/),
[vehiclephysics.com](https://vehiclephysics.com/)

- Napęd to łańcuch **silnik → sprzęgło → skrzynia → dyferencjał → koła**, a każdy element przekazuje moment i obroty.
- **Silnik:** krzywa momentu wyznaczona z kilku parametrów (obroty i moment na biegu jałowym, maksymalny moment,
  maksymalna moc, obroty maks.), hamowanie silnikiem, ogranicznik obrotów.
- **Sprzęgło:** pozwala silnikowi kręcić się szybciej niż koła przy ruszaniu.
- **Skrzynia:** manualna, „manualna z automatyczną zmianą przy zadanych obrotach” albo automat.

**Bierzemy:**
- krzywą momentu budowaną z danych katalogowych (moment maks. przy obrotach, moc maks. przy obrotach, obroty maks.);
- **poślizg sprzęgła przy ruszaniu** (na 1. biegu i wstecznym silnik trzyma co najmniej `launchRpm`);
- ogranicznik obrotów, hamowanie silnikiem;
- **automatyczną zmianę biegów przy obrotach**, liczonych tak, żeby następny bieg ciągnął co najmniej tak samo mocno.

**Nie bierzemy:** osobnej dynamiki wału i sprzęgła (bezwładności, poślizgu w czasie) – zastępuje je współczynnik mas wirujących (niżej).

### Sergey Makeev, ArcadeCarPhysics (Unity)
[github.com/SergeyMakeev/ArcadeCarPhysics](https://github.com/SergeyMakeev/ArcadeCarPhysics)

Pokazuje, że gra samochodowa może być celowo „nieprawdziwa”, jeśli ma dobre wyczucie:
- zawieszenie z promieni (raycast) zamiast fizycznych kół;
- przyspieszenie i skręt z krzywych dobieranych pod wyczucie;
- sztuczna przyczepność boczna, stabilizacja przeciw przewróceniu, prosta obsługa driftu (zmniejszanie przyczepności tyłu).

**Bierzemy:** filozofię dla prowadzenia. Nasz odpowiednik to kula Kenneya i drift na wierzchu. Auto się nie przewraca,
a przyczepność boczna jest parametrem (`sideGrip` i spółka), nie wynikiem modelu opon.

### Wassim Alhajomar (wassimulator), „Programming Vehicles in Games”
[wassimulator.com](https://wassimulator.com/blog/programming/programming_vehicles_in_games.html) (i wykład z BSC 2025)

- Auto to trzy części: **silnik/skrzynia, koła/opony, nadwozie**.
- **Najważniejsze jest wrażenie**, nie wierność symulacji: trzeba wiedzieć, co gracz czuje, i realizmu używać tam, gdzie to wrażenie buduje.

**Bierzemy:** podział. Silnik i skrzynię mamy realne (proporcje, dźwięk i obrotomierz z prawdziwych obrotów). Koła i
nadwozie są arcade: wrażenie driftu jest ważniejsze niż model opon.

## Nasz model (hybryda)

```
obroty silnika   = (v / r) × bieg × przełożenie główne × 60 / 2π      (nie mniej niż jałowe; na 1. i wstecznym ≥ launchRpm × gaz)
siła napędowa    = moment(obroty) × gaz × bieg × przełożenie główne × sprawność / r
opory            = ½ ρ Cd A v² + Crr m g   (+ hamowanie silnikiem przy zamkniętej przepustnicy)
przyspieszenie   = (siła − opory) × fun / (m × δ)
δ (masy wirujące) = 1,04 + 0,0025 × (bieg × przełożenie główne)²      (≈ 1,6 na 1. biegu, ≈ 1,06 na 5.; Wong, „Theory of Ground Vehicles”)
```

- **Krzywa momentu** (`torqueCurve`) ma 5 punktów z danych:
  - bieg jałowy: 62% momentu maks.;
  - połowa drogi do momentu maks.: 88%;
  - moment maks. przy swoich obrotach;
  - moment przy mocy maks.: `P / ω`, więc moc w tym punkcie zgadza się z katalogiem;
  - obroty maks.: 82% momentu przy mocy maks.
  Plik silnika może podać własne punkty (`curve`).
- **Skrzynia automatyczna:**
  - zmiana w górę przy obrotach, od których następny bieg ciągnie co najmniej tak samo (najszybsze przyspieszenie);
  - zmiana w dół, gdy obroty na niższym biegu spadną poniżej 62% progu;
  - zmiana trwa `shiftTime` s (bez napędu);
  - bieg niepasujący do prędkości (po resecie, po uderzeniu) zmienia się od razu.
- **Opory** sprawiają, że prędkość maksymalna wynika z fizyki (siła = opory na 5. biegu), a nie z parametru.
- **Czynnik zabawy `fun`** (lil-gui: G → „Napęd”, domyślnie 1,7) mnoży **wszystkie** siły wzdłużne, czyli działa jak
  lżejsza „masa efektywna”. Skutki:
  - auto rozpędza się `fun` razy żwawiej;
  - prędkość maksymalna zostaje realna (w niej siła = opory, niezależnie od masy);
  - proporcje między silnikami i autami są realne.
- **Połączenie z kulą:** przyspieszenie z napędu trafia bezpośrednio do prędkości kuli wzdłuż toru jazdy, razem z pasującym
  obrotem (ω = v / r).
  - Kula toczy się bez poślizgu, więc przyczepność boczna, drift i kolizje działają jak wcześniej.
  - Gdyby dodawać tylko obrót (jak Kenney), do ziemi trafiałoby tylko 2/7 przyspieszenia (bezwładność pełnej kuli).
  - Hamulec w tym trybie działa tak samo: stałe opóźnienie 8,5 m/s² (ok. 0,87 g).
- **Prowadzenie się nie zmienia:** progi skrętu i przyczepności liczą się względem „prędkości odniesienia” 108 km/h
  (`arcade.topSpeedKmh`, jak dotąd), choć realna prędkość maks. to ok. 155 km/h.
- **Obrotomierz i dźwięk silnika** biorą obroty z napędu (`vehicle.state.rpm`, `gear`, `load`).

## Dane i kalibracja

- **Profil auta:** `src/cars/polonez.json` → `real`, ze źródłami w `_source`. Zawiera:
  - masę, przełożenia (I 3,753 · II 2,132 · III 1,378 · IV 1,000 · V 0,881 · R 3,867), przełożenie główne 3,9;
  - opony 185/70 R13 (r = 0,286 m), bak 45 l, wymiary.
- **Silniki:** `src/engines/*.json` (1.6 GLE 87 KM, 1.6 76 KM, Rover 1.4 16V, XUD9 1.9 D), źródła w `_source`.
  Pod przyszłe swapy w garażu (bez UI).
- **Opór powietrza:** Cd 0,46, A 1,95 m², Crr 0,014, sprawność 0,88. Pewnych danych nie ma (wyszukiwarka podawała Cx 0,36,
  co przy tych przełożeniach daje za wysoką vmax), więc Cd dobrałem kalibracją.
  **Sprawdzian:** ten sam zestaw bez dalszych zmian daje dla 1.6 76 KM 18,2 s i 150 km/h, przy katalogowych 18,1 s i 154 km/h.

Test kalibracji (`test/engine.test.mjs`) na pełnej fizyce kuli, `fun = 1`:

| Silnik | 0–100 km/h (sym.) | katalog | vmax (sym.) | katalog |
|---|---|---|---|---|
| FSO 1.6 GLE 87 KM | 16,1 s | 16,3 s | 158 km/h | ok. 155 km/h |
| FSO 1.6 76 KM | 18,2 s | 18,1 s | 150 km/h | 154 km/h |
| Rover 1.4 16V 103 KM | 15,0 s | – | 166 km/h | 170–180 (relacje użytkowników) |
| XUD9 1.9 D 69 KM | 19,9 s | – | 143 km/h | – |

Z czynnikiem zabawy 1,7: 1.6 GLE ma 0–100 w ok. 10 s, a vmax bez zmian (ok. 159 km/h).

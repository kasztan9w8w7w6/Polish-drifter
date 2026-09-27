# Agro Drifter 🇵🇱 (v0.5)

Przeglądarkowa gra o driftowaniu Polonezem nocą po osiedlu: pixel-art 3D z kamerą jak nad dioramą
i ucieczka przed „promieniowaniem 5G” (opis projektu i roadmapa w [`CLAUDE.md`](CLAUDE.md)).

![Drift nocą (kamera Diorama)](docs/screenshot-diorama.png)
![Nocny sklep „Żappka 24h”](docs/screenshot-sklep.png)

*Zrzuty z headless Chromium (renderer programowy SwiftShader); na prawdziwej karcie graficznej obraz może się nieco różnić.*

Zasada projektu: **składamy gotowe klocki zamiast pisać własne**.

| Warstwa | Gotowiec | Co z niego bierzemy |
|---|---|---|
| Render | [three.js](https://threejs.org) | scena, `MeshToonMaterial` (cieniowanie w kilku stopniach) |
| Pixel-art | przykład three.js [`webgl_postprocessing_pixel`](https://threejs.org/examples/#webgl_postprocessing_pixel) | `RenderPixelatedPass` (pikselizacja + obrysy z głębi i normalnych), kamera ortograficzna przyciągana do siatki pikseli; do tego `UnrealBloomPass`, `OutputPass` i mały `ShaderPass` (stopnie jasności + dithering) |
| Noc | `THREE.Fog` z podmienionym chunkiem shadera, `SpotLight`, `PointLight` | mgła radialna wokół auta (czerń dookoła), reflektory, latarnie, świecący szyld |
| Auto | [„1993 FSO Polonez MR93 (LP)”](https://sketchfab.com/3d-models/1993-fso-polonez-mr93-lp-f191456e08a041ad81264ce67f4ed1d1) (Sketchfab) | model z kołami na kościach (kręcą się i skręcają) |
| Osiedle | [Kenney City Kit Roads / Commercial / Suburban, Car Kit, Starter Kit City Builder](CREDITS.md) (CC0) + własne bryły | latarnie, pawilony, sklep, market, garaże, zaparkowane auta, drzewa (`GLTFLoader`); bloki z wielkiej płyty, podłoże i postacie z kodu |
| Konwersja modeli | [glTF-Transform](https://gltf-transform.dev) | `npm run assets` (usunięcie logo, fikcyjna tablica, `.glb` → `.gltf`) |
| Dźwięk | [Howler.js](https://howlerjs.com) + dźwięki z Kenney Starter Kit Racing (CC0) | silnik, pisk opon, uderzenia |
| Czcionka HUD | [Silkscreen](https://fonts.google.com/specimen/Silkscreen) przez `@fontsource/silkscreen` (OFL) | pikselowy licznik |
| Fizyka | [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`) | świat, kolizje, raycast, debug render |
| Model jazdy i kamera | [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (MIT) | auto jako toczona kula + model podążający za nią, kamera z opóźnieniem (przeniesione z GDScript do TypeScript) |
| Tuning | [lil-gui](https://lil-gui.georgealways.com) | suwaki, presety, eksport/import JSON (klawisz **G**) |
| Pad | Gamepad API przeglądarki | analogowy gaz, hamulec i skręt |
| Dotyk | [nipplejs](https://github.com/yoannmoinet/nipplejs) | joystick skrętu na telefonie |
| Ostrzeżenie (rezerwa paliwa) | Web Audio (przez kontekst Howlera) | krótki pisk generowany w kodzie, bez pliku |
| Testy | `node:test` (wbudowany w Node ≥ 22.18, czyta TypeScript) | scenariusze jazdy bez przeglądarki |
| Typy | [TypeScript](https://www.typescriptlang.org) | `vehicle.ts`, `camera.ts`, `tuning.ts`; sprawdzanie `npm run typecheck` |
| Build | [Vite](https://vite.dev) | dev server z HMR, produkcyjny build |

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testy jazdy i kamery (Node, ~8 s)
npm run assets   # przebudowa modeli z assets-src/ (potrzebny program unzip)
npm run typecheck
npm run build    # statyczny build do dist/
```

## Sterowanie

| | Klawiatura | Pad |
|---|---|---|
| Gaz / hamulec (wsteczny) | W / S | RT / LT |
| Skręt | A / D | lewa gałka |
| Ręczny | Spacja | A lub RB |
| Reset auta | R | Y |
| Kamera (Diorama / Za autem) | C | X |
| Panel tuningu | G | Start |
| Podgląd kolizji (Rapier debug render) | F | — |
| Długie / krótkie światła | L | krzyżak w górę |
| Misja od nowa | N | Back |
| Zamknij podsumowanie misji | Enter | — |
| Pauza | P / Esc | — |

Po R, C i automatycznym wypchnięciu z przeszkody na środku ekranu pojawia się krótki komunikat.
Dźwięk startuje po pierwszym klawiszu/kliknięciu (wymóg przeglądarek). Parametr `?spawn=x,z,kąt` w adresie ustawia auto w innym miejscu,
`?paliwo=3` startuje z 3 l w baku (do sprawdzenia rezerwy i pustego baku).

## Menu, garaż, ustawienia

Gra startuje w **menu głównym**: Graj (misja 1 od początku), Kontynuuj (od ostatniego kroku misji i punktu zapisu), Garaż, Ustawienia.
- **Garaż:** Polonez obraca się pod gołą żarówką; lakier wybierasz z palety z epoki.
- **Ustawienia:** grafika (piksele Drobne / Średnie / Grube, ekspozycja, jakość), dźwięk (głośności), sterowanie (poziom jazdy
  Łatwy / Normalny / Pro, klawisze do zmiany: kliknij przycisk i naciśnij nowy klawisz, lista przycisków pada).
- **Pauza:** Esc (albo P, Start na padzie, ❚❚ na dotyku): Wznów, Restart misji, Ustawienia, Wyjście do menu. Gra pauzuje się też sama, gdy karta/aplikacja przejdzie w tło.
- Ustawienia i postęp zapisują się w przeglądarce (localStorage); bez niego gra działa normalnie, tylko nie pamięta.
- `?graj` w adresie pomija menu (testy).

**Zegary** w prawym dolnym rogu wyglądają jak deska rozdzielcza auta z lat 70–80: prędkościomierz 0–160, obrotomierz ×1000 z czerwonym
polem, zegar paliwa (0 – ½ – 1), kontrolki (rezerwa paliwa, światła: zielona krótkie / niebieska długie,
silnik: świeci przy pustym baku, ręczny), okienko biegu i bębenkowy licznik punktów.

**Obraz:** kamera Diorama patrzy 35° w dół i jest obrócona 28° od osi mapy (suwaki w panelu G). Rozmiar piksela dobiera się do
wysokości ekranu: Średnie ≈ 360 linii (1080p: piksel 3), Drobne ≈ 540, Grube ≈ 240.

## Telefon i tablet (wersja testowa)

Na urządzeniu dotykowym (wykrywanym po możliwościach ekranu, nie po nazwie przeglądarki) pojawia się sterowanie dotykowe.
Na komputerze nic się nie zmienia; `?touch=1` w adresie włącza je do testów, `?touch=0` wyłącza.

- **Lewa połowa ekranu:** joystick skrętu pojawia się tam, gdzie położysz kciuk (tylko w bok, proporcjonalnie).
  W panelu (G → „Wydajność”) można zamiast niego wybrać przyciski ◀ ▶, które narastają jak klawisze.
- **Prawa strona:** GAZ, HAMULEC / wsteczny i RĘCZNY. Działa kilka palców naraz (gaz + ręczny + skręt).
- **U dołu:** pełny ekran (⛶; na Androidzie gra próbuje też zablokować poziom), pauza, reset, kamera, panel.
- **W pionie** zasłania grę plansza „Obróć telefon” (iPhone nie pozwala stronie zablokować orientacji).
- **Wydajność:** na dotyku jakość jest od razu niska (większy piksel, bez bloomu, co druga latarnia bez światła). Licznik FPS
  i przełącznik jakości są w panelu, w folderze „Wydajność”.
- **Pauza:** gra staje, gdy aplikacja przejdzie w tło; na telefonie wracasz dotknięciem, na komputerze sama rusza po powrocie. P / Esc też pauzuje.

Roadmapa (dopracowanie sterowania mobilnego w v0.15): [`ROADMAP.md`](ROADMAP.md).

## Jak jeździć driftem (preset „Normalny”, domyślny)

Normalna jazda trzyma przyczepność: zwykły zakręt, nawet pełny skręt z gazem, nie wywoła poślizgu. Poślizg zaczyna się dopiero od:
- **ręcznego** (Spacja) ze skrętem od ~40 km/h,
- **odpuszczenia gazu** w szybkim zakręcie od ~54 km/h (masa przechodzi na przód, tył ucieka),
- **pełnego gazu z pełnym skrętem** od ~61 km/h.

W poślizgu nic nie trzyma kąta za ciebie:
- pełny gaz **stopniowo** pogłębia kąt, około pół gazu go trzyma, odpuszczenie zmniejsza; **kontra** (skręt przeciwny do zakrętu) reguluje;
- za mało gazu – auto się prostuje i łapie przyczepność;
- **strefa balansu:** za duży kąt (od 50°, w Pro od 45°) trzymany bez kontry i bez odpuszczenia gazu przez ok. 1 s kończy się **obrotem**.
  Wcześniej auto ostrzega: pisk robi się głośniejszy i wyższy, a kamera drży. Kontra albo odpuszczenie gazu w tym czasie ratuje auto;
- za mocna kontra przy wyjściu **zarzuca w drugą stronę**; wyjście z wyczuciem: odpuść gaz i lekko kontruj;
- auto ma **pęd**: w szybkim zakręcie i w drifcie wynosi je na zewnątrz, więc da się przestrzelić zakręt.

**Napęd:** realne dane Poloneza Caro 1.6 GLE (87 KM, 5 biegów, automatyczna zmiana), opory i masy – 0–100 i vmax jak w katalogu;
w grze żwawiej dzięki czynnikowi zabawy (G → Napęd). Szczegóły: [`docs/fizyka-aut.md`](docs/fizyka-aut.md).

Presety (G → Preset, później w menu Ustawienia): **Normalny** (domyślny), **Pro** (wyższe progi, tył ucieka szybciej, obrót od 55°)
i **Łatwy** – dawna jazda z asystą (kąt trzyma się sam, bez bączków), jako opcja dostępności.

**Mapa:** Osiedle Kosmonautów ułożone jak prawdziwe osiedle z wielkiej płyty. Plan ze szkicem i strefami jest w
[`docs/mapa.md`](docs/mapa.md), a sama mapa w `src/maps/osiedle.json` (edytowalny plik danych). Układ:
- ulica główna z liniami, latarniami po obu stronach, przystankiem i pasami;
- węższe uliczki osiedlowe bez linii, tworzące zamknięte pętle (duża pętla to trasa wyścigu); narożniki zaokrąglone;
- bloki z wielkiej płyty z kodu (4 i 10 pięter, różne długości, klatki z daszkami, balkony, zapalone okna, maszt 5G);
- między blokami podwórka: trawa, chodniki, plac zabaw, trzepaki, ławki, drzewa; parkingi osobno;
- rząd garaży z placem połączonym z ul. Tereszkowej;
- pawilony i Żappka 24h przy głównej z parkingiem;
- market „Supersam” z wielkim placem do driftu (wjazdy z Gagarina i z głównej);
- paczkomat przy wejściu do Bloku 1, śmietniki przy blokach, auta tylko na parkingach i placach.
- postacie: chłopaki przy placu, Sąsiad Zbyszek, Pani Halina, Mietek, Pan Zdzisio (rozmowa: stań obok, E / pad B / dotyk);
- stacja paliw „Kometa” przy głównej.

**5G (v0.6e):** przy masztach (Blok 1, Blok 5, kratownica za garażami) reflektory mrugają, radio szumi, silnik przerywa, a obraz
lekko się zakłóca. To czysty klimat, bez kar; siłę efektów zmienisz w panelu (G → 5G).

**Pętla gry (v0.6d):** jeździsz, driftujesz, zarabiasz, wydajesz, odblokowujesz.
- **Paliwo:** pełny bak starcza na ok. 10 min, drift pali więcej. Pusty bak to nie koniec gry: pchasz albo dzwonisz po kumpla.
- **Kasa:** za misje i za drift w misjach, najwięcej w pokazach.
- **Szacun:** za misje i drift przy ludziach; odblokowuje kolejne misje i zmienia to, co mówią postacie.
- **Żappka:** zapis gry i energetyk.

Kolizja każdego obiektu to obrys jego geometrii na wysokości karoserii (drzewo zderza się pniem, latarnia słupem).
`?plan` w adresie pokazuje całą mapę z góry.

![Plan osiedla z góry](docs/mapa.png)

**Uderzenia:** przeszkody zderzają się z karoserią auta (prostokąt 4,3 × 1,7 m) i mają kolizję dokładnie taką, jak wyglądają.
Przejazd tuż obok lampy nic nie robi, a zahaczenie jej rogiem to uderzenie. Po uderzeniu auto zatrzymuje się na przeszkodzie
i lekko odbija, zależnie od materiału: od drzewa najsłabiej, potem beton, metal (lampy, śmietniki, płoty), zaparkowane auta,
a od opon i plastikowych barierek najmocniej. Silnik przez chwilę nie pcha w przeszkodę; cofanie działa od razu.
Suwaki: `crashRebound`, `crashStun`, `crashMinSpeed` w „Wygląd jazdy i kontakt”.
Awaryjne wypchnięcie zostało tylko na wypadek zakleszczenia (np. auto wstawione w szparę węższą od siebie).

W obu presetach przednie koła w drifcie same pokazują kontrę (skręcone przeciwnie do zakrętu, o tyle, ile wynosi kąt driftu).

**Auto** czyta profil z `src/cars/polonez.json`: realne dane Poloneza 1500 (82 KM, 114 Nm, 1110 kg, RWD, 4 biegi 3,75/2,30/1,49/1,00,
155 km/h) i wartości do gry (108 km/h, jak dotąd, żeby prowadzenie się nie zmieniło). Z niego biorą się masa i moc kuli, biegi
i obroty na liczniku, model i paleta lakierów. Nowe auto = nowy plik JSON w `src/cars/`. Lakier z epoki (domyślnie beż) wybierzesz
w panelu, w folderze „Auto”.

W panelu są też foldery:
- **Grafika (noc, pixel-art):** rozmiar piksela, obrysy, stopnie jasności, dithering, drżenie PS1 (domyślnie wyłączone), ekspozycja, mgła, światła, lakier Poloneza;
- **Kamera Diorama** i **Kamera Za autem**;
- **Dźwięk**.

Przycisk **Eksport ustawień (JSON)** kopiuje wszystkie parametry do schowka (i pokazuje je w okienku), a **Wczytaj JSON** wczytuje wklejone.

## Paliwo, kasa, szacun, stacja i Żappka

- **Paliwo:**
  - zegar paliwa na desce, a poniżej 15% zapala się kontrolka rezerwy i słychać pisk;
  - pełny bak (45 l) starcza na ok. 10 min zwykłej jazdy, drift pali więcej.
- **Pusty bak:** silnik gaśnie. Wybierasz:
  - **Pchaj** – gaz popycha auto powoli, sterujesz;
  - **Zadzwoń po kumpla** – 30 zł, holuje cię pod dystrybutor.
  Kasa może zejść do −40 zł, więc gra się nigdy nie blokuje.
- **Stacja „Kometa”** (przy głównej, na wschodzie): stań przy dystrybutorze, pojawi się panel: do pełna / za 20 zł / za 50 zł (2,99 zł/l).
- **Kasa:** za misje i za drift w trakcie misji, najwięcej w pokazach.
- **Szacun:** za misje i za widowiskowy drift przy ludziach. Poziomy mają nazwy (od „Frajera z parteru”). Szacun odblokowuje
  kolejne misje (pokaz od 50, wyścig od 150) i zmienia to, co mówią postacie.
- **Żappka 24h:** stań na zielonym polu przed wejściem, żeby zapisać grę. W sklepie jest energetyk: przez minutę szacun rośnie 2× szybciej.
- **Misja 1 „Paczka”:**
  1. odbierz paczkę z Paczkoboxu przy Bloku 1;
  2. zarób 30 zł driftem na placu pod Supersamem;
  3. zatankuj na „Kometa” (co najmniej 40%);
  4. dowieź paczkę pod Blok 4;
  5. wróć do Żappki.
  Na końcu podsumowanie i nagroda.
- `?paliwo=3` startuje z 3 l w baku (do sprawdzenia rezerwy i pustego baku).
- Wszystkie liczby są w panelu (G), w folderze „Paliwo, kasa, szacun i misja”.

## Punktacja

HUD w prawym dolnym rogu: prędkość, bieg, obrotomierz (prawdziwe obroty z napędu) i punkty.

Punkty rosną z kątem poślizgu × prędkością, a mnożnik co 2 s ciągłego driftu. Po ~1,2 s bez driftu punkty trafiają do wyniku.
Uderzenie w przeszkodę (od ~20 km/h) w trakcie driftu = punkty przepadają. Rekord zapisywany w `localStorage`.

## Struktura

Opis modułów i modelu jazdy: [`CLAUDE.md`](CLAUDE.md#architektura-v03). Fizyka auta jest zamknięta w `src/vehicle.ts`
z prostym interfejsem wejście/wyjście, więc reszta gry nie zależy od biblioteki fizycznej.

## Deploy

Workflow `.github/workflows/pages.yml` publikuje build na GitHub Pages po pushu na `main`
(w ustawieniach repo: *Settings → Pages → Source: GitHub Actions*).

## Znane ograniczenia

- Bundle ma ~5 MB (1,8 MB gzip), bo `rapier3d-compat` wbudowuje WASM w JS. Modele to kolejne ~8 MB `.gltf` (base64). Do optymalizacji później.
- Misje: trzy po kolei (Paczka, Pokaz, Wyścig z sąsiadem); teksty są tymczasowe (PLACEHOLDER, `docs/teksty.md`).
- Postacie to bryły z kodu: modeli CC0 nie dało się pobrać z tego środowiska (podmiana: `docs/teksty.md`).
- Kolizja karoserii z przeszkodami to prostokąt w rzucie z góry (bez zaokrągleń i bez wysokości): liczy się obrys auta na ziemi.
- Model Poloneza ma licencję Sketchfab Standard, a nie CC0 (szczegóły w CREDITS).
- Dźwięki są w `.ogg`: starsze Safari ich nie odtworzy.
- Bez GPU sprawdzone tylko zrzutami (SwiftShader); płynność i jasność na prawdziwej karcie trzeba ocenić samemu.

Assety i licencje: [`CREDITS.md`](CREDITS.md).

# Changelog – Polish Drifter

Wersje do v0.4c mają lokalne tagi w git (serwer odrzuca wypychanie tagów); od v0.5 wersję znajdziesz po commicie „v0.5a – …”.
Plan dalszych wersji: [`ROADMAP.md`](ROADMAP.md).

## Sesja porządkowa (bez zmian w grze)
- `docs/referencje/README.md`: jak wgrać zdjęcia, drony, eksporty OSM i screeny (foldery, `opis.txt`, nazwy plików).
- `scripts/referencje.py`: HEIC → JPG, zmniejszenie do 2000 px, obrót z EXIF, usunięcie metadanych (GPS), zmiana nazw z pliku, paleta kolorów.
- `docs/BRAKI.md`: czego brakuje do kolejnych sesji (zdjęcia, modele, dźwięki, muzyka), priorytety, top 10, podział „z kodu” / „do dostarczenia”.
- `ROADMAP.md`: podział na sesje (S2 v0.7 jazda/dźwięk/orientacja, S3 v0.8 polski świat, S4 v0.9 większa mapa, S5 fabuła, później trasa nad wodą) i decyzje o kasie za drift w wolnej jeździe oraz tankowaniu „na zeszyt”.
- `KATALOG.md`, `STYL.md` i `plan-mapy.md` powstaną po wgraniu zdjęć (folder `docs/referencje/` był pusty).

## v0.6f – nowa nazwa: Polish Drifter
- Gra nazywa się teraz **Polish Drifter** (menu, tytuł strony, plansza „Obróć telefon”, README, dokumentacja).
- Klucze zapisu w przeglądarce (`agro-settings`, `agro-progress`) zostają bez zmian, żeby ustawienia i postęp nie przepadły.

## v0.6e – 5G jako klimat
- **Maszty 5G:** na Bloku 1 (był), na Bloku 5 i wolnostojąca kratownica 26 m za garażami. Wszystkie mają migające czerwone światło.
- **W promieniu ok. 36 m od masztu** (tym mocniej, im bliżej; `src/fiveg.js`):
  - reflektory krótko przygasają;
  - słychać szum z trzaskami (Web Audio, bez pliku);
  - silnik co jakiś czas przerywa (na chwilę znika gaz);
  - obraz ma delikatne zakłócenia (przesunięte rzędy pikseli, rozszczepienie kolorów, pojedyncze iskry w końcowym shaderze pixel-artu);
  - narrator czasem rzuca paranoiczny komentarz (`teksty.json` → `5g`, PLACEHOLDER), najwyżej raz na 55 s.
- Bez licznika i bez kar. Siła każdego efektu, zasięg i przerwa między komentarzami są w lil-gui („5G (klimat)”), głośność szumu w dźwięku.
- Testy (`test/fiveg.test.mjs`): efekty tylko w promieniu i silniejsze bliżej (przy maszcie w 30 s: 46 mrugnięć, 13 przerw silnika;
  22 m: 18 / 4; daleko: nic), każdy efekt wyłączalny, narrator nie częściej niż co 55 s.

## v0.6d – paliwo, kasa, szacun (zamiast baterii)
- **Bateria usunięta:** kod (`survival.js`), HUD, teksty, testy; reflektory zawsze świecą (przy pustym baku postojowe).
- **Paliwo** (`src/economy.js`):
  - bak 45 l; spalanie z prawdziwych obrotów i obciążenia (bsfc silnika), drift pali ×1,35;
  - pełny bak ≈ 10 min zwykłej gry (`fuelScale` 22);
  - na desce zegar paliwa i kontrolka rezerwy.
- **Pusty bak:** silnik gaśnie, panel do wyboru:
  - pchanie (auto toczy się ok. 6 km/h, sterujesz);
  - telefon do kumpla (30 zł, holowanie pod dystrybutor).
  Brak game over; dług do −40 zł sprawia, że gra się nie blokuje.
- **Stacja paliw „Kometa”** przy głównej (wiata na słupach ze świetlówkami, dystrybutory, kiosk, szyld; w klimacie CPN):
  panel „Do pełna / Za 20 zł / Za 50 zł”, 2,99 zł/l.
- **Kasa i szacun:**
  - kasa za misje i za drift w misji (0,01 zł/pkt) i w pokazie (0,03 zł/pkt);
  - szacun za misje i widowiskowy drift przy ludziach;
  - 5 poziomów z nazwami (PLACEHOLDER).
  Szacun odblokowuje misje: pokaz od 50, wyścig od 150, a nagrody kolejnych misji je pokrywają. Zmienia też kwestie postaci:
  warunki w rozmowach JSON (`alt`, `if`, `else`), np. Seba mówi inaczej przy szacunie 150, a Halina ma dodatkową odpowiedź, gdy masz kasę.
- **Żappka:** punkt zapisu + sklep (energetyk „Tygrys 5G”: 6 zł, przez 60 s szacun ×2).
- **Misja 1 od nowa:** paczka → zarób 30 zł driftem na placu → zatankuj ≥ 40% na „Kometa” → dostawa → Żappka. Nagrody misji w JSON.
- **HUD i zapis:** kasa i szacun w pikselowym stylu pod rekordem; zapis postępu obejmuje paliwo, kasę, szacun i flagi rozmów.
- **Testy:**
  - `test/economy.test.mjs`: czas na baku, zużycie, stacja, dług, holowanie, stawki, energetyk, poziomy, zapis, odblokowanie, warunki w rozmowach;
  - misja 1 i podpowiedzi przerobione;
  - stacja w teście osiągalności;
  - E2E dotykiem z tankowaniem.

## v0.6c – realne parametry aut i przelicznik
- **Model hybrydowy** (`docs/fizyka-aut.md`, z omówieniem Marco Monstera, Edy's Vehicle Physics, ArcadeCarPhysics i
  wassimulatora): **napęd z realnych danych**, prowadzenie i drift bez zmian (kula arcade).
- **Nowy `src/engine.js`:**
  - krzywa momentu z danych katalogowych, obroty z prędkości, biegu i promienia koła, poślizg sprzęgła przy ruszaniu;
  - automatyczna skrzynia (zmiana tam, gdzie następny bieg ciągnie mocniej), ogranicznik obrotów, hamowanie silnikiem;
  - opór powietrza i toczenia, masy wirujące.
  Prędkość maksymalna wynika z fizyki.
- **Czynnik zabawy** (`fun`, domyślnie 1,7, lil-gui → „Napęd”): działa jak lżejsza masa efektywna.
  Proporcje między autami i silnikami są realne, vmax się nie zmienia.
- **Obrotomierz, bieg i dźwięk silnika** biorą prawdziwe obroty. Wirtualny `gearbox.js` usunięty.
- **Profil: Polonez Caro 1.6 GLE** (1993–97):
  - silnik: 87 KM @ 5200, 132 Nm @ 3800, 1110 kg, 185/70 R13, bak 45 l, 4318 × 1650 × 1420 mm, rozstaw osi 2509 mm;
  - skrzynia: I 3,753, II 2,132, III 1,378, IV 1,000, V 0,881, R 3,867, przełożenie główne 3,9;
  - źródła w pliku; strony były zablokowane, więc dane pochodzą z wyników wyszukiwania.
- **Kalibracja** (fun = 1, pełna fizyka): 0–100 **16,1 s** (katalog 16,3 s), vmax **158 km/h** (katalog ok. 155).
  Sprawdzian na drugim silniku (1.6 76 KM): 18,2 s / 150 km/h przy katalogowych 18,1 s / 154 km/h.
- **Silniki pod swapy** (`src/engines/`, bez UI):
  - 1.6 76 KM: 18,2 s, 150 km/h;
  - Rover 1.4 16V 103 KM, przełożenie główne 4,3: 15,0 s, 166 km/h;
  - XUD9 1.9 D 69 KM: 19,9 s, 143 km/h.
- **Lakiery FSO z kodami** (garaż):
  - kolory: L-45 Niebieski oceaniczny, L-46 Burgund, 69E Złoty metalik, 74U Czerwony, 92U Srebrny metalik,
    42U Zielono-granatowy mika, L-117 Ciemnozielony metalik, L-49 Kakaowy, L-59 Niebieski bałtycki, L-61 Morelowy;
  - RGB to przybliżenia, oznaczone w pliku; źródła: fora FSO.
- **Testy:**
  - `test/engine.test.mjs`: krzywa, kalibracja, proporcje silników, czynnik zabawy;
  - testy strefy balansu na obu napędach.

## v0.6b – drift: strefa balansu (Normalny, Pro)
- **Kąt:** pełny gaz pogłębia kąt stopniowo (Normalny +12°/s, Pro +15°/s; wcześniej ok. 29°/s); ok. pół gazu trzyma kąt,
  odpuszczenie go zmniejsza; kontra reguluje.
- **Obrót** dopiero po dłuższym błędzie. Powyżej 50° (Pro 45°) liczy się czas bez kontry i bez odpuszczenia gazu:
  po 1,1 s (Pro 0,85 s) auto się obraca. Każda korekta cofa licznik dwa razy szybciej.
  Twardy limit 72° (Pro 65°) zostaje na skrajne przypadki.
- **Ostrzeżenie przed obrotem:** mocniejszy i wyższy pisk opon, drżenie kamery (`shakeWarning` w panelu G).
- **Zmierzone** (od wejścia ręcznym przy 60 km/h, pełny gaz bez korekt):
  - Normalny: 35° po 1,45 s, strefa po 2,8 s, obrót po 3,9 s (1,08 s w strefie);
  - Pro: 35° po 1,0 s, strefa po 1,8 s, obrót po 2,6 s (0,83 s w strefie);
  - kontra lub odpuszczenie gazu przy 60% ostrzeżenia ratuje auto w obu presetach; pół gazu trzyma 30,1° → 30,1° przez 1,5 s.
- Nowy test `test/balance.test.mjs`; stare testy dopasowane (zaniedbany drift obserwowany 6 s zamiast 3 s, kontra testowego
  kierowcy dobrana do nowego tempa).

## v0.6a – wszystko bez klawiatury (telefon, pad)
- **Błąd blokujący:** podsumowanie misji znikało po 20 s i na telefonie nie było już jak przejść do następnej misji.
  Teraz podsumowanie to panel z przyciskami „Dalej” / „Jeszcze raz” (po ostatniej misji „Wolna jazda”), który czeka na wybór.
- Nowy `panel.js` (podsumowanie teraz, w v0.6d też stacja, sklep i pusty bak): palec / mysz, klawiatura (strzałki, Enter/E, 1–9, Esc),
  pad (d-pad lub gałka, A, B). Auto stoi, dopóki panel jest otwarty.
- Przegląd miejsc z klawiaturą:
  - rozmowy i wybory odpowiedzi działają dotknięciem i padem (B rozmowa, A dalej, d-pad wybór);
  - menu, pauza i garaż (przeciąganie) działają dotykiem;
  - restart misji jest w menu pauzy;
  - długie światła dostały przycisk „L” na ekranie dotykowym;
  - ustawienia klawiszy są ukryte na dotyku.
- Pad:
  - **Start otwierał pauzę i od razu ją zamykał** (to samo naciśnięcie liczyło się jako „wstecz”);
  - A w menu nic nie robił, gdy strona nie miała fokusu klawiatury;
  - oba poprawione.
- Wyścig: gdy przeciwnik stał już w chwili wygranej, misja nie widziała wyniku i czekała w nieskończoność – poprawione.
- Test w przeglądarce `scripts/e2e-dotyk.cjs`: misje 1 → 2 → 3 do końca samym dotykiem (Graj, przycisk rozmowy, dotknięcia okienka
  rozmowy i odpowiedzi, „Dalej” w podsumowaniach); `scripts/e2e-pad.cjs`: menu, pauza, rozmowa z wyborem i panel samym padem.
- Stała zasada w CLAUDE.md: po każdej wersji PR do `main` i scalenie, gdy testy przechodzą.

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

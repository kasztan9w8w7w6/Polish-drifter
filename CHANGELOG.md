# Changelog – Polish Drifter

Wersje do v0.4c mają lokalne tagi w git (serwer odrzuca wypychanie tagów); od v0.5 wersję znajdziesz po commicie „v0.5a – …”.
Plan dalszych wersji: [`ROADMAP.md`](ROADMAP.md).

## v0.8a – audyt gotowców
- `docs/gotowce.md`: co wymieniam na gotowce (yuka, @tweenjs/tween.js, simplex-noise, Tone.js) i dlaczego, co zostaje
  (silnik fabuły/ekonomia, format mapy, pixel-art, figura postaci z kodu – brak bezpiecznie licencjonowanego riga w
  zasięgu sieci tej sesji, patrz docs).
- Scalona gałąź `referencje-v08`: 118 zdjęć referencyjnych (`docs/referencje/`), modele aut (`assets-src/modele-aut/`).

## v0.8f – fabuła cz. 5: Park według zdjęć
- Zbiorniki: cylindryczne silosy → prostokątne baseny (betonowa obrzeża + zatopiona woda), zgodnie z rzutem z góry
  i zdjęciami w docs/referencje/park/.
- Nowa nawierzchnia toru słupków (płyty, plamy, łaty, pęknięcia).
- Ściany z opon jako dynamiczne bryły Rapiera (`physics.js` `addDynamicCylinder`) na zawrotce – rozlatują się po
  uderzeniu, wracają na miejsce na starcie każdego przejazdu (gracza i NPC).
- Trasa 6 słupków bez zmian (zwalidowana kalibracja z v0.7 zostaje); notatka autora o wąskiej uliczce Magazynowej
  między zbiornikami – opisana jako możliwy kierunek na kolejną sesję, nie wdrożona teraz (patrz RAPORT).
- `docs/wdrozenie-fabuly.md` §11.

## v0.8e – fabuła cz. 4: wylotówka naturalna
- Trzy nowe punkty kontrolne trasy (łagodne esy), bez zmiany punktów, od których zależą inne miejsca (przystanek,
  wieś); teren tła z delikatnymi wzgórzami przez `simplex-noise` (środkowy pas korytarza zostaje płaski – wstęga
  drogi się nie wybrzusza); nowe: słupy energetyczne, jeden przepust, jeden zjazd żwirowy, jedna kapliczka.
- Czas sprawnego przejścia (`test/czas.mjs`) bez zmian (27–29 min) – kosmetyczna zmiana trasy, nie długości/tempa;
  cel 45–60 min zostaje do kolejnej sesji (patrz RAPORT/ROADMAP).
- `docs/wdrozenie-fabuly.md` §10.

## v0.8d – fabuła cz. 3: rozmowy filmowe i font pikselowy
- Cały interfejs fabuły na foncie Silkscreen (naprawione nadpisania system-ui/Courier New u źródła); telefon
  dostał odrębny pikselowy font starej komórki (`VT323`, OFL).
- Zbliżenie kamery na rozmowie na postoju: `camera.ts` `closeZoom` (ta sama Dioram, mocniejszy zoom, celuje między
  auto i rozmówcę) – bezpieczniejszy wariant niż osobna kamera perspektywiczna (ryzyko dla `RenderPixelatedPass` bez
  możliwości podglądu wizualnego w tej sesji, patrz RAPORT).
- Pasy (letterbox) i przyciemnienie tła na `body.f-rozmowa` (CSS, bez JS).
- Cutscenka FELGA_BICIE: ruch felgi na `@tweenjs/tween.js` `Easing.Quadratic.InOut` zamiast liniowego.
- `docs/wdrozenie-fabuly.md` §9.

## v0.8c – fabuła cz. 2: ludzie (chodzenie, yuka)
- Diagnoza: nogi (jedna sztywna kość) nigdy się nie ruszały – stąd lewitowanie przy każdym ruchu.
- Brak bezpiecznie licencjonowanego riga CC0 w zasięgu sieci tej sesji (docs/gotowce.md) → naprawa figury z kodu:
  noga na dwa segmenty (biodro + kolano), cykl chodu z prędkości NPC (amplituda 0 w bezruchu).
- Ruch rolkarzy przez yuka (`EntityManager`, `Vehicle`, `FollowPathBehavior`) zamiast ręcznej matematyki okręgu.
- `docs/wdrozenie-fabuly.md` §8.

## v0.8b – fabuła cz. 1: beemka i bus na fizyce Poloneza
- BMW E34 i VW T3 jako prawdziwe auta (`createVehicle()`) na profilach `src/cars/bmw-e34.json`, `vw-t3.json`, sterowane
  przez `src/npcAutopilot.js` (ten sam moduł co `test/autopilot.mjs`) – zamiast animacji po krzywej z v0.7.
- Kasa nadal liczona z tablicy silnika fabuły (`a.slupki`), nie z wyniku fizycznego przejazdu – bez zmian w matematyce
  zakładów; `npm test` (90/90), `e2e-noc` (NA_STYK, ZAKLADY): kasa zgodna z macierzą, bez błędów.
- `car.js`: `fitPolonez` → `fitCar` (ogólniejsza, węzły bez szkieletu, `look.frontYawDeg`).
- `docs/wdrozenie-fabuly.md` §7.

## v0.7e – fabuła, cz. 4: testy
- **Automat całej nocy na prawdziwej grze** (`scripts/e2e-noc.cjs`):
  - obsługa jednym urządzeniem: klawiaturą, samym dotykiem (CDP) albo samym padem;
  - wybory i wyniki przejazdów są skryptowane, a przejazdy między miejscami to teleport;
  - opcja `zapis`: przeładowanie strony w scenie 5 i „Kontynuuj”.
- **Wynik: każde z 4 zakończeń, kasa zgodna z macierzą plan §5:**

  | Zakończenie | Kasa przed świtem | Kasa na koniec |
  |---|---|---|
  | NA STYK | 849 | 899 |
  | PRAWIE | 829 | 779 |
  | JUTRO | 779 | 729 |
  | CZYSTO | 779 | 889 |
  | zakłady nocne i na busa (CZYSTO) | 833 | 891 |

- **Testy w Node:**
  - `test/fabula.test.mjs` (silnik);
  - `test/slupki.test.mjs`: czyste wejścia, animacja NPC zgodna z wynikiem, trudność z autopilotem na prawdziwym aucie (`test/autopilot.mjs`, preset Normalny, 60 prób na poziom): dobry 100%, średni 58%, słaby 3% prób z ≥ 4/6.
- `test/czas.mjs`: szacowany czas sprawnej nocy to ok. 27–29 min (cel planu 45–60, patrz raport).
- Stare `e2e-dotyk` / `e2e-pad` sprawdzają teraz prototyp (`?stare`).
- **Poprawka dotyku:** okienko telefonu wchodziło na pedały i stuknięcie w odpowiedź trafiało w przycisk. Teraz telefon i tablica zakładów są u góry, a okna fabuły leżą nad przyciskami dotykowymi.

## v0.7d – fabuła, cz. 3: mapa i postacie (greybox)
- `src/fabula/swiat.js`, `src/fabula/mapa.json` – układ z docs/wdrozenie-fabuly.md §2:
  - **Park** (dawny plac):
    - zbiorniki za płotem, 4 tiry, latarnie co ok. 35–40 m;
    - kombi z facetem z termosem, BMW e34, rolkarze krążący wokół słupka;
    - trasa 6 słupków z łukami po stronie mijania i linią startu;
    - poranna zmiana (Henio, Zdzichu, Jurek) i bus od 06:12.
  - **Miasto:**
    - podwórko Mirka: wiata, agregaty, pralka, fotel, 4 felgi, kombi ze świecącym bagażnikiem;
    - sygnalizacja na skrzyżowaniu, wiadukt nad główną;
    - sklep „NOCNY 24h” zamiast szyldu z marką, stacja Kometa;
    - blok Kamila.
  - **Wylotówka:** przerwa w płocie na zachodzie i 2,5 km starej drogi bez latarni:
    - słupki drogowe, las i łąki, 34 dziury (wstrząs, stuk felgi);
    - przystanek „Zielone Pole” z autem Kamila na awaryjnych (od sc. 9 słabszych).
  - **Wieś:** podwórko z lampą (gaśnie po sc. 7), kurnik, dom z migającym telewizorem, płot z furtką, pies; odbiorca od 04:05.
  - **Kierunek na zalew:** bariera i przekreślony znak „SZCZECIN · ZALEW” na wschodnim końcu głównej.
  - Kamil siedzi na miejscu pasażera (głowa opada, kiedy śpi), felgi leżą w bagażniku i na tylnej kanapie.
- Wyłączone na mapie w trybie fabuły: maszty 5G, stare postacie, zaparkowane auta na starcie słupków.

## v0.7c – fabuła, cz. 1–2: interfejs, telefon, zapis i mechaniki
- **Interfejs fabuły** (`src/fabula/ui.js`), bez narratora:
  - tekst techniczny w płaskim, urzędowym stylu;
  - rozmowy na postoju w oknie z portretem (auto stoi);
  - rozmowy w trakcie jazdy w pasku (auto jedzie, pasek przewija się sam);
  - stary telefon: rozmowa i SMS, ekrany w trakcie rozmowy jako status, drganie przy dzwonieniu;
  - wybory klawiszami 1–4, Tab, dotykiem i padem.
- **Klej** `src/fabula/gra.js` i flagi `src/config.js`:
  - wyłączone: szacun, sklep i energetyk, maszty 5G, wyścig, pchanie i holowanie, narrator, stare misje i postacie, kasa za drift;
  - `?stare` przywraca prototyp.
- **Zegar** na HUD:
  - w jeździe ×3, nigdy nie przeskakuje następnej godziny ze scenariusza;
  - scena zaczynająca się później to krótkie zaciemnienie, `skok_czasu` też z zaciemnieniem;
  - świt w sc. 11: niebo, mgła i światło od 06:04 do 06:40.
- **Kasa** jako jedna pula (start 699), na HUD „brakuje do 889”; kartka od Zbycha w pozycjach pod K, padem ↓ i przyciskiem.
- **Ekonomia** z `dane-mvp.json`:
  - tankowanie w sc. 3 „za pięć dych” (7,15 l);
  - paliwo liczone od przejechanej drogi (cała noc ok. 6,7 l), start na rezerwie, bez pustego baku.
- **Zakłady:**
  - tablica z kursem „na oko”, stawkami i możliwą wygraną w złotówkach oraz „nie stawiam”;
  - jawne zakłady tłumu (Henio, Zdzichu, Jurek) i twoja stawka na tablicy;
  - przejazd NPC (BMW, bus Zdzicha): animacja po trasie z wynikiem losowanym z q, kamera na aucie, werdykt przy każdym słupku.
- **Przejazd gracza:** 6 słupków, licznik czystych wejść, werdykty (CZYSTE / BEZ POŚLIZGU / POTRĄCONY / ZŁA STRONA / ZA DALEKO), legenda „czyste”; rozliczenie.
- **Ładunek FELGI:**
  - +70 kg w kuli i w napędzie (`engine.js` `cargoKg`);
  - przesuwanie w zakrętach lekko ciągnie kierownicę i stuka;
  - lusterko zasłonięte felgą.
- **Pasażer:** Kamil w aucie i na HUD (śpi / budzi się); radio samo się ścisza, gdy pasażer rozmawia, a gra głośniej, gdy śpi.
- **Radio:** 4 stacje (Q, pad Back, ♪):
  - na razie ciche tło z Web Audio w stylu stacji;
  - gotowe na utwory z `public/muzyka/lista.json` (docs/muzyka.md).
- **Scenka FELGA_BICIE:** auto stoi, kamera na kurniku, felga toczy się krzywo, tekst techniczny, powrót.
- **Zakończenie** wg warunków z danych, epilog Kamila wg PIWO, ekran końcowy z podsumowaniem nocy („Nowa noc” / „Menu”).
- **Zapis nocy** na początku każdej sceny (`pd-noc`: stan, miejsce auta, paliwo); „Kontynuuj” w menu.

## v0.7b – fabuła, cz. 1: silnik fabuły
- `src/fabula/silnik.js` (bez DOM, testy w Node):
  - czyta `docs/fabula/dane-mvp.json` i przechodzi sceny węzeł po węźle;
  - opisy i haki nie trafiają do gry;
  - obsługuje warunki „jeśli FLAGA”, flagi z wyborów, bram i zakładów;
  - wykonuje wszystkie polecenia ⚙ z plan-mvp §8a;
  - wypełnia placeholdery [KASA] i [BRAK], a nazwy podmienia słownikiem (`slownik.json`: Orlen → Kometa…);
  - na początku każdej sceny zapisuje stan nocy do wczytania.
- `src/fabula/inscenizacja.json`: gdzie dzieje się scena, tryb (postój / jazda) i bramy (dojazd, jazda N m, strefa kombi →
  PODJECHAL_DO_KOMBI, czas, tankowanie) – warstwa gry, scenariusz bez zmian.
- `src/fabula/postacie.json`: imiona i wygląd postaci z §7.
- Testy (`test/fabula.test.mjs`):
  - wszystkie 7488 ścieżek nocy dają te same zakończenia i kasę min–max co symulacja scenarzysty;
  - macierz z plan §5: kasa przed świtem 849 / 829 / 799 / 779 zł, minimalne stawki 20 / 50 / 50 / 50;
  - kursy ze wzoru §4 zgadzają się z danymi;
  - każde polecenie zmienia stan;
  - rozmowa przez telefon i SMS, słownik nazw, zapis nocy.

## v0.7a – fabuła MVP „W nocy robota”: analiza wdrożenia
- Pliki od scenarzysty w `docs/fabula/` (scenariusz, dane, plan, projekt, biblia stylu, audyt) – jedyne źródło prawdy o fabule.
- `docs/wdrozenie-fabuly.md`: sceny → miejsca → polecenia ⚙ → mechaniki (istnieje / zmiana / nowa, koszt), układ mapy MVP
  (Park, Miasto, Wylotówka, Wieś, droga zamknięta na zalew), co wyłączam flagami, słownik nazw (Orlen → Kometa, Żabka →
  Nocny 24h, Biedronka → dyskont), 16 rozstrzygniętych niejasności, definicja „czystego wejścia” na słupek.

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

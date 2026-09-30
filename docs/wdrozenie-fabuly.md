# Wdrożenie fabuły MVP „W nocy robota”

Jedyne źródło prawdy o fabule to `docs/fabula/`:
- `scenariusz-mvp.md` – teksty;
- `dane-mvp.json` – dane, generowane przez `generuj_dane.py`;
- `plan-mvp.md` – sceny, ekonomia, zakłady, drabinka, polecenia ⚙;
- `projekt-gra-fabula.md` (mapa §6), `biblia-stylu.md`, `audyt-2.md`.

Ten plik opisuje, jak gra je wykonuje: co jest w danych od scenarzysty, a co w warstwie gry (inscenizacja, mapa, słownik nazw).

**Zasada podziału:**
- tekstów i liczb scenarzysty gra nie zmienia;
- gdzie scenariusz milczy (gdzie stoi auto, kiedy dzwoni telefon, jak wygląda przejazd), decyduje inscenizacja w `src/fabula/inscenizacja.json`;
- podmiany nazw są w słowniku `src/fabula/slownik.json`.

## 1. Sceny → miejsce → polecenia → mechaniki

Tryb scen:
- **postój** – auto stoi, okno rozmowy z portretem (E / A / dotyk = dalej);
- **jazda** – kwestie w pasku u dołu, auto jedzie, pasek przewija się sam (albo E / B / dotyk), a wybory są w pasku bez zatrzymywania auta;
- **telefon** – okienko starego telefonu (rozmowa albo SMS), w jeździe albo na postoju.

Rozpoczęcie sceny:
- **dojazd** – stań w miejscu, na mapie jest znacznik i odległość;
- **od razu**;
- **jazda N m** – po odjechaniu kawałka.

Mechaniki: **istnieje** (z prototypu), **zmiana** (przeróbka prototypu), **nowa**. Koszt to mój szacunek pracy: S = mały, M = średni, L = duży.

| Sc. | Miejsce na mapie | Start sceny | Tryb | Polecenia ⚙ | Mechaniki | Koszt |
|---|---|---|---|---|---|---|
| 0 | PARK (dawny plac pod Supersamem) | start nocy | swobodna jazda → postój przy kombi (opcja) → telefon | zaklad NOC_BMW, przejazd NOC_BMW, telefon ROZMOWA MIREK | jazda, zegar (nowa), kartka Zbycha (nowa), strefa kombi → PODJECHAL_DO_KOMBI (nowa), tablica zakładu (nowa), przejazd NPC: animacja + losowanie z q (nowa), telefon (nowa), radio TECHNO (nowa) | L |
| 1 | MIASTO: podwórko Mirka (wiata przy garażach) | dojazd | postój | – | rozmowa z portretem i wyborami (zmiana: z danych fabuły) | S |
| 2 | podwórko Mirka | od razu | postój | ladunek FELGI | ładunek: +70 kg w napędzie, przesuwanie, zasłonięte lusterko, felgi w aucie (nowa) | M |
| 3 | miasto → stacja **Kometa** | jazda 60 m (telefon), potem dojazd do dystrybutora | jazda + telefon, postój na stacji | telefon ROZMOWA KAMIL, kasa −50 | telefon, tankowanie „za pięć dych” (zmiana: stała kwota z danych) | S |
| 4 | WYLOTÓWKA: przystanek w polu | dojazd | postój | pasazer KAMIL | auto Kamila z awaryjnymi (nowa), pasażer w aucie, radio ściszone (nowa) | M |
| 5 | wylotówka (las, łąki, dziury) | od razu | jazda | – | rozmowa w trakcie jazdy, wybory w pasku, D1 → KAMIL_WIE (nowa) | M |
| 6 | WIEŚ: podwórko z lampą | dojazd | postój | radio DAD_ROCK, skok_czasu ×3 | skok czasu z zaciemnieniem (nowa), dom z telewizorem (nowa) | S |
| 7 | wieś: kurnik, lampa | od razu | postój | scenka FELGA_BICIE, ladunek BRAK | scenka na silniku (nowa), odbiorca pojawia się o 04:05 | M |
| 8 | wylotówka (powrót) | jazda 120 m | jazda + telefon | pasazer_spi KAMIL, telefon ROZMOWA MIREK, kasa +150 / +200 | D2 → PRAWDA, pasażer śpi (radio głośniej) | S |
| 9 | przystanek (auto Kamila mruga słabiej) | przejazd obok (≤ 45 m) | jazda | pasazer_budzi KAMIL | awaryjne słabsze | S |
| 10 | MIASTO: pod blokiem Kamila (śmietnik przy Bloku 2) | dojazd | postój | kasa −20 (D3), pasazer BRAK | D3 → PIWO, Kamil wysiada | S |
| 11 | PARK o świcie | dojazd na Park, potem dojazd do Henia (06:12) | postój, przejazd gracza | radio TECHNO, zaklad RANO_BUS, przejazd RANO_BUS, tlum RANO_GRACZ, zaklad RANO_GRACZ, przejazd RANO_GRACZ, kasa +10, zakonczenie | świt (nowa), poranna zmiana i bus (nowa), jawna tablica zakładów tłumu (nowa), **6 słupków: licznik czystych wejść** (nowa), rozliczenie, wybór zakończenia (nowa) | L |
| Zak. 1–4 + epilog | Park, auto stoi | od razu | ekran + telefon/SMS | telefon SMS / ROZMOWA MIREK, telefon SMS KAMIL | ekrany zakończenia, epilog wg PIWO, ekran końcowy z podsumowaniem nocy (nowa) | S |

Wszystkie polecenia z §8a wykonuje `src/fabula/silnik.js` (logika bez DOM, testy w Node). Świat (auta, postacie, kamera, UI)
odpowiada na zdarzenia silnika w `src/fabula/gra.js`.

**Czyste wejście na słupek** (przejazd gracza, sc. 11):
- wejście liczy się w chwili minięcia linii słupka (prostopadłej do trasy) po wskazanej stronie; strony są na przemian, jak w slalomie;
- **czyste**, jeśli naraz:
  - auto jest w poślizgu: kąt co najmniej 19° (Normalny), liczony ±5 m od linii słupka;
  - karoseria nie dotknęła słupka (bliżej niż 0,1 m od obrysu auta 4,3 × 1,7 m = potrącony);
  - auto przejechało w oknie do 7,5 m od słupka po właściwej stronie (łuk kredą na ziemi);
  - wejście jest w kolejności (nie pominięto słupka).
- Na ekranie przy każdym słupku pojawia się jedno z czterech: „CZYSTE”, „BEZ POŚLIZGU”, „POTRĄCONY”, „ZA DALEKO / ZŁA STRONA”, a u góry licznik „Czyste: 3/6”.
- Wszystkie progi są w lil-gui (sekcja „Słupki”) i w `src/fabula/slupki.js`.

## 2. Układ mapy MVP (projekt §6)

```
                      N (−z)
   ┌──────────────────────── OSIEDLE = MIASTO (200 × 200 m) ─────────────────────┐
   │ [garaże] PODWÓRKO MIRKA (wiata, felgi)              ║ PARK (dawny plac)       │   zbiorniki
   │   ═══ ul. Tereszkowej ═══════════════════╗         ║  tiry w rzędzie         │   ( ) ( ) ( )
   │        ║            blok 1 · blok 3      ║ Gagarina║  kombi + termos   ↑     │   za płotem
   │  WIADUKT  ║  ═══ Komarowa ═══════════════╣         ║  6 słupków ○ ○ ○  │     │
   │  (nad     ║            blok 5 · blok 2   ║         ║  rolkarze    BMW  │     │
   │  główną)  ║     [BLOK KAMILA: śmietnik]  ║   🚦    ║  hala (Supersam)        │
 ◄─╫══════════════════════ ul. Kosmonautów (główna) ═══╬═════════════════════════╫─ ✕ SZCZECIN / ZALEW
   │   przystanek     [NOCNY 24h]   pawilony  sygnalizacja       [KOMETA stacja]  │   (droga zamknięta:
   └───────────────────────────────────────────────────────────────────────────────┘    bariera, znak)
   │
   ▼ WYLOTÓWKA na zachód: prosta, dziurawa, bez latarni; las i łąki na przemian
   │ ~500 m: PRZYSTANEK W POLU (daszek, ławka, auto Kamila z awaryjnymi)
   │ ~2 km dalej, łagodne łuki
   ▼ WIEŚ: psy, płoty, PODWÓRKO Z LAMPĄ, kurnik, dom z telewizorem; za wsią pole (koniec drogi)
```

- **PARK = obecny plac pod Supersamem** (55 × 130 m asfaltu):
  - latarnie co ok. 40 m;
  - tiry w rzędzie przy wschodniej krawędzi;
  - zbiorniki (walce) za płotem;
  - kombi z facetem z termosem przy zachodnim wjeździe;
  - BMW e34 na dalekim (północnym) końcu, rolkarze krążą wokół słupka;
  - trasa 6 słupków środkiem placu, start od południa;
  - hala (budynek Supersamu) to miejsce porannej zmiany.
  - Start i koniec nocy są na Parku.
- **MIASTO = obecne osiedle:**
  - podwórko Mirka: plac przed garażami z nową wiatą, agregatami, pralką i fotelem;
  - stacja Kometa (jest);
  - sklep całodobowy: dawna Żappka, nowa fikcyjna nazwa;
  - sygnalizacja na skrzyżowaniu Gagarina × Kosmonautów;
  - wiadukt nad główną przy zachodnim wyjeździe;
  - blok Kamila: Blok 2 ze śmietnikiem przy parkingu.
- **WYLOTÓWKA** to nowy odcinek. Główna przebija płot na zachodzie i dalej biegnie droga 7 m, bez latarni:
  - las (skupiska drzew) i łąki na przemian;
  - dziury: ciemne łaty, a na większej prędkości wstrząs, stuk felgi i dźwięk;
  - przystanek w polu ok. 500 m za miastem;
  - droga ma ok. 2,5 km do wsi, więc rozmowa ze sceny 5 mieści się w jeździe (ok. 2–3 min).
- **WIEŚ** jest na końcu drogi, jako ślepa uliczka (dalej pole i płot):
  - podwórko z lampą na środku, kurnik, dom z oknem, w którym miga telewizor;
  - furtka i pies (bryła).
- **Kierunek na zalew i Szczecin:** wschodni koniec głównej zamyka betonowa bariera i znak z przekreśleniem. Tam „nie da się jechać”.

**Skracanie czasu:**
- zegar w jeździe idzie ok. 3× szybciej niż rzeczywisty, ale nigdy nie przeskakuje następnej godziny ze scenariusza;
- gdy scena zaczyna się od godziny późniejszej niż zegar (np. „Wieś · 01:38” po 20 min jazdy zegarowej), gra robi krótkie zaciemnienie i przestawia zegar – jak skok czasu;
- `skok_czasu` z danych zawsze zaciemnia.

## 3. Co wyłączam

Flagi są w `src/config.js` (`features`). Kod zostaje, można go włączyć z powrotem: `?stare` w adresie przywraca prototyp.

| Wyłączone | Flaga | Dlaczego |
|---|---|---|
| szacun (poziomy, odblokowania) | `szacun` | plan §8: usunięte z MVP |
| sklep i energetyk w Żappce, pole zapisu | `sklep` | plan §8 (zapis nocy działa inaczej, niżej) |
| maszty 5G (klimat) | `maszty5g` | nie ma ich w planie MVP |
| wyścig ze Zbyszkiem | `wyscig` | plan §8: usunięte z MVP |
| pchanie i holowanie, pusty bak | `pchanie` | plan §8: usunięte; paliwo nie spada poniżej 0,4 l („na oparach”), więc nie da się utknąć |
| narrator | `narrator` | projekt §5: brak narratora; na ekranie tylko tekst techniczny |
| stare misje 1–3, kampania, teksty PLACEHOLDER, stare postacie (Seba, Halina…) | `stareMisje`, `starePostacie` | zastąpione fabułą |
| kasa za drift (misje, pokaz) | `kasaZaDrift` | drabinka §5 liczy kasę co do złotówki; drift za kasę wraca po MVP (plan §4) |

Zostają:
- jazda z danych auta;
- paliwo (zegar, rezerwa);
- kasa jako jedna pula (`economy.js`, ceny z `dane-mvp.json → ekonomia`);
- rozmowy z portretem, panel wyboru (dotyk, pad), noc, reflektory, mgła;
- punktacja driftu (licznik na zegarach, bez kasy).

## 4. Słownik nazw (dla scenarzysty)

W świecie gry nie ma prawdziwych szyldów. Scenariusz zostaje bez zmian, a gra podmienia nazwy przy wyświetlaniu (`src/fabula/slownik.json`):

| W scenariuszu | W grze | Gdzie |
|---|---|---|
| Orlen | **Kometa** (stacja paliw) | tekst techniczny „(Orlen · 00:31)” → „(Kometa · 00:31)”; szyld stacji |
| Żabka | **Nocny 24h** (sklep całodobowy) | szyld w świecie (w tekstach wyświetlanych Żabka nie pada, jest tylko w opisie) |
| Biedronka | **dyskont** („Tyle płacą w dyskoncie.”) | kwestia Kamila, sc. 5 – to nie szyld, ale marka; podmieniam dla spójności, do decyzji scenarzysty |

Zostawiam bez zmian:
- **BLIK** – to nazwa sposobu płatności, nie szyld, a „BLIK: +150 zł” jest tekstem technicznym;
- modele aut (Polonez, BMW e34, golf) – auta z epoki są realiami świata.

## 5. Niejasności i jak je rozstrzygam

1. **Scena 0 bez podjechania do kombi:**
   - blok przy kombi (rozmowa, zakład, przejazd beemki) jest pomijany, a NOC_BMW zostaje nieustawiona;
   - dlatego kwestie „jeśli NOC_BMW = …” też się nie wyświetlają, łącznie z „Nie stawiasz. Też dobrze.”;
   - tak samo liczy symulacja scenarzysty (flaga nieustawiona ≠ żadna wartość).
2. **Kiedy w sc. 0 dzwoni Mirek?** „Po chwili” oznacza:
   - 12 s po rozliczeniu beemki;
   - albo po 3 min swobodnej jazdy, gdy gracz nie podjechał do kombi.
   - Obie liczby są w lil-gui.
3. **Kiedy kończy się `telefon`?** Kwestie idą jako rozmowa, dopóki:
   - mówi dzwoniący albo gracz wybiera odpowiedź;
   - nie zmieni się scena;
   - nie trzeba dojechać w nowe miejsce;
   - nie zacznie mówić ktoś inny.

   Teksty techniczne w trakcie rozmowy (np. „(MIREK)”, „BLIK: +150 zł”) pokazują się w okienku telefonu.
4. **Węzły ♪ (dźwięk)** nie są tekstem na ekranie:
   - „Techno…” w sc. 0 to stacja startowa TECHNO;
   - „Radio ścisza się samo” obsługuje polecenie `pasazer`;
   - „Radio gra do końca utworu” w zakończeniach: radio gra dalej na ekranie końcowym i powoli cichnie.
5. **Stawka 0** („nie stawiam”) jest przy każdym zakładzie, także na siebie (plan §4: stawki 0/10/20/50). Przejazd gracza odbywa się zawsze.
6. **Dola od Jurka** jest tylko w poleceniu `⚙ kasa +10` ze scenariusza. `przejazd` jej nie dolicza, żeby nie liczyć dwa razy.
7. **Wypłata:**
   - wygrana = zaokrąglone (stawka × kurs), zysk = wygrana − stawka;
   - przegrana = −stawka;
   - stawka nie znika z kasy przy obstawianiu, tylko przy rozliczeniu. Na tablicy widać ją jako „u trzymającego”.
8. **Przejazd NPC:**
   - każdy słupek to osobne losowanie z `q_ukryte`;
   - animacja jest dopasowana do wyniku: przy nieczystym wejściu auto prostuje się albo wyjeżdża za szeroko, a słupek błyska na czerwono;
   - wynik jest znany przed animacją, ale gracz widzi go dopiero słupek po słupku.
9. **Scenka FELGA_BICIE:** opis się nie wyświetla, a plan §10 wymienia czytelność bicia jako ryzyko. Dlatego:
   - kamera najeżdża na kurnik;
   - felga toczy się z wyraźnym bujaniem;
   - na ekranie pojawia się tekst techniczny „(Czwarta felga toczy się krzywo.)”.

   Tego tekstu nie ma w scenariuszu: jest w inscenizacji jako propozycja do akceptacji scenarzysty.
10. **Kamil w sc. 7 idzie do furtki**, a bohater zostaje w aucie (nie chodzimy postacią). Kamil wysiada na czas sceny i wraca przed odjazdem.
11. **Odbiorca** pojawia się pod lampą przy skoku do 04:05 (opis: „I wtedy widzisz go pod lampą”).
12. **Paliwo:**
    - start „na rezerwie” (3 l);
    - tankowanie +7,15 l;
    - spalanie liczone od przejechanej drogi, przeskalowane tak, żeby cała trasa nocy zjadła ok. 6,7 l (plan: 70 km × 9,5 l/100 km);
    - pusty bak nie istnieje w MVP (dno 0,4 l).
13. **Zapis nocy:**
    - na początku każdej sceny gra zapisuje stan: scena, flagi, kasa, zegar, radio, ładunek, pasażer, paliwo, miejsce auta;
    - „Kontynuuj” zaczyna od początku zapisanej sceny.
14. **Kursy** liczy gra ze wzoru (§4) i porównuje z `dane-mvp.json → zaklady.przejazdy[].kurs`; test pilnuje, żeby się zgadzały.
15. **Zegar i godziny ze scenariusza:**
    - tekst techniczny z godziną („Park · 23:35”, „00:06”) ustawia zegar;
    - zegar idzie między nimi, ale zatrzymuje się minutę przed następną godziną ze scenariusza, żeby nigdy nie cofać czasu.
16. **Świt (sc. 11):**
    - od 06:04 do 06:40 niebo i mgła przechodzą z czerni w szaroniebieski, latarnie świecą dalej;
    - o 06:12 wjeżdża poranna zmiana (Henio, Zdzichu z busem, Jurek), a znikają kombi, BMW i rolkarze.

Nic z tego nie blokuje całości. Pytania do autora i scenarzysty są w raporcie po wdrożeniu.

## 6. Wyniki (v0.7)

- **Słupki:**
  - odstęp 22 m, 10 m od linii startu do pierwszego słupka, trasa środkiem Parku z północy na południe; wybieg przez południowy wjazd;
  - autopilot na prawdziwym aucie (preset Normalny, 60 prób na poziom): dobry 100%, średni 58%, słaby 3% prób z ≥ 4/6 czystych;
  - dobry: średnio 5,9 czystych, średni 3,7, słaby 0,7.
- **Cała noc na grze** (`scripts/e2e-noc.cjs`): wszystkie 4 zakończenia, kasa przed świtem i na koniec równa macierzy plan §5; do tego noc z zakładem na beemkę i na busa.
- **Czas przejścia** (`node test/czas.mjs`):
  - ok. 27–29 min sprawnej jazdy, w tym tekst czytany tempem gry, dojazdy ok. 7,5 min i swobodna jazda na Parku 3–4 min;
  - cel planu to 45–60 min;
  - różnicę robią skrócone trasy (w grze ok. 6,8 km zamiast 70 km) i to, że tekst czyta się szybciej, niż zakładał plan.
  - Pokrętła bez zmiany scenariusza: dłuższa wylotówka, dłuższa swobodna jazda w sc. 0, wolniejsze tempo pasków, dłuższe czekanie w sc. 6 (plan §10.2 mówi raczej o skracaniu).

## 7. Beemka i bus: fizyka NPC (v0.8 cz. 1)

- Do v0.7 przejazd BMW/busa był animacją po zapisanej krzywej (`slupki.js` `npcPath`). Od v0.8 to prawdziwe auto:
  `createVehicle()` (ten sam kod co gracz) na profilu `src/cars/bmw-e34.json` / `vw-t3.json`, kierowca to
  `src/npcAutopilot.js` (ten sam moduł, który steruje testowym autopilotem – `test/autopilot.mjs` go tylko wywołuje,
  nie duplikuje logiki).
- **Kasa nie zależy od tego, jak fizycznie pójdzie ten konkretny przejazd.** Silnik fabuły (`silnik.js` `losujSlupki`)
  losuje, które słupki są czyste, PRZED przejazdem (jak w v0.7); `gra.js` `rozlicz()` liczy wypłatę z tej tablicy
  (`a.slupki`), nie z tego, co pokaże `act.run` na żywo. `forced` w `npcAutopilot.js` tylko naprowadza fizyczny
  przejazd, żeby plansza z werdyktami na ekranie nie sprzeciwiała się wypłacie – to kosmetyka, nie coś od czego
  zależy wynik finansowy (stąd testy 7488 ścieżek i macierzy §5 – bez zmian, wciąż przechodzą).
  - "brudny" słupek (`forced[k] === false`) jest w 100% pewny: kierowca po prostu nie ciągnie ręcznego (brak poślizgu
    = niecozyste, zmierzone: 60/60 w teście).
  - "czysty" słupek (`forced[k] === true`) pożycza technikę `dobry`/niższy szum (`GWARANT` w `npcAutopilot.js`), ale
    NIE jest gwarantowany – sam manewr (poślizg tuż przy słupku, tolerancja dotyku 0,1 m) jest z natury wrażliwy na
    warunki wejścia, więc dokładność zależy od wzorca: pierwsze 3–4 słupki z rzędu wymuszone na "czyste" trafiają w
    ok. 80–100% (zmierzone), wymuszanie "czyste" tuż po wymuszonym "brudnym" słupku bywa dużo mniej trafne (kierowca
    wchodzi w kolejny wymuszony poślizg z gorszej pozycji). Ponieważ nie wpływa to na kasę, jest to zaakceptowana
    niedoróbka kosmetyczna, nie błąd do naprawy w tym samym kroku – patrz RAPORT v0.8.
- Model auta: `car.js` `fitPolonez()` (teraz ogólniejsza `fitCar`, ta sama funkcja dla Poloneza, E34 i T3) szuka kości
  kółek po nazwie (`F_wheel.L`, jak w Polonezie) LUB, gdy model nie ma szkieletu (T3: `WFL/WFR/WBL/WBR` to zwykłe
  węzły), po dokładnej nazwie węzła – tak działa obrót/skręt kółek E34 (ma szkielet, nazwy zgodne z konwencją
  Poloneza), ale kółka busa T3 stoją w miejscu (brak szkieletu, więc nie ma czego kręcić przez kość, kółka są
  częścią jednej siatki). T3 nie ma też materiału `Headlight` (jeden materiał na cały model), więc `fitCar()` zakłada
  przód na +Z (domyślne zachowanie, jak dotąd) – bez podglądu w przeglądarce w tej sesji nie da się potwierdzić, czy
  to właściwa strona; da się to poprawić bez zmian w kodzie przez `look.frontYawDeg` w `vw-t3.json` (dodane do
  `fitCar()` właśnie w tym celu), patrz RAPORT.

## 8. Ludzie: chodzenie i yuka (v0.8 cz. 2)

- **Diagnoza lewitowania:** `src/npc.js` `animate()` kołysało tylko ciałem i rękami; nogi (jedna sztywna kość na nogę)
  nigdy się nie ruszały, więc przy każdym ruchu (rolkarze, Zbychu idący do mety) figura ślizgała się po ziemi zamiast
  chodzić.
- **Gotowiec:** szukałem rigowanego modelu CC0 ze stanami idle/walk (kenney.nl, quaternius.com – 403, jak zdjęcia
  referencyjne; modele z `three.js/examples/models/gltf` są technicznie dostępne, ale to zasoby Mixamo bez jasnej
  licencji CC0/CC-BY dla użycia w publicznym repo – ryzyko na `CREDITS.md`). Nie znalazłem bezpiecznie
  licencjonowanego riga w zasięgu tej sesji (docs/gotowce.md), więc **naprawiam figurę z kodu**, zgodnie z poleceniem
  („jeśli nie znajdziesz modelu z animacjami, napraw figurę z kodu”).
- **Naprawa:** noga to teraz dwa segmenty (`thigh` na biodrze, `shin` na kolanie, każdy własna grupa/obrót) zamiast
  jednej sztywnej kości; `animate()` liczy prędkość NPC z różnicy pozycji między klatkami (`n.speed`, bez zmiany API
  wywołań `people.place()`) i przy ruchu miesza biodro (wahadło) z kolanem (zgięcie w fazie unoszenia nogi); amplituda
  spada do 0 w bezruchu, więc nie kłóci się z wcześniejszym kołysaniem stojąc. Kamil siedzący w aucie: `thigh`/`shin`
  ustawione ręcznie na pozę siedzącą (dawne `leg.rotation.x` rozdzielone na oba stawy).
- **Ruch przez yuka** (`EntityManager`, `Vehicle`, `FollowPathBehavior`, `Path`): rolkarze na torze zamiast ręcznej
  matematyki okręgu – ta sama geometria (promień i prędkość z `krazy` w `mapa.json`), ale krok liczy `FollowPathBehavior`
  po zamkniętej ścieżce z 16 punktów; kierunek figury liczony z wektora prędkości pojazdu yuki, nie z parametru kąta.
  Inni (Zbychu idący do mety, stojący) zostają na `people.place()` bez zmian – to jednorazowe skoki pozycji, nie pętla
  ruchu, więc yuka nie dodaje tu nic ponad to, co jest.
- **Nie sprawdzone wizualnie w tej sesji** (brak przeglądarki z ekranem): tempo chodu, czy amplituda biodra/kolana
  wygląda naturalnie, czy figura Kamila w aucie nie przenika przez siedzenie. Sprawdzone tylko przez odpytanie stanu
  (`agro.swiat.people.list`) w headless Chromium: rolkarz trzyma się swojej ścieżki, prędkość policzona z ruchu jest
  dodatnia, kąt nogi się zmienia razem z prędkością, bez błędów w konsoli. Prędkość ruchu (i całego zegara fabuły) w
  tym headless Chromium bywa bardzo nierówna (`dt` na klatkę ograniczone do 0,1 s w `main.js`, a klatek na s bywa 1–3
  przy takim obciążeniu) – to własność silnika z wcześniejszych wersji, nie regresja z tej części.

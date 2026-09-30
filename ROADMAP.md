# Roadmapa – Polish Drifter

Wersje po kolei. Szczegóły modułów: [`CLAUDE.md`](CLAUDE.md), zmiany w każdej wersji: [`CHANGELOG.md`](CHANGELOG.md).

| Wersja | Zakres | Stan |
|---|---|---|
| v0.1 | jazda | zrobione |
| v0.1.5 | Rapier + model opon (RaycastVehicle) | zastąpione przez v0.2a |
| v0.2a | fizyka arcade: kula Kenneya + drift na wierzchu, nowa kamera | zrobione |
| v0.2b | noc + PS1 + assety + dźwięk + HUD | zrobione |
| v0.2c | poprawki jazdy: płynny kąt, power oversteer w Pro, bez odbić, bez utykania | zrobione |
| v0.2d | kamera Diorama + pixel-art (toon, obrysy, mgła radialna) | zrobione |
| v0.2e | Polonez (koła na kościach) + osiedle z City Kit / Car Kit | zrobione |
| v0.3a | profile aut (JSON), kontra (wizualna; w Pro prawdziwa) | zrobione |
| v0.3b | ręczna mapa osiedla w pliku danych, kolizje z geometrii | zrobione |
| v0.3c | bateria, sklep = punkt zapisu, narrator, misja 1 „Paczka” | zrobione |
| v0.3d | sterowanie mobilne – **wersja testowa** (dotyk: joystick nipplejs + przyciski, pełny ekran/poziom, niższa jakość, FPS, pauza w tle) | zrobione |
| v0.4a | trudniejsza jazda (preset Normalny, pęd, obrót, zarzucenie) i bateria (60–90 s bez driftu, seria czystego driftu) | zrobione |
| v0.4b | kamera niżej i w bok, piksele wg rozdzielczości, zegary z bloku wschodniego, menu (główne, garaż, ustawienia, pauza) | zrobione |
| v0.4c | logiczne osiedle z wielkiej płyty (plan w docs/mapa.md) | zrobione |
| v0.5a | szybkie poprawki: skalowanie obrazu, piksele, pisk przy cofaniu, jeden obrót, garaż z przeciąganiem, narrator z maszyną do pisania | zrobione |
| v0.5b | MVP: postacie, rozmowy z wyborami, misja 2 „Pokaz”, misja 3 „Wyścig z sąsiadem”, kolejność misji i zapis | zrobione |
| v0.5c | prawdziwe osiedle: bloki z wielkiej płyty z kodu, ulice w pętlach, podwórka, podłoże jako pikselowa tekstura | zrobione |
| v0.6a | wszystko bez klawiatury: telefon i pad (panel wyboru, podsumowanie z przyciskami) | zrobione |
| v0.6b | drift: strefa balansu (stopniowy kąt, ostrzeżenie, obrót dopiero po błędzie) | zrobione |
| v0.6c | napęd z realnych danych (Polonez Caro 1.6 GLE, silniki pod swapy, lakiery FSO), docs/fizyka-aut.md | zrobione |
| v0.6d | paliwo, kasa, szacun zamiast baterii; stacja „Kometa”, Żappka ze sklepem, warunki w rozmowach | zrobione |
| v0.6e | 5G jako klimat przy masztach | zrobione |
| v0.6f | nowa nazwa: Polish Drifter | zrobione |
| — | sesja porządkowa: referencje (`docs/referencje/`), braki (`docs/BRAKI.md`), podział na sesje S2–S5 | zrobione |
| v0.7 | **fabuła MVP „W nocy robota” wdrożona** (docs/fabula/, docs/wdrozenie-fabuly.md): silnik fabuły, 12 scen, zakłady na 6 słupkach, 4 zakończenia, greybox mapy (Park, miasto, wylotówka, wieś) | zrobione |
| v0.8 | **poprawki po pierwszym teście fabuły i wymiana na gotowce wdrożone** (docs/wdrozenie-fabuly.md §7–14, docs/gotowce.md): beemka/bus na fizyce Poloneza, chodzenie i ruch pieszych (yuka), rozmowy filmowe i font pikselowy, wylotówka z zakrętami, Park według zdjęć (ściany z opon), pełnoekranowa mapa (M), filtr radiowy (Tone.js), Golf II/Fiat 126p na ulicach | zrobione |
| v0.9 | **domknięcie v0.8 bez podglądu wizualnego** (raport v0.8): sprawdzić na oko zbliżenie kamery na rozmowie, pasy (letterbox), tor beemki i stabilność ściany opon, ustawienie Golfa/Fiata w liniach parkingowych, dźwięk radia (filtr Tone.js); dopiąć: obrysy budynków miasta na mapie, opcjonalna minimapa w rogu, `InstancedMesh` dla aut z epoki (albo kolejne uproszczenie), warianty drzwi Golfa, dokładniejsza kalibracja E34 (obecnie rząd wielkości, nie zgodność z katalogiem – test/e34.test.mjs); dopracowanie mechanik po teście (próg 4/6, czytelność kursów, długość nocy do 45–60 min, czekanie w sc. 6, jazda z ładunkiem) | planowane |
| v0.10 | muzyka: 12 pastiszy na 4 stacje (docs/muzyka.md), dźwięk Poloneza | planowane |
| później | większa mapa (S4), trasa nad wodą („Pralka. Nad wodę.”), garaż i tuning, kolejne noce | planowane |
| v0.15 | dopracowanie sterowania mobilnego (po testach na telefonach) | planowane |

## Sesje S2–S5 (plan sprzed fabuły; kolejność po v0.7 jest w tabeli)

Co jest potrzebne do każdej sesji (zdjęcia, modele, dźwięki): [`docs/BRAKI.md`](docs/BRAKI.md).

- **S2 – v0.7: jazda, dźwięk, orientacja.**
  - Jazda: dopracowanie po testach (drift, strefa balansu, napęd).
  - Ekonomia (decyzje z rozmowy po v0.6):
    - kasa za drift w wolnej jeździe tylko przy ludziach (chłopaki „rzucają drobne”), ok. 1/3 stawki z misji; drift w pustym miejscu daje 0 zł;
    - tankowanie „na zeszyt” u pana ze stacji: limit −40 zł zostaje, a przy następnym tankowaniu najpierw spłacasz dług.
  - Dźwięk: silnik Poloneza, uderzenia wg materiału, ambient nocnego osiedla, radio (muzyka, szum strojenia; może zmieniać mgłę i przyczepność).
  - Orientacja: minimapa albo kompas, strzałka do celu, tabliczki z nazwami ulic, nazwy stref.
- **S3 – v0.8: polski świat.**
  - Paleta i światło według `docs/STYL.md` (ze zdjęć): latarnie sodowe, okna, szyldy.
  - Auta z epoki na parkingach, pawilony, kioski, garaże blaszaki, detale podwórek.
  - Postacie z modeli.
- **S4 – v0.9: większa mapa.**
  - Mapa według `docs/plan-mapy.md` (eksport OSM, drony, screeny): kilka osiedli, główne drogi, stacja, sklepy, garaże, plac do driftu.
  - Skrypt OSM → mapa.
- **S5 – fabuła.** Teksty docelowe od scenarzysty (`docs/teksty.md`), kolejne misje i rozmowy, rozwój postaci.
- **Później:**
  - trasa nad wodą jako osobna strefa;
  - garaż i tuning (UI swapów silników z `src/engines/`, lakiery);
  - uszkodzenia;
  - v0.15 – sterowanie mobilne po testach.

## Sterowanie mobilne

- **Teraz (v0.3d, wersja testowa):** wykrywanie urządzenia dotykowego po możliwościach (`pointer: coarse` albo dotyk bez hover),
  joystick skrętu (nipplejs) lub przyciski ←/→, przyciski gaz / hamulec-wsteczny / ręczny (kilka palców naraz), pełny ekran
  z próbą blokady poziomu (Android), plansza „Obróć telefon” w pionie (iPhone), automatycznie niższa jakość (większy piksel,
  bez bloomu, połowa świateł latarni), licznik FPS w panelu, HUD i narrator pod mały ekran, pauza po przejściu aplikacji w tło.
- **v0.15 – dopracowanie:** rozmiary i układ przycisków po testach na prawdziwych telefonach, czułość joysticka, wibracje,
  ustawienia jakości dobrane po zmierzonym FPS, obsługa notcha i gestów systemowych.

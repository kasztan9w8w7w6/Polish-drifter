# Changelog – Agro Drifter

Każda wersja ma tag w git (`git checkout v0.4a` uruchamia dokładnie tę wersję). Plan dalszych wersji: [`ROADMAP.md`](ROADMAP.md).

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

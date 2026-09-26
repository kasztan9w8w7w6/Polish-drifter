# Roadmapa – Agro Drifter

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
| v0.4b | kamera niżej i w bok, piksele wg rozdzielczości, zegary z bloku wschodniego, menu (główne, garaż, ustawienia, pauza) | w toku |
| v0.4c | logiczne osiedle z wielkiej płyty (plan w docs/mapa.md) | w toku |
| v0.4 | MVP | następne |
| v0.15 | dopracowanie sterowania mobilnego (po testach na telefonach) | planowane |

## Sterowanie mobilne

- **Teraz (v0.3d, wersja testowa):** wykrywanie urządzenia dotykowego po możliwościach (`pointer: coarse` albo dotyk bez hover),
  joystick skrętu (nipplejs) lub przyciski ←/→, przyciski gaz / hamulec-wsteczny / ręczny (kilka palców naraz), pełny ekran
  z próbą blokady poziomu (Android), plansza „Obróć telefon” w pionie (iPhone), automatycznie niższa jakość (większy piksel,
  bez bloomu, połowa świateł latarni), licznik FPS w panelu, HUD i narrator pod mały ekran, pauza po przejściu aplikacji w tło.
- **v0.15 – dopracowanie:** rozmiary i układ przycisków po testach na prawdziwych telefonach, czułość joysticka, wibracje,
  ustawienia jakości dobrane po zmierzonym FPS, obsługa notcha i gestów systemowych.

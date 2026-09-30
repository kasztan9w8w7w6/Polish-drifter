# AUDYT 2 — SPRZECZNOŚCI I BRAKI (po zakładach, cenach i Wiedźminie)

29.09.2026, wieczór | Zastępuje audyt-spojnosci.md (archiwum).
Każda pozycja: co było sprzeczne albo brakowało → jak rozwiązane → gdzie.

---

## A. SPRZECZNOŚCI USUNIĘTE

| # | Sprzeczność | Rozwiązanie | Gdzie |
|---|---|---|---|
| 1 | **Przegląd za 800 zł** — nierealne; samo badanie techniczne kosztuje 149 zł. | Kwota rozpisana na „kartkę od Zbycha”: badanie 149 + łata na próg 300 + tarcze i klocki 170 + tłumik 120 + robota 150 = **889 zł**. Pokazana w pozycjach na ekranie. | plan §3, sc. 0 |
| 2 | Stawka Mirka 400 zł za 40 km — za dużo jak na realia. | **200 zł** („W dzień stówa. Kurs nocy jest inny.”). | sc. 1, plan §3 |
| 3 | Paliwo 60 zł „do pełna” — do pełna Poloneza to kilkaset złotych. | **50 zł, 7,15 l** przy 6,99 zł/l; na trasę 70 km wystarcza na styk. | sc. 3, plan §3 |
| 4 | **Drift — „sens gry”** według autora, a w MVP tylko „smaczek”. | Drift na zakłady wraca jako rdzeń: nocą zakład na cudzy przejazd, o świcie na cudzy i swój. | sc. 0, sc. 11, plan §4 |
| 5 | **Park: „nikt nikogo nie zna”** kontra zakłady, które wymagają ludzi. | Zakłady robią obcy; ktoś tylko „trzyma kasę”. Brak klubu, bossa, hierarchii. | projekt §1, sc. 0, sc. 11 |
| 6 | **Zasada 5 („nikt nie udaje, że wie”)** kontra bukmacher ustalający kursy. | Kursy „na oko” i tak nazywane; Henio: „Ja nie wiem, czy umiesz. Ja stawiam, że nie. To co innego.” | sc. 0, sc. 11, biblia XIV |
| 7 | Karty zadań: „Nikt nie podchodzi” (sc. 0), a teraz jest rozmowa przy kombi. | Nikt nie podchodzi do gracza — to gracz może podjechać do kombi (flaga ze strefy w świecie). | sc. 0, plan §6 |
| 8 | Poprzednia drabinka: prawda **zawsze** przegrywa, bo limit driftu 60 zł. | Każda ścieżka da się domknąć, ale uczciwość i hojność wymagają pełnej stawki (50 zł) na siebie. Zasada: „kłamstwo jest tańsze, prawda kosztuje ryzyko”. | plan §5 |
| 9 | 3 zakończenia, a oś „prawda × uzbierane” daje 4 pola. | Dodane zakończenie 4 **„Czysto”**. | sc. zakończenia, plan §5 |
| 10 | Refren Kamila „Osiemset” po zmianie kwoty nie pasuje. | „**Osiemset osiemdziesiąt dziewięć.**” Kamil trafia w liczbę z kartki co do złotówki — bo ją widział. | sc. 5, sc. 10 |
| 11 | Tytuł roboczy „Osiemset” stracił sens. | Zatwierdzone: **„W nocy robota”**. | projekt, plan §1 |
| 12 | „Na koncie” kontra gotówka w zakładach. | Jedna pula „**Kasa**”. | cały scenariusz |
| 13 | Biblia XII: „refreny 3 razy albo wcale”, a sygnatury padają 2×. | Reguła: **2–3 razy albo wcale**. | biblia XII |
| 14 | Biblia nadal odwoływała się do „800 zł” i „Wychodzi osiemset”. | Poprawione na 889. | biblia IX, XI |
| 15 | Nazwy poleceń gry raz z polskimi znakami, raz bez. | Wszystkie polecenia ⚙ bez polskich znaków (`zaklad`, `tlum`, `ladunek`…). | scenariusz, plan §8a |
| 16 | Gra nie wiedziała, kiedy Mirek dzwoni, a kiedy pisze. | Polecenie `⚙ telefon ROZMOWA / SMS`. | scenariusz |
| 17 | Czas gry po dodaniu zakładów: 65 min (poza widełkami). | Przycięte sceny 1, 4, 5, 6, 8 → **60 min**. | plan §2 |

## B. BRAKI UZUPEŁNIONE

| # | Brak | Uzupełnienie |
|---|---|---|
| 1 | Mechanika kursów | Wzór, mnożnik noc/rano, tabele kursów, stawki, „tłum obstawia ciebie”, dola od Jurka. (plan §4) |
| 2 | Aforyzmy jako źródło trendu | Algorytm + lista sygnatur i pojedynczych, zasada dozowania. (biblia XIV) |
| 3 | Wiedźmin jako referencja | 10 przykładów z budową i mechanizmem, co bierzemy / czego nie. (biblia XIII) |
| 4 | Aforyzmy autora | „Kurs nocy jest inny.” (termos + Mirek, odwrócone przez Henia), „W nocy robota dla kurwy i kota.” (Mirek + echo Kamila „Ja chyba kot.”). |
| 5 | Lata 90./00. w pieniądzach | „Dycha. Kiedyś to było sto tysięcy.” (denominacja 1995), kartka na paragonie, gumka recepturka, slang dych i stówek. |
| 6 | Nowe postacie epizodyczne | Facet z termosem, Henio, Zdzichu, Jurek, Zbychu (wspominany). (plan §7) |
| 7 | Dane dla gry | `dane-mvp.json` generowany ze scenariusza + walidacja + symulacja wszystkich ścieżek (`generuj_dane.py`). |

## C. WYNIK KONTROLI AUTOMATYCZNEJ

- Parser: **0 błędów, 0 ostrzeżeń** (flagi zdefiniowane, warunki poprawne, polecenia znane, żadna kwestia > 14 słów).
- Symulacja: **7488 ścieżek** (każda kombinacja decyzji, zakładów i wyników). Kasa końcowa 659–1033 zł, nigdy ujemna. Wszystkie 4 zakończenia osiągalne.
- Macierz bazowa zgadza się z planem §5 (849/829/799/779 zł przed świtem; minimalne stawki 20/50/50/50).
- Brak starych kwot (800, 420, 400, 60) w aktywnych plikach.

## D. ŚWIADOMIE ZOSTAWIONE (nie są sprzecznościami)

- „Ty byś stąd wyjechał?” bez wyboru — otwarcie na pełną grę.
- Gracz może stracić kasę już w sc. 0 — zamierzone, do obserwacji w teście.
- Kursy NPC różnią się od prawdziwych szans — to celowa lekcja („kurs to opinia”).

## E. DECYZJE AUTORA (otwarte)

1. Tytuł — zatwierdzony: „W nocy robota”.
2. „Kotem to ty nie jesteś.” — zostaje czy za mocne.
3. Poziom przekleństw (4 użycia, w tym 2× w przysłowiu).

# GRA SAMOCHODOWA — DOKUMENT PROJEKTU

Stan na: 29.09.2026, wieczór | Wersja 3 | Tytuł MVP: **„W nocy robota”**

**Pliki (aktualne):**
- `projekt-gra-fabula.md` — ten plik, master
- `scenariusz-mvp.md` — scenariusz (źródło prawdy dla dialogów)
- `plan-mvp.md` — sceny, ekonomia, zakłady, drabinka, mechaniki
- `biblia-stylu.md` — ton, humor, aforyzmy, referencje (wersja 5)
- `dane-mvp.json` — dane dla gry, generowane ze scenariusza skryptem `generuj_dane.py`
- `audyt-2.md` — co było sprzeczne i jak rozwiązane
- `archiwum/` — poprzednie wersje, nie edytować

---

## 1. FUNDAMENT

**Czas akcji:** dziś, początek października. Lata 90./00. tylko jako **ślady w teraźniejszości**: stare auta z wyboru (Polonez, beemka e34), starsi ludzie działający starymi metodami (kartka na paragonie, gotówka pod gumką, „sto tysięcy” zamiast dychy), szyldy na szyldach.

**Miejsce:** fikcyjne, bezimienne średnie miasto na Pomorzu Zachodnim, oparte na układzie Goleniowa. Mówi się: „do miasta”, „na wioskę”, „na Park”.

**Park:** nocą pusty asfalt działającego parku przemysłowego, przy zbiornikach, gdzie stoją tiry. Każdy robi tam co innego i nikt nikogo nie zna. Zakłady na drift robią **obcy ludzie**, bez klubu i hierarchii — ktoś akurat „trzyma kasę”. Rano Park wraca do pracy (poranna zmiana).

**Bohater:** ok. 20 lat, bez imienia i głosu, mówi tylko wyborami. „Czy chce wyjechać” — celowo nierozstrzygnięte.

**Auto:** Polonez Caro (tył, tani, da się nim upalać). Oś postępu po MVP: naprawa → tuning → wymiana.

---

## 2. POMYSŁ W JEDNYM ZDANIU

> Jedna noc, jedno zlecenie, które ma opłacić przegląd — i które rozpada się nie przez wrogów, tylko przez ludzi, paliwo i to, że nikt nie odbiera telefonu; a o świcie zostaje już tylko postawić na siebie.

## 3. ZAKOŃCZENIE MVP

Świt na Parku. Kasy brakuje. Poranna zmiana robi zakłady na drift: można obstawić cudzy przejazd i swój. Cztery zakończenia wg dwóch osi — **prawda wobec Mirka** i **czy uzbierane 889 zł**:
- **Na styk** — zmilczał, uzbierał; Mirek się dowiaduje i znika.
- **Prawie** — zmilczał, nie uzbierał.
- **Jutro** — powiedział, nie uzbierał; Mirek dzwoni z nową robotą („Pralka. Nad wodę.”).
- **Czysto** — powiedział i uzbierał; najtrudniejsze.

Zasada: **kłamstwo jest tańsze, prawda kosztuje ryzyko.**

---

## 4. ELEMENTY NOCY

| Element | Ustalenie |
|---|---|
| Cel | **889 zł** — kartka od Zbycha (badanie 149 · łata na próg 300 · tarcze i klocki 170 · tłumik 120 · robota 150). Termin 21 dni. |
| Kasa na starcie | 699 zł |
| Zleceniodawca | **Mirek**, ok. 45, handlarz. **200 zł** („W dzień stówa. Kurs nocy jest inny.”), BLIK po robocie. |
| Paliwo | **50 zł** na Orlenie (Pb95 ok. 6,99 zł/l → 7,15 l) |
| Ładunek | 4 felgi 16" z zimówkami, czwarta na tylnej kanapie, zapięta pasem, zasłania lusterko |
| Pasażer | **Kamil Ślimak** (nazwisko), ok. 20, jedzie „za piwo” |
| Odbiorca | nie odbiera, pojawia się po ok. 2,5 h czekania |
| Decyzje | D0 zakład nocny · D1 odpowiedź Kamilowi · D2 prawda o feldze (−50 zł) · D3 piwo (−20 zł) · D4 zakłady i przejazd o świcie |
| Rdzeń | **Drift na zakłady** z kursami; noc = kurs ×1,2, rano ×1,0 |

---

## 5. ZASADY, KTÓRYCH PILNUJEMY

- **Bez zagadki.** Gracz wie od początku, o co gra.
- **Bez tajemniczego zleceniodawcy.**
- **Zasada 5 — nikt nie udaje, że wie.** Zgadywanie otwarte, dosłowne. Przysłowie = pożyczona pewność, dozwolone.
- **Aforyzmy budują trend** (biblia XIV): każda postać drugoplanowa ma 1–2; sygnatury MVP: „Kurs nocy jest inny.”, „W nocy robota dla kurwy i kota.”, „Osiemset osiemdziesiąt dziewięć.”
- **Pieniądze są prawdziwe.** Ceny z 2026 r., slang dych i stówek, jedna pula „Kasa”.
- **Brak narratora.** Narracja solo → telefon. Tekst na ekranie tylko techniczny.
- **Radio tylko z muzyką.** Techno (bohater), rap, disco polo, dad rock.
- **Humor z postaci.** Postać nie wie, że jest śmieszna.
- **MVP = jedna oś, drabinka decyzji.** Bez rozgałęzionych scen. Pełne rozgałęzienia (styl New Vegas) po MVP.
- **Drift za kasę to rdzeń gry.** W MVP: nocą zakład na cudzy przejazd, o świcie na cudzy i swój.
- **Nostalgia nie jest tematem.**
- **Nie cytujemy referencji. Nie odtwarzamy prawdziwych osób.**
- **Scenariusz czyta się jak książkę:** warstwa czytelnicza (nie trafia do gry) + warstwa gry.

---

## 6. MAPA NA MVP

1. **Park** — start i koniec, zakłady.
2. **Miasto (fragment)** — sygnalizacja, wiadukt, Żabka, podwórko Mirka, Orlen.
3. **Wylotówka** — las, łąki, dziury, przystanek w polu.
4. **Wioska** — podwórko z lampą, kurnik, dom z telewizorem.

Szczecin, zalew: **kierunek, w który nie da się jechać.** „Nad wodę” pada w zakończeniach 3 i 4 jako zapowiedź następnego obszaru.

---

## 7. REFERENCJE (mechanika, nie treść)

- **Budowa nocy:** *Po godzinach*, *Locke*, *Dzień świra* (jedna doba, litania, pętla).
- **Gatunek:** *Jalopy*.
- **Język i humor:** klasyki polskiego internetu, „Chłopaki z baraków” (lektor), **gry „Wiedźmin” (aforyzmy, barki, zderzenie rejestrów)**.
- **Wygląd:** reportaże Filipa Springera.

---

## 8. MATERIAŁ AUTORA (zbiórka trwa)

Notatka w telefonie: zdania dosłownie, nazwy miejsc spoza mapy, absurdalne sytuacje, **przysłowia i powiedzonka z okolicy** (do biblii XIV).
Zebrane: „amba fatima”, „było i nima”, **„w nocy robota dla kurwy i kota”** (w grze), „kurs nocy jest inny” (w grze). „Waha”, „heble” — tylko przykłady typu.

---

## 9. NASTĘPNY KROK

1. Autor czyta `scenariusz-mvp.md` i skreśla, co nie brzmi.
2. Wrzucenie `dane-mvp.json` do prototypu; stałe ekonomii i zakładów są w sekcji `ekonomia` i `zaklady`.
3. Muzyka — równolegle (12 pastiszów).
4. Test: próg 4/6 słupków, czytelność kursów, długość czekania.
5. Po teście: poprawki drobne, bez zmiany struktury.

# Muzyka do radia (plan-mvp §9)

Radio ma 4 stacje, bez spikerów, tylko muzyka:
- **TECHNO** – stacja bohatera: początek i koniec nocy, pętla;
- **RAP** – tło w mieście;
- **DISCO_POLO** – tło w mieście;
- **DAD_ROCK** – Kamil przełącza w sc. 6; tekst to litania rozwodnika o niedzielach.

Plan zakłada 4 stacje × 3 utwory ≈ 30 min, jako własne pastisze (biblia stylu VIII).

Dopóki utworów nie ma, każda stacja gra ciche tło generowane w kodzie (`src/fabula/radio.js`, Web Audio): rytm i jeden powtarzany motyw w stylu stacji.

## Jak podpiąć utwory (bez zmiany kodu)

1. Wrzuć pliki do `public/muzyka/`.
   - Najlepiej `.ogg`; może być `.mp3`.
   - Stereo, 44,1 kHz, głośność znormalizowana do ok. −14 LUFS, żeby stacje grały równo.
   - Na początku i końcu pliku nie zostawiaj ciszy.
2. Utwórz albo uzupełnij `public/muzyka/lista.json`:

```json
{
  "TECHNO": ["techno-cierpliwosc.ogg", "techno-2.ogg", "techno-3.ogg"],
  "RAP": ["rap-1.ogg"],
  "DISCO_POLO": ["disco-1.ogg", "disco-2.ogg"],
  "DAD_ROCK": ["dadrock-niedziele.ogg"]
}
```

**Jak to gra:**
- stacja z listą gra swoje utwory po kolei w pętli;
- stacja bez listy dalej gra tło z kodu;
- nazwy stacji muszą być dokładnie takie jak wyżej, bo tak przełącza je scenariusz (`⚙ radio DAD_ROCK`).

**Zachowanie w grze:**
- przy rozmowie w aucie (pasażer nie śpi) radio samo się ścisza, a pasażer, który zasnął, oddaje mu pełną głośność;
- gracz przełącza stacje klawiszem **Q**, przyciskiem **Back** na padzie albo **♪** na ekranie dotykowym;
- głośność i ściszenie są w lil-gui (G → „Fabuła”).

Każdy utwór dopisz do `CREDITS.md`: tytuł, autor, licencja.

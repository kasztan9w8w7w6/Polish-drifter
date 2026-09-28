#!/usr/bin/env python3
"""Porządkuje zdjęcia referencyjne w docs/referencje/ (narzędzie do dokumentacji, nie część gry).

- HEIC/HEIF → JPG (jakość 88), oryginał usuwany;
- JPG/PNG/WebP dłuższe niż --max px (domyślnie 2000) → zmniejszone w miejscu (PNG ze screenami map zostaje PNG);
- obrót według EXIF, metadane (w tym GPS) usuwane;
- --nazwy plik.json: {"stara/ścieżka.jpg": "nowa-nazwa.jpg"} → zmiana nazw w tym samym folderze (git mv, jeśli się da);
- --paleta: główne kolory każdego zdjęcia (HEX) do docs/STYL.md.

Wymaga: pip install pillow pillow-heif
Użycie: python3 scripts/referencje.py [--max 2000] [--nazwy nazwy.json] [--paleta] [folder]
"""
import argparse
import json
import pathlib
import subprocess

from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None

PHOTO = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}


def fix(path: pathlib.Path, limit: int) -> str | None:
    ext = path.suffix.lower()
    if ext in ('.heic', '.heif') and pillow_heif is None:
        return 'pominięty (brak pillow-heif)'
    img = Image.open(path)
    big = max(img.size) > limit
    heic = ext in ('.heic', '.heif')
    if not big and not heic:
        return None
    img = ImageOps.exif_transpose(img)
    if big:
        img.thumbnail((limit, limit), Image.LANCZOS)
    if heic or ext in ('.jpg', '.jpeg'):
        out = path.with_suffix('.jpg')
        img.convert('RGB').save(out, 'JPEG', quality=88, optimize=True)
    else:
        out = path
        img.save(out, optimize=True)
    if heic:
        path.unlink()
    return f'→ {out.name} {img.size[0]}×{img.size[1]}'


def rename(root: pathlib.Path, names: dict) -> None:
    for old, new in names.items():
        src = root / old
        dst = src.with_name(new)
        if not src.exists() or dst.exists():
            print('  pomijam', old)
            continue
        if subprocess.run(['git', 'mv', str(src), str(dst)], capture_output=True).returncode != 0:
            src.rename(dst)
        print(f'  {old} → {new}')


def palette(path: pathlib.Path, n: int = 6) -> list[str]:
    img = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    img.thumbnail((200, 200))
    q = img.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    return [('#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3])) + f' {c * 100 // (img.size[0] * img.size[1])}%' for c, i in counts]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('folder', nargs='?', default='docs/referencje')
    ap.add_argument('--max', type=int, default=2000)
    ap.add_argument('--nazwy')
    ap.add_argument('--paleta', action='store_true')
    a = ap.parse_args()
    root = pathlib.Path(a.folder)
    files = sorted(p for p in root.rglob('*') if p.suffix.lower() in PHOTO)
    for p in files:
        r = fix(p, a.max)
        if r:
            print(p.relative_to(root), r)
    if a.nazwy:
        rename(root, json.loads(pathlib.Path(a.nazwy).read_text()))
    if a.paleta:
        for p in sorted(q for q in root.rglob('*') if q.suffix.lower() in PHOTO):
            print(p.relative_to(root), ' '.join(palette(p)))


if __name__ == '__main__':
    main()

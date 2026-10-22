"""Slim the Fraunces variable fonts to what the site uses.

SOFT is pinned to 100 (the site always uses the soft terminals), weight is
limited to 200–800 and optical size to 16–144; WONK stays (cheap alternates).
Source files come from @fontsource-variable/fraunces (full axes, latin subset).

Usage: python3 scripts/build-fonts.py   (requires: pip install fonttools brotli)
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules' / '@fontsource-variable' / 'fraunces' / 'files'
OUT = ROOT / 'public' / 'fonts'

for src, dst in [
    ('fraunces-latin-full-normal.woff2', 'fraunces.woff2'),
    ('fraunces-latin-full-italic.woff2', 'fraunces-italic.woff2'),
]:
    font = TTFont(SRC / src)
    slim = instancer.instantiateVariableFont(font, {'SOFT': 100, 'wght': (200, 800), 'opsz': (16, 144)})
    slim.flavor = 'woff2'
    slim.save(OUT / dst)
    print(f'{dst}: {(SRC / src).stat().st_size // 1024} KB → {(OUT / dst).stat().st_size // 1024} KB')

"""Slim the Fraunces variable fonts to what the site uses.

SOFT stays a full axis (0–100): headlines go from sharp and tense to soft and
relaxed. Weight is limited to 250–900, optical size to 16–144, WONK is pinned off.
Source files come from @fontsource-variable/fraunces (full axes, latin subset).

Usage: python3 scripts/build-fonts.py   (requires: pip install fonttools brotli)
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / '1-lass-los' / 'node_modules' / '@fontsource-variable' / 'fraunces' / 'files'
OUT = ROOT / 'public' / 'fonts'

for src, dst in [
    ('fraunces-latin-full-normal.woff2', 'fraunces.woff2'),
    ('fraunces-latin-full-italic.woff2', 'fraunces-italic.woff2'),
]:
    font = TTFont(SRC / src)
    slim = instancer.instantiateVariableFont(font, {'WONK': 0, 'wght': (250, 900), 'opsz': (16, 144)})
    slim.flavor = 'woff2'
    slim.save(OUT / dst)
    print(f'{dst}: {(SRC / src).stat().st_size // 1024} KB → {(OUT / dst).stat().st_size // 1024} KB')

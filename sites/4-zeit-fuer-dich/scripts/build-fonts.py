"""Slim the Fraunces variable fonts to what the site uses.

Upright: SOFT stays a full axis (0–100) – headlines go from sharp and tense to soft and
relaxed – with weight 250–900 and the full optical size range (16–144), since it sets
everything from 20 px questions to the 200 px hero.
Italic: only used for the large display words, so its optical size is pinned at 96
(half the file). WONK is pinned off in both. Both are cut down to Latin-1 plus the
punctuation the German text uses.
Source files come from @fontsource-variable/fraunces (full axes, latin subset).

Usage: python3 scripts/build-fonts.py   (requires: pip install fonttools brotli)
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / '1-lass-los' / 'node_modules' / '@fontsource-variable' / 'fraunces' / 'files'
OUT = ROOT / 'public' / 'fonts'
TEXT = ''.join(chr(c) for c in [*range(0x20, 0x7F), *range(0xA0, 0x100)]) + '–—‘’‚“”„«»‹›•·…→€'

for src, dst, axes in [
    ('fraunces-latin-full-normal.woff2', 'fraunces.woff2', {'WONK': 0, 'wght': (250, 900), 'opsz': (16, 144)}),
    ('fraunces-latin-full-italic.woff2', 'fraunces-italic.woff2', {'WONK': 0, 'wght': (250, 900), 'opsz': 96}),
]:
    font = instancer.instantiateVariableFont(TTFont(SRC / src), axes)
    opts = subset.Options()
    opts.layout_features = ['kern', 'liga', 'calt', 'lnum', 'tnum', 'pnum', 'case', 'ccmp', 'locl', 'mark', 'mkmk']
    opts.flavor = 'woff2'
    sub = subset.Subsetter(opts)
    sub.populate(text=TEXT)
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(OUT / dst)
    print(f'{dst}: {(SRC / src).stat().st_size // 1024} KB → {(OUT / dst).stat().st_size // 1024} KB')

"""Build the stylised Kestenholz map (src/images/map-kestenholz.svg) from an
OpenStreetMap extract (data © OpenStreetMap contributors, ODbL).

Usage: python3 scripts/build-map.py path/to/extract.osm
The extract can be fetched with
  https://api.openstreetmap.org/api/0.6/map?bbox=7.7380,47.2755,7.7670,47.2915
"""

import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

LAT0, LON0 = 47.28346, 7.75228  # St. Peterstrasse 12
HOME_WAY = '233702755'
EXTENT_X, EXTENT_Y = 1250, 1050  # metres around the practice
K_LAT = 111_320.0
K_LON = K_LAT * math.cos(math.radians(LAT0))

ROAD_CLASS = {
    'motorway': 'r1', 'motorway_link': 'r1', 'trunk': 'r1', 'primary': 'r1',
    'secondary': 'r2', 'tertiary': 'r2',
    'residential': 'r3', 'unclassified': 'r3', 'living_street': 'r3', 'service': 'r3',
    'track': 'r4', 'path': 'r4', 'footway': 'r4', 'cycleway': 'r4', 'steps': 'r4', 'bridleway': 'r4',
}
LABELS = {'St. Peterstrasse': 'home', 'Gäustrasse': 'main', 'Wolfwilerstrasse': 'main', 'Mitteldorfstrasse': 'main'}


def project(lat, lon):
    return ((lon - LON0) * K_LON, -(lat - LAT0) * K_LAT)


def dp(points, tol):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    idx, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if d > dmax:
            idx, dmax = i, d
    if dmax > tol:
        return dp(points[: idx + 1], tol)[:-1] + dp(points[idx:], tol)
    return [points[0], points[-1]]


def dp_ring(points, tol):
    if len(points) < 5:
        return points
    half = len(points) // 2
    return dp(points[: half + 1], tol)[:-1] + dp(points[half:], tol)


def inside(points):
    return any(abs(x) <= EXTENT_X and abs(y) <= EXTENT_Y for x, y in points)


def path_d(points, closed=False):
    out = 'M' + ' '.join(f'{x:.0f} {y:.0f}' for x, y in points[:1])
    out += 'L' + ' '.join(f'{x:.0f} {y:.0f}' for x, y in points[1:])
    return out + ('Z' if closed else '')


def main(src):
    root = ET.parse(src).getroot()
    nodes = {n.get('id'): project(float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
    layers = {k: [] for k in ('forest', 'water', 'rail', 'r4', 'r3', 'r2', 'r1', 'build', 'home')}
    label_paths = {}

    for way in root.iter('way'):
        tags = {t.get('k'): t.get('v') for t in way.findall('tag')}
        pts = [nodes[nd.get('ref')] for nd in way.findall('nd') if nd.get('ref') in nodes]
        if len(pts) < 2 or not inside(pts):
            continue
        closed = pts[0] == pts[-1]
        if way.get('id') == HOME_WAY:
            layers['home'].append(path_d(pts, True))
            home_c = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            continue
        if 'building' in tags and closed:
            layers['build'].append(path_d(dp_ring(pts, 0.4), True))
        elif tags.get('highway') in ROAD_CLASS:
            cls = ROAD_CLASS[tags['highway']]
            simple = dp(pts, 1.2)
            layers[cls].append(path_d(simple))
            name = tags.get('name')
            if name in LABELS and cls in ('r2', 'r3'):
                length = sum(math.dist(a, b) for a, b in zip(simple, simple[1:]))
                if length > label_paths.get(name, (0, None))[0]:
                    label_paths[name] = (length, simple)
        elif 'waterway' in tags:
            layers['water'].append(path_d(dp(pts, 1.5)))
        elif tags.get('landuse') == 'forest' or tags.get('natural') == 'wood':
            if closed:
                layers['forest'].append(path_d(dp_ring(pts, 2), True))
        elif tags.get('railway') == 'rail':
            layers['rail'].append(path_d(dp(pts, 1.5)))

    svg = [
        f'<svg class="map" xmlns="http://www.w3.org/2000/svg" viewBox="{-EXTENT_X} {-EXTENT_Y} {EXTENT_X * 2} {EXTENT_Y * 2}" '
        'preserveAspectRatio="xMidYMid slice" aria-hidden="true">',
        '<defs>',
    ]
    for i, (name, (_, pts)) in enumerate(label_paths.items()):
        if pts[0][0] > pts[-1][0]:
            pts = pts[::-1]
        svg.append(f'<path id="map-label-{i}" d="{path_d(pts)}"/>')
    svg.append('</defs>')
    svg.append('<g class="map__layer" data-map-layer>')
    if layers['forest']:
        svg.append(f'<path class="m-forest" d="{"".join(layers["forest"])}"/>')
    for d in layers['water']:
        svg.append(f'<path class="m-water m-draw" pathLength="1" d="{d}"/>')
    for d in layers['rail']:
        svg.append(f'<path class="m-rail" d="{d}"/>')
    if layers['r4']:
        svg.append(f'<path class="m-road r4" d="{"".join(layers["r4"])}"/>')
    for cls in ('r3', 'r2', 'r1'):
        for d in layers[cls]:
            svg.append(f'<path class="m-road {cls} m-draw" pathLength="1" d="{d}"/>')
    svg.append(f'<path class="m-build" d="{"".join(layers["build"])}"/>')
    for i, name in enumerate(label_paths):
        offset = '50%'
        svg.append(
            f'<text class="m-street" dy="-6"><textPath href="#map-label-{i}" startOffset="{offset}" text-anchor="middle">{name}</textPath></text>'
        )
    svg.append(f'<path class="m-home" d="{"".join(layers["home"])}"/>')
    hx, hy = home_c
    svg.append(f'<g class="m-pin" transform="translate({hx:.0f} {hy:.0f})">')
    svg.append('<circle class="m-pin-ring" r="18"/><circle class="m-pin-ring" r="18"/><circle class="m-pin-dot" r="9"/>')
    svg.append('</g>')
    svg.append('</g></svg>')
    out = Path(__file__).resolve().parent.parent / 'src' / 'images' / 'map-kestenholz.svg'
    out.write_text('\n'.join(svg), encoding='utf-8')
    print(f'wrote {out} ({out.stat().st_size / 1024:.0f} KB)', {k: len(v) for k, v in layers.items()}, list(label_paths))


if __name__ == '__main__':
    main(sys.argv[1])

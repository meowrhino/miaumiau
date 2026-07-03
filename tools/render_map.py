#!/usr/bin/env python3
"""Renderiza public/data/park.tmj a un PNG — preview del mapa sin navegador.

Uso:  python3 tools/render_map.py [salida.png] [ancho_px]
      (por defecto: /tmp/park-render.png a 2144 px de ancho)

Carga tilesets de imagen (grass/stone/wall/water) y de colección (plants/
struct/deco → PNGs sueltos en public/img/cainos/obj/), pinta las capas de
tiles en orden y luego los objetos (props + estructuras) ordenados por y,
igual que hace el juego. Las capas ocultas (colision*) no se pintan.
"""
import json, sys, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/park-render.png'
OUT_W = int(sys.argv[2]) if len(sys.argv) > 2 else 2144

m = json.load(open(os.path.join(DATA, 'park.tmj')))
TW, TH = m['tilewidth'], m['tileheight']
W, H = m['width'], m['height']

# gid → (imagen recortada) para tilesets de imagen; gid → imagen para colecciones
tiles = {}
for ts in m['tilesets']:
    fg = ts['firstgid']
    if 'image' in ts:
        img = Image.open(os.path.normpath(os.path.join(DATA, ts['image']))).convert('RGBA')
        cols = img.width // TW
        count = ts.get('tilecount', cols * (img.height // TH))
        for i in range(count):
            sx, sy = (i % cols) * TW, (i // cols) * TH
            tiles[fg + i] = img.crop((sx, sy, sx + TW, sy + TH))
    else:
        for t in ts.get('tiles', []):
            p = os.path.normpath(os.path.join(DATA, t['image']))
            tiles[fg + t['id']] = Image.open(p).convert('RGBA')

canvas = Image.new('RGBA', (W * TW, H * TH), (58, 96, 62, 255))

for layer in m['layers']:
    if not layer.get('visible', True):
        continue
    if layer['type'] == 'tilelayer':
        data = layer['data']
        for idx, gid in enumerate(data):
            if not gid:
                continue
            t = tiles.get(gid)
            if t is None:
                continue
            x, y = (idx % W) * TW, (idx // W) * TH
            canvas.alpha_composite(t, (x, y))
    elif layer['type'] == 'objectgroup':
        # Tiled: los objetos-tile anclan en su esquina inferior-izquierda.
        objs = sorted(layer.get('objects', []), key=lambda o: o.get('y', 0))
        for o in objs:
            gid = o.get('gid')
            if not gid:
                continue
            t = tiles.get(gid)
            if t is None:
                continue
            w = int(o.get('width', t.width)) or t.width
            h = int(o.get('height', t.height)) or t.height
            img = t if (w == t.width and h == t.height) else t.resize((w, h), Image.NEAREST)
            canvas.alpha_composite(img, (int(o['x']), int(o['y']) - h))

if OUT_W and OUT_W < canvas.width:
    canvas = canvas.resize((OUT_W, int(canvas.height * OUT_W / canvas.width)), Image.LANCZOS)
canvas.convert('RGB').save(OUT)
print(f'guardado {OUT} ({canvas.width}x{canvas.height})')

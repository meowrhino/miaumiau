#!/usr/bin/env python3
"""Genera assets nuevos en estilo Cainos (derivados + hechos a mano, sin IA).

- tree_autumn_N.png : recolor ámbar/oro de los 3 árboles Cainos (conserva TODO
  el sombreado original del pack: solo se rota el tono de los verdes).
- bush_roses_N.png  : rosal = arbusto Cainos + rosas pixeladas encima.
- lamp_post.png     : farola de hierro con luz cálida, dibujada píxel a píxel
  (Cainos no trae farolas; imprescindible para el ambiente RO de noche).

Salida en assets-src/propuestas/ para revisar ANTES de meter nada al juego.
"""
import os, colorsys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBJ = os.path.join(ROOT, 'public', 'img', 'cainos', 'obj')
OUT = os.path.join(ROOT, 'assets-src', 'propuestas')
os.makedirs(OUT, exist_ok=True)


def shift_greens(img, hue_to, sat_mul=1.0, val_mul=1.0):
    """Rota el tono de los píxeles verdes hacia `hue_to` (0-1), conservando
    sombras y luces del sprite original."""
    im = img.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # verde Cainos: tono ~0.16-0.45 con saturación real
            if 0.14 <= h <= 0.48 and s > 0.15:
                nh = hue_to
                ns = min(1.0, s * sat_mul)
                nv = min(1.0, v * val_mul)
                nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return im


# ── 1) Árboles de otoño (recolor de los 3 árboles del pack) ─────────────────
for i in range(3):
    src = Image.open(os.path.join(OBJ, f'plant_{i}.png'))
    # ámbar/oro tipo Payon: tono 0.075 (naranja dorado), un pelín más saturado
    out = shift_greens(src, hue_to=0.075, sat_mul=1.15, val_mul=1.04)
    out.save(os.path.join(OUT, f'tree_autumn_{i}.png'))

# ── 2) Rosales (arbusto Cainos + rosas a mano) ──────────────────────────────
import random
rng = random.Random(7)
for i, bush in enumerate([3, 4, 5]):
    src = Image.open(os.path.join(OBJ, f'plant_{bush}.png')).convert('RGBA')
    # verde más profundo para que las rosas resalten
    im = shift_greens(src, hue_to=0.30, sat_mul=1.1, val_mul=0.92)
    px = im.load()
    # rosas: racimos de 2x2 con luz arriba-izquierda (rojo RO clásico)
    opaque = [(x, y) for y in range(1, im.height - 2) for x in range(1, im.width - 2)
              if px[x, y][3] > 200]
    rng.shuffle(opaque)
    placed = []
    for (x, y) in opaque:
        if len(placed) >= max(3, im.width // 7):
            break
        if any(abs(x - a) < 6 and abs(y - b) < 5 for a, b in placed):
            continue
        placed.append((x, y))
        DARK, MID, LITE = (122, 22, 38, 255), (196, 44, 66, 255), (240, 108, 128, 255)
        px[x, y] = LITE; px[x + 1, y] = MID
        px[x, y + 1] = MID; px[x + 1, y + 1] = DARK
    im.save(os.path.join(OUT, f'bush_roses_{i}.png'))

# ── 3) Farola (dibujada a mano, 32x64, estilo Cainos: outline oscuro,
#      3 tonos por material, luz cálida) ─────────────────────────────────────
W, H = 32, 64
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
px = im.load()

OUTL = (43, 34, 41, 255)          # outline morado-oscuro (como el pack)
IRON_D, IRON, IRON_L = (58, 52, 64, 255), (82, 76, 92, 255), (112, 106, 124, 255)
STONE_D, STONE, STONE_L = (106, 104, 96, 255), (140, 138, 128, 255), (168, 166, 154, 255)
GLOW_D, GLOW, GLOW_L = (214, 138, 44, 255), (244, 186, 74, 255), (255, 232, 150, 255)


def rect(x0, y0, x1, y1, c):
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            if 0 <= xx < W and 0 <= yy < H:
                px[xx, yy] = c


# base de piedra (dos escalones)
rect(10, 60, 21, 62, STONE); rect(10, 60, 21, 60, STONE_L); rect(10, 62, 21, 62, STONE_D)
rect(12, 56, 19, 59, STONE); rect(12, 56, 19, 56, STONE_L); rect(12, 59, 19, 59, STONE_D)
# poste de hierro con brillo lateral
rect(14, 26, 17, 55, IRON); rect(14, 26, 14, 55, IRON_L); rect(17, 26, 17, 55, IRON_D)
# anillo decorativo
rect(13, 40, 18, 41, IRON_D); rect(13, 40, 18, 40, IRON_L)
# brazo superior + gancho
rect(13, 24, 18, 25, IRON); rect(13, 24, 18, 24, IRON_L)
# linterna (caja) con cristal cálido
rect(11, 10, 20, 22, IRON_D)                     # marco
rect(12, 11, 19, 21, GLOW)                       # cristal
rect(12, 11, 19, 12, GLOW_L)                     # luz arriba
rect(12, 20, 19, 21, GLOW_D)                     # sombra abajo
rect(13, 13, 15, 15, GLOW_L)                     # destello
# barrotes de la linterna
for xx in (13, 15, 17):
    for yy in range(11, 22):
        if (yy % 4) == 0:
            continue
    rect(xx, 11, xx, 21, GLOW) if False else None
rect(15, 11, 15, 21, IRON_D)                     # barrote central
# tapa y remate
rect(10, 8, 21, 9, IRON); rect(10, 8, 21, 8, IRON_L)
rect(12, 6, 19, 7, IRON_D)
rect(14, 3, 17, 5, IRON); rect(15, 1, 16, 2, IRON_D)

# outline: contorno 1px alrededor de todo lo opaco
base = im.copy()
bp = base.load()
for y in range(H):
    for x in range(W):
        if bp[x, y][3] == 0:
            if any(0 <= x + dx < W and 0 <= y + dy < H and bp[x + dx, y + dy][3] > 0
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                px[x, y] = OUTL
im.save(os.path.join(OUT, 'lamp_post.png'))

# ── hoja de contacto para revisar de un vistazo ─────────────────────────────
names = ([f'tree_autumn_{i}.png' for i in range(3)] +
         [f'bush_roses_{i}.png' for i in range(3)] + ['lamp_post.png'] +
         ['../../public/img/cainos/obj/plant_0.png', '../../public/img/cainos/obj/plant_3.png'])
imgs = [Image.open(os.path.join(OUT, n)).convert('RGBA') for n in names]
SCALE = 2
pad = 12
w = sum(i.width * SCALE + pad for i in imgs) + pad
h = max(i.height * SCALE for i in imgs) + pad * 2
sheet = Image.new('RGBA', (w, h), (86, 118, 74, 255))
x = pad
for i in imgs:
    big = i.resize((i.width * SCALE, i.height * SCALE), Image.NEAREST)
    sheet.alpha_composite(big, (x, h - pad - big.height))
    x += big.width + pad
sheet.convert('RGB').save(os.path.join(OUT, '_hoja_contacto.png'))
print('propuestas en', OUT)

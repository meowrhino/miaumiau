#!/usr/bin/env python3
"""Fase A — batería de assets (derivados de Cainos + a mano, sin IA).

Genera:
- public/img/cainos/water.png  : 128x128 = 16 tiles. Fila 0 = los 4 de agua de
  siempre (mismos gids 447-450, nada se rompe). Filas 1-3 = ORILLA: bordes
  N/S/E/W, esquinas exteriores e interiores (labio de piedra + espuma).
- public/img/extra/extra.png   : tileset de imagen 32px = 4 setos (bloquean
  como muro en la capa construido_muros).
- public/img/extra/obj/        : objetos sueltos → farola, 6 estandartes (uno
  por zona, su color), pérgola, caseta de mercado (Moyano), árboles de otoño
  x3 y rosales x3 (promovidos desde assets-src/propuestas).
"""
import os, shutil, random, colorsys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAINOS = os.path.join(ROOT, 'public', 'img', 'cainos')
EXTRA = os.path.join(ROOT, 'public', 'img', 'extra')
EOBJ = os.path.join(EXTRA, 'obj')
PROP = os.path.join(ROOT, 'assets-src', 'propuestas')
os.makedirs(EOBJ, exist_ok=True)

rng = random.Random(11)


def new(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def outline(im, col=(43, 34, 41, 255)):
    """Contorno 1px alrededor de lo opaco (look Cainos)."""
    base = im.copy()
    bp, px = base.load(), im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            if bp[x, y][3] == 0 and any(
                0 <= x + dx < W and 0 <= y + dy < H and bp[x + dx, y + dy][3] > 60
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                px[x, y] = col
    return im


# ═══ 1) AGUA con orilla (water.png 128x128, 16 tiles) ═══════════════════════
old = Image.open(os.path.join(CAINOS, 'water.png')).convert('RGBA')
T = 32
water = [old.crop((i * T, 0, (i + 1) * T, T)) for i in range(4)]

LIP_D, LIP, LIP_L = (74, 70, 62, 255), (108, 104, 94, 255), (140, 136, 124, 255)
FOAM, FOAM_2 = (196, 224, 232, 255), (150, 196, 212, 235)


def shore(sides, corner=None, inner=None):
    """Tile de agua con labio de piedra+espuma en `sides` ('N','S','E','W').
    corner='NE' etc = esquina exterior redondeada; inner = esquina interior."""
    im = water[rng.randrange(4)].copy()
    px = im.load()
    wob = [rng.choice((-1, 0, 0, 1)) for _ in range(T)]

    def lip_at(x, y, d):   # d = profundidad dentro del labio (0=fuera)
        if d == 0: return None
        if d == 1: return LIP_D
        if d == 2: return LIP
        if d == 3: return LIP_L
        if d == 4: return FOAM
        if d == 5: return FOAM_2
        return None

    DEPTH = 5
    for i in range(T):
        for d in range(1, DEPTH + 1):
            w = wob[i]
            if 'N' in sides:
                y = d - 1 + w
                if 0 <= y < T: px[i, y] = lip_at(i, y, d)
            if 'S' in sides:
                y = T - d + w
                if 0 <= y < T: px[i, y] = lip_at(i, y, d)
            if 'W' in sides:
                x = d - 1 + w
                if 0 <= x < T: px[x, i] = lip_at(x, i, d)
            if 'E' in sides:
                x = T - d + w
                if 0 <= x < T: px[x, i] = lip_at(x, i, d)
    if corner:   # redondea la esquina exterior con curva de verdad (euclídea)
        cx = 0 if 'W' in corner else T - 1
        cy = 0 if 'N' in corner else T - 1
        for y in range(T):
            for x in range(T):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d < 8:
                    px[x, y] = (0, 0, 0, 0)
                elif d < 10:
                    px[x, y] = LIP_D
                elif d < 12:
                    px[x, y] = LIP
                elif d < 13:
                    px[x, y] = FOAM
    if inner:    # esquina interior: labio solo en el cuadrante del vértice
        cx = 0 if 'W' in inner else T - 1
        cy = 0 if 'N' in inner else T - 1
        for d in range(1, DEPTH + 1):
            for i in range(10):
                x = cx + (i if cx == 0 else -i)
                y = cy + ((d - 1) if cy == 0 else -(d - 1))
                if 0 <= x < T and 0 <= y < T and i < 10 - d:
                    c = lip_at(x, y, d)
                    if c: px[x, y] = c
                x2 = cx + ((d - 1) if cx == 0 else -(d - 1))
                y2 = cy + (i if cy == 0 else -i)
                if 0 <= x2 < T and 0 <= y2 < T and i < 10 - d:
                    c = lip_at(x2, y2, d)
                    if c: px[x2, y2] = c
    return im


sheet = new(128, 128)
for i, wt in enumerate(water):                       # fila 0: centros (gids 447-450)
    sheet.alpha_composite(wt, (i * T, 0))
for i, s in enumerate(['N', 'S', 'W', 'E']):         # fila 1: bordes
    sheet.alpha_composite(shore({s}), (i * T, T))
for i, c in enumerate(['NW', 'NE', 'SW', 'SE']):     # fila 2: esquinas exteriores
    sheet.alpha_composite(shore(set(c), corner=c), (i * T, 2 * T))
for i, c in enumerate(['NW', 'NE', 'SW', 'SE']):     # fila 3: esquinas interiores
    sheet.alpha_composite(shore(set(), inner=c), (i * T, 3 * T))
sheet.save(os.path.join(CAINOS, 'water.png'))

# ═══ 2) SETOS (extra.png, 4 tiles 32px) ═════════════════════════════════════
H_D, H_M, H_L = (38, 66, 34, 255), (62, 96, 48, 255), (94, 128, 62, 255)
ex = new(128, 32)
for v in range(4):
    t = new(T, T)
    px = t.load()
    for y in range(2, T - 1):
        for x in range(1, T - 1):
            px[x, y] = H_M
    for y in range(2, 9):                       # copa iluminada
        for x in range(1, T - 1):
            px[x, y] = H_L
    for y in range(T - 6, T - 1):               # base en sombra
        for x in range(1, T - 1):
            px[x, y] = H_D
    r2 = random.Random(100 + v)                 # textura de hojas
    for _ in range(46):
        x, y = r2.randrange(2, T - 2), r2.randrange(3, T - 2)
        base = px[x, y]
        px[x, y] = H_D if base == H_M and r2.random() < .5 else (H_L if base == H_M else H_M)
    outline(t)
    ex.alpha_composite(t, (v * T, 0))
ex.save(os.path.join(EXTRA, 'extra.png'))

# ═══ 3) ESTANDARTES por zona (24x60) ════════════════════════════════════════
ZONE_COLORS = {
    'tweets': '#f0a85a', 'posts': '#5fa3d8', 'stories': '#7a3a8e',
    'bereal': '#ff8a3c', 'chat': '#4abd76', 'profile': '#a87dd8',
}
WOOD_D, WOOD, WOOD_L = (74, 52, 34, 255), (106, 76, 48, 255), (138, 104, 66, 255)


def tone(hexc, mul):
    r, g, b = int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    r, g, b = colorsys.hsv_to_rgb(h, min(1, s * 1.1), max(0, min(1, v * mul)))
    return (int(r * 255), int(g * 255), int(b * 255), 255)


for zone, col in ZONE_COLORS.items():
    im = new(24, 60)
    px = im.load()
    C_D, C, C_L = tone(col, .62), tone(col, .92), tone(col, 1.25)
    for y in range(2, 58):                      # poste
        for x in (16, 17):
            px[x, y] = WOOD if x == 16 else WOOD_D
    px[16, 2] = WOOD_L
    for x in range(2, 16):                      # travesaño
        px[x, 4] = WOOD_L if x % 3 else WOOD
        px[x, 5] = WOOD_D
    for y in range(6, 34):                      # tela colgante
        for x in range(3, 14):
            px[x, y] = C
    for y in range(6, 34):
        px[3, y] = C_L
        px[13, y] = C_D
    for y in range(6, 10):
        for x in range(3, 14):
            px[x, y] = C_L
    for y in range(34, 40):                     # cola de golondrina
        for x in range(3, 14):
            k = y - 34
            if x < 3 + (5 - k) or x > 8 + k - 1:
                if abs(x - 8) > k:
                    px[x, y] = C_D if x > 8 else C
    for dy in range(3):                         # emblema: huella
        for dx in range(3):
            if (dx + dy) % 2 == 0:
                px[7 + dx, 18 + dy] = C_L
    px[6, 16] = C_L; px[10, 16] = C_L; px[8, 15] = C_L
    outline(im)
    im.save(os.path.join(EOBJ, f'banner_{zone}.png'))

# ═══ 4) PÉRGOLA (96x60, madera + copa de parra frondosa) ════════════════════
im = new(96, 60)
px = im.load()
for (bx) in (8, 44, 80):                        # 3 pares de postes
    for y in range(18, 56):
        for x in (bx, bx + 1, bx + 6, bx + 7):
            px[x, y] = WOOD if x % 2 == 0 else WOOD_D
for x in range(2, 94):                          # viga vista bajo la parra
    px[x, 16] = WOOD_L; px[x, 17] = WOOD_D
# copa de parra: manto frondoso con borde ondulado y racimos de luz/sombra
r3 = random.Random(5)
for y in range(0, 16):
    for x in range(0, 96):
        edge = 3 + int(2.6 * abs(__import__('math').sin(x * 0.35 + y)))
        if y >= (edge - 3) or (2 < x < 93 and y > 1):
            px[x, y] = H_M
for _ in range(210):                            # racimos de hojas (luz arriba)
    x, y = r3.randrange(1, 95), r3.randrange(0, 16)
    if px[x, y][3]:
        c = H_L if y < 7 and r3.random() < .7 else (H_D if y > 10 else H_M)
        for dx, dy in ((0, 0), (1, 0), (0, 1)):
            if x + dx < 96 and y + dy < 16 and px[x + dx, y + dy][3]:
                px[x + dx, y + dy] = c
for _ in range(10):                             # uvas
    x, y = r3.randrange(6, 90), r3.randrange(9, 15)
    if px[x, y][3]:
        px[x, y] = (120, 78, 140, 255)
        if x + 1 < 96 and px[x + 1, y][3]: px[x + 1, y] = (150, 104, 170, 255)
outline(im)
im.save(os.path.join(EOBJ, 'pergola.png'))

# ═══ 5) CASETA de mercado (64x58, toldo a rayas + libros p/ Moyano) ═════════
im = new(64, 58)
px = im.load()
CREAM, TERRA, TERRA_D = (236, 222, 188, 255), (198, 96, 70, 255), (156, 70, 52, 255)
for y in range(34, 54):                         # mostrador de tablones
    for x in range(4, 60):
        row = (y - 34) // 5
        px[x, y] = WOOD if (y - 34) % 5 else WOOD_D
for x in range(4, 60):
    px[x, 33] = WOOD_L
for y in range(20, 34):                         # postes laterales
    for x in (4, 5, 58, 59):
        px[x, y] = WOOD_D
for y in range(8, 22):                          # toldo inclinado a rayas
    x0 = 2 + (21 - y) // 3
    x1 = 62 - (21 - y) // 3
    for x in range(x0, x1):
        stripe = ((x + 2) // 6) % 2
        base = CREAM if stripe else TERRA
        if y < 11: base = tuple(min(255, c + 18) for c in base[:3]) + (255,)
        if y > 19: base = TERRA_D if not stripe else (214, 200, 168, 255)
        px[x, y] = base
for x in range(2, 62, 6):                       # festón del toldo
    for dx in range(4):
        if x + dx < 62:
            px[x + dx, 22] = TERRA_D if ((x // 6) % 2 == 0) else (214, 200, 168, 255)
r4 = random.Random(3)                           # libros sobre el mostrador
for bx in range(8, 56, 4):
    bh = r4.randrange(5, 9)
    bc = tone(rng.choice(list(ZONE_COLORS.values())), .95)
    for y in range(33 - bh, 33):
        for x in range(bx, bx + 3):
            px[x, y] = bc if x < bx + 2 else tone('#000000', 1)[:3] + (120,)
    px[bx, 33 - bh] = tuple(min(255, c + 30) for c in bc[:3]) + (255,)
outline(im)
im.save(os.path.join(EOBJ, 'stall.png'))

# ═══ 6) promueve los aprobados de assets-src/propuestas ═════════════════════
for f in (['lamp_post.png'] + [f'tree_autumn_{i}.png' for i in range(3)] +
          [f'bush_roses_{i}.png' for i in range(3)]):
    shutil.copy(os.path.join(PROP, f), os.path.join(EOBJ, f))

# hoja de contacto
files = sorted(os.listdir(EOBJ))
imgs = [Image.open(os.path.join(EOBJ, f)).convert('RGBA') for f in files]
imgs.append(Image.open(os.path.join(CAINOS, 'water.png')).convert('RGBA'))
imgs.append(Image.open(os.path.join(EXTRA, 'extra.png')).convert('RGBA'))
S, pad = 2, 10
w = sum(i.width * S + pad for i in imgs) + pad
h = max(i.height * S for i in imgs) + 2 * pad
cs = Image.new('RGBA', (w, h), (86, 118, 74, 255))
x = pad
for i in imgs:
    big = i.resize((i.width * S, i.height * S), Image.NEAREST)
    cs.alpha_composite(big, (x, h - pad - big.height))
    x += big.width + pad
cs.convert('RGB').save(os.path.join(PROP, '_hoja_fase_a.png'))
print('fase A generada →', EOBJ)

#!/usr/bin/env python3
"""Fase B — re-composición del parque (El Retiro, piel RO/Cainos).

PRESERVA las capas de manu: props (150 objetos, ids 1-196, incluye las
escaleras de su templete), muros, terraza y colision. RECONSTRUYE: suelo,
caminos, construido_suelo, construido_muros, construido_colision y la capa
estructuras (los 121 objetos actuales, ids 197-317, eran míos). AÑADE la capa
`agua` (bloquea por nombre en city.tiled.js) con el Estanque Grande.

Composición: perímetro amurallado con 3 puertas · plaza-fuente al oeste (el
spawn) · gran eje oeste-este hasta el Estanque Grande (NE, sobre el templete
de manu = el Monumento) · paseo alrededor del lago · avenida sur a la
Rosaleda y la Cuesta de Moyano · el Palacio de Cristal y el Observatorio al
sureste · templo en el NE · bosquecillos densos (verde + otoño), farolas,
estandartes por zona y viñetas.
"""
import json, os, random, math
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMJ = os.path.join(ROOT, 'public', 'data', 'park.tmj')
W, H = 134, 100
rng = random.Random(42)

# ─── gids ────────────────────────────────────────────────────────────────────
G = lambda idx: 1 + idx                      # grass.png: gid = idx+1
GRASS_PLAIN = [G(r * 8 + c) for r in range(4) for c in range(4)]
GRASS_FLOWER = [G(r * 8 + c) for r in range(4) for c in range(4, 8)]
COBBLE = [33, 34, 41, 42, 49, 50, 57, 58]    # adoquín con juntas de césped
SPILL_N, SPILL_S = [37, 38], [45, 46]        # derrame en el vecino N / S
SPILL_SIDE = [53, 54, 55, 56, 61, 62]        # piedrecitas sueltas (E/W/diag)
WCAP, WFACE, WFACE2, WLEFT, WRIGHT = 147, 179, 195, 162, 164   # muros (patrón de manu)


def wall_box(c_muros, idx, inb, veto, c0, c1, r0, r1, gaps=()):
    """Caja amurallada al estilo del templete de manu: corona (WCAP) + DOS caras
    de ladrillo (WFACE/WFACE2) en los muros horizontales, columnas WLEFT/WRIGHT
    en los laterales. `gaps` = celdas (c, r) de puerta que se dejan libres."""
    gaps = set(gaps)
    for c in range(c0, c1 + 1):
        for (rr, tiles) in ((r0, (WCAP, WFACE, WFACE2)), (r1, (WCAP, WFACE, WFACE2))):
            if (c, rr) in gaps:
                continue
            for k, t in enumerate(tiles):
                cell = (c, rr + k)
                if inb(*cell) and not veto(cell) and not c_muros[idx(*cell)]:
                    c_muros[idx(*cell)] = t
    for r in range(r0, r1 + 1):
        for (cc, t) in ((c0, WLEFT), (c1, WRIGHT)):
            cell = (cc, r)
            if cell not in gaps and inb(*cell) and not veto(cell) and not c_muros[idx(*cell)]:
                c_muros[idx(*cell)] = t
TREES = [385, 386, 387]
BUSHES = [388, 389, 390, 391, 392, 393]
ARCH_BIG, ARCH_SMALL = 397, 398              # struct s3 / s4
STAIRS = [402, 403, 404, 405]                # struct s8-s11 (abren paso solos)
PILLAR = 394                                 # struct s0
D = lambda i: 406 + i                        # deco: props_i
BENCH, STATUE, FOUNTAIN_BIG, BARREL = D(4), D(6), D(26), D(14)
SIGN, WELL_RING, CRATE, WOODBOX, CHEST = D(18), D(31), D(2), D(9), D(1)
AMPHORA, AMPHORA2, PEDESTAL, FOUNT_SM = D(23), D(30), D(20), D(24)
GRAVE1, GRAVE2, GRAVE3, CROSS = D(15), D(19), D(25), D(28)
ROCK_BIG = D(32)
STONES = [D(i) for i in range(33, 41)]
POST_SIGN, STELE = D(22), D(10)
# agua (water.png 128x128)
WAT_C = [447, 448, 449, 450]
WAT_N, WAT_S, WAT_W, WAT_E = 451, 452, 453, 454
WAT_NW, WAT_NE, WAT_SW, WAT_SE = 455, 456, 457, 458
WAT_INW, WAT_INE, WAT_ISW, WAT_ISE = 459, 460, 461, 462
HEDGE = [463, 464, 465, 466]                 # extra.png
X = 467                                      # extra_obj firstgid
LAMP = X
BANNER = {z: X + 1 + i for i, z in enumerate(
    ['tweets', 'posts', 'stories', 'bereal', 'chat', 'profile'])}
PERGOLA, STALL = X + 7, X + 8
AUTUMN = [X + 9, X + 10, X + 11]
ROSES = [X + 12, X + 13, X + 14]

EXTRA_OBJ_FILES = (['lamp_post.png'] +
                   [f'banner_{z}.png' for z in ['tweets', 'posts', 'stories', 'bereal', 'chat', 'profile']] +
                   ['pergola.png', 'stall.png'] +
                   [f'tree_autumn_{i}.png' for i in range(3)] +
                   [f'bush_roses_{i}.png' for i in range(3)])

# ─── carga y tamaños ─────────────────────────────────────────────────────────
m = json.load(open(TMJ))
layers = {l['name']: l for l in m['layers']}

SIZES = {}                                    # gid → (w,h) px, para objetos
for ts in m['tilesets']:
    if 'tiles' in ts:
        for t in ts['tiles']:
            SIZES[ts['firstgid'] + t['id']] = (t['imagewidth'], t['imageheight'])
for i, f in enumerate(EXTRA_OBJ_FILES):
    im = Image.open(os.path.join(ROOT, 'public', 'img', 'extra', 'obj', f))
    SIZES[X + i] = im.size

idx = lambda c, r: r * W + c
inb = lambda c, r: 0 <= c < W and 0 <= r < H

# ─── ocupación (lo de manu: intocable) ───────────────────────────────────────
# occ_solid = tiles sólidos de manu (muros/terraza/colision): bloquean TODO.
# occ = sólidos + props con margen: bloquea construir/plantar, pero NO los
# caminos ni el lago (un árbol al borde del camino es un parque normal;
# recortar la calzada alrededor de cada prop la dejaba hecha un colador).
occ_solid = set()
for name in ('muros', 'terraza', 'colision'):
    data = layers[name]['data']
    for i, g in enumerate(data):
        if g:
            occ_solid.add((i % W, i // W))
occ = set(occ_solid)          # sólido + props CON margen (para plantar/decorar)
occ_tight = set(occ_solid)    # sólido + props SIN margen (para tapias y suelos:
                              # una tapia junto a un árbol de manu es un parque normal)
for o in layers['props']['objects']:
    gid = o.get('gid')
    w, h = (o.get('width', 32), o.get('height', 32))
    c0, r0 = int(o['x'] // 32), int((o['y'] - h) // 32)
    c1, r1 = int((o['x'] + w) // 32), int(o['y'] // 32)
    for r in range(r0 - 1, r1 + 2):
        for c in range(c0 - 1, c1 + 2):
            if inb(c, r):
                occ.add((c, r))
                if r0 <= r <= r1 and c0 <= c <= c1:
                    occ_tight.add((c, r))

# ─── rejillas nuevas ─────────────────────────────────────────────────────────
suelo = [0] * (W * H)
caminos = [0] * (W * H)
agua = [0] * (W * H)
c_suelo = [0] * (W * H)
c_muros = [0] * (W * H)
c_colis = [0] * (W * H)
objects = []
_nid = [318]


def add_obj(gid, cx, cy_bottom, name=''):
    """Objeto centrado en la celda (cx, cy_bottom), anclado abajo (px de mapa)."""
    w, h = SIZES[gid]
    objects.append({
        'gid': gid, 'height': h, 'id': _nid[0], 'name': name, 'rotation': 0,
        'type': '', 'visible': True, 'width': w,
        'x': int(cx * 32 + 16 - w / 2), 'y': int(cy_bottom * 32 + 32),
    })
    _nid[0] += 1


# ─── 1) suelo base ───────────────────────────────────────────────────────────
for r in range(H):
    for c in range(W):
        h = (c * 73856093 ^ r * 19349663) & 0xffff
        if (h % 100) < 8:
            suelo[idx(c, r)] = GRASS_FLOWER[h % len(GRASS_FLOWER)]
        else:
            suelo[idx(c, r)] = GRASS_PLAIN[h % len(GRASS_PLAIN)]

# ─── 2) perímetro con 3 puertas ──────────────────────────────────────────────
GATE_W = [(1, r) for r in range(26, 30)]      # oeste  (Puerta de Alcalá)
GATE_S = [(c, 1) for c in range(62, 66)]      # sur    (Puerta de España)
GATE_E = [(1, r) for r in range(28, 32)]      # este   (Puerta de Hernani)
gate_w_rows = set(range(26, 30))
gate_s_cols = set(range(62, 66))
gate_e_rows = set(range(28, 32))
for c in range(2, 132):
    if c not in gate_s_cols:
        c_muros[idx(c, 96)] = WCAP
        c_muros[idx(c, 97)] = WFACE
    c_muros[idx(c, 2)] = WCAP
    c_muros[idx(c, 3)] = WFACE
for r in range(2, 98):
    if r not in gate_w_rows:
        c_muros[idx(2, r)] = c_muros[idx(2, r)] or WLEFT
    if r not in gate_e_rows:
        c_muros[idx(131, r)] = c_muros[idx(131, r)] or WRIGHT
add_obj(ARCH_BIG, 2, 26, 'Puerta de Alcalá')
add_obj(ARCH_BIG, 63, 96, 'Puerta de España')
add_obj(ARCH_BIG, 131, 28, 'Puerta de Hernani')

# ─── 3) Estanque Grande (NE, sobre el Monumento/templete de manu) ────────────
LAKE = set()
LC0, LC1, LR0, LR1, RAD = 80, 104, 22, 38, 5
for r in range(LR0, LR1 + 1):
    for c in range(LC0, LC1 + 1):
        dx = max(0, LC0 + RAD - c, c - (LC1 - RAD))
        dy = max(0, LR0 + RAD - r, r - (LR1 - RAD))
        if dx * dx + dy * dy <= RAD * RAD and (c, r) not in occ:
            LAKE.add((c, r))
# limpieza orgánica: suavizado (una celda de agua necesita mayoría de vecinos
# de agua), fuera pendientes finos, y quédate con la mancha conexa más grande
# → un lago de contorno suave que esquiva los props de manu.
for _ in range(2):
    LAKE = {p for p in LAKE if sum(((p[0] + dc, p[1] + dr) in LAKE)
            for dc in (-1, 0, 1) for dr in (-1, 0, 1) if (dc, dr) != (0, 0)) >= 5}
for _ in range(6):
    drop = [p for p in LAKE if sum(((p[0] + dc, p[1] + dr) in LAKE)
            for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1]
    if not drop:
        break
    LAKE -= set(drop)
from collections import deque as _dq
comps, todo = [], set(LAKE)
while todo:
    start = todo.pop()
    comp = {start}
    q = _dq([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n in todo:
                todo.discard(n)
                comp.add(n)
                q.append(n)
    comps.append(comp)
LAKE = max(comps, key=len) if comps else set()
water_land = lambda c, r: (c, r) not in LAKE
for (c, r) in LAKE:
    n, s = water_land(c, r - 1), water_land(c, r + 1)
    w_, e = water_land(c - 1, r), water_land(c + 1, r)
    if n and w_: g = WAT_NW
    elif n and e: g = WAT_NE
    elif s and w_: g = WAT_SW
    elif s and e: g = WAT_SE
    elif n: g = WAT_N
    elif s: g = WAT_S
    elif w_: g = WAT_W
    elif e: g = WAT_E
    elif water_land(c - 1, r - 1): g = WAT_INW
    elif water_land(c + 1, r - 1): g = WAT_INE
    elif water_land(c - 1, r + 1): g = WAT_ISW
    elif water_land(c + 1, r + 1): g = WAT_ISE
    else:
        h = (c * 2654435761 ^ r * 40503) & 0xffff
        g = WAT_C[h % 4]
    agua[idx(c, r)] = g

# ─── 4) caminos (bandas H/V de 3 de ancho) ───────────────────────────────────
PATH = set()


def band_h(r0, c0, c1):
    for r in range(r0, r0 + 3):
        for c in range(min(c0, c1), max(c0, c1) + 1):
            if inb(c, r) and (c, r) not in occ_solid and (c, r) not in LAKE and not c_muros[idx(c, r)]:
                PATH.add((c, r))


def band_v(c0, r0, r1):
    for c in range(c0, c0 + 3):
        for r in range(min(r0, r1), max(r0, r1) + 1):
            if inb(c, r) and (c, r) not in occ_solid and (c, r) not in LAKE and not c_muros[idx(c, r)]:
                PATH.add((c, r))


band_h(27, 3, 22)          # Puerta de Alcalá → plaza
band_h(27, 33, 79)         # gran eje: plaza → orilla oeste del lago
band_h(19, 76, 110)        # paseo norte del lago
band_h(41, 76, 84)         # paseo sur-oeste (hasta el templete de manu)
band_h(41, 99, 110)        # paseo sur-este (desde el templete)
band_v(76, 19, 43)         # orilla oeste
band_v(107, 19, 43)        # orilla este
band_h(54, 84, 108)        # paseo bajo el Monumento (conecta ambos lados)
band_v(84, 41, 56)         # bajada oeste del templete
band_v(105, 41, 56)        # bajada este del templete
band_v(27, 30, 65)         # avenida sur: plaza → puerta norte de la Rosaleda
band_h(71, 41, 60)         # puerta este de la Rosaleda → hacia el sur-este
band_v(60, 71, 93)         # bajada a la Puerta de España
band_h(88, 63, 78)         # calle de la Cuesta de Moyano
band_v(63, 91, 93)         # conexión puerta sur
band_h(29, 110, 130)       # Puerta de Hernani → orilla este
band_v(114, 17, 19)        # subida al templo NE
band_v(99, 56, 69)         # bajada al Palacio de Cristal
band_h(80, 101, 115)       # Cristal → Observatorio
band_v(101, 71, 80)        # tramo vertical Cristal→Observatorio
band_v(63, 19, 27)         # Casita del Pescador → gran eje (entra por el sur)
band_h(47, 30, 48)         # ramal al kiosco de música
band_h(55, 30, 69)         # ramal al Ángel Caído (centro)
for (c, r) in PATH:
    h = (c * 73856093 ^ r * 83492791) & 0xffff
    caminos[idx(c, r)] = COBBLE[h % len(COBBLE)]

# ─── 5) plaza-fuente (oeste, el spawn cae dentro) ────────────────────────────
PLAZA_C, PLAZA_R = 27, 28
FLOOR = set()
for r in range(H):
    for c in range(W):
        dx, dy = (c - PLAZA_C) / 7.0, (r - PLAZA_R) / 5.0
        if dx * dx + dy * dy <= 1 and (c, r) not in occ_tight and (c, r) not in PATH:
            FLOOR.add((c, r))

# ─── 6) las seis zonas ───────────────────────────────────────────────────────
# ☕ el Parterre (tweets) — terraza de café junto a la plaza
for r in range(32, 38):
    for c in range(33, 41):
        if (c, r) not in occ_tight and (c, r) not in PATH:
            FLOOR.add((c, r))
add_obj(BENCH, 35, 33); add_obj(BENCH, 38, 33)
add_obj(BENCH, 35, 36); add_obj(BENCH, 38, 36)
add_obj(LAMP, 33, 32); add_obj(LAMP, 40, 37)
add_obj(BANNER['tweets'], 34, 31)
add_obj(AUTUMN[0], 42, 36)

# 🪑 la Rosaleda (chat) — recinto de setos; la avenida sur muere en su puerta
for r in range(66, 79):
    for c in range(26, 41):
        border = r in (66, 78) or c in (26, 40)
        gap = (r == 66 and 27 <= c <= 29) or (c == 40 and 70 <= r <= 73)
        if border and not gap and (c, r) not in occ_tight and (c, r) not in PATH:
            c_muros[idx(c, r)] = HEDGE[(c + r) % 4]
        elif border and not gap and (c, r) in occ_tight and (c, r) not in occ_solid:
            # un prop de manu pisa el seto → arbusto suelto para dar continuidad
            add_obj(BUSHES[(c + r) % len(BUSHES)], c, r)
for r in range(67, 78):
    for c in range(27, 40):
        if (c, r) not in occ_tight and not c_muros[idx(c, r)]:
            h = (c * 31 ^ r * 17) & 0xff
            if h % 100 < 45:
                suelo[idx(c, r)] = GRASS_FLOWER[h % len(GRASS_FLOWER)]
add_obj(PERGOLA, 33, 71)
for i, (rc, rr) in enumerate([(28, 68), (38, 68), (28, 76), (38, 76), (33, 77), (29, 72)]):
    add_obj(ROSES[i % 3], rc, rr)
add_obj(BENCH, 36, 74)
add_obj(BANNER['chat'], 31, 66)
add_obj(LAMP, 25, 66)

# 📌 Cuesta de Moyano (posts) — casetas de libreros junto a la calle
for i, sc in enumerate([64, 69, 74, 79]):
    add_obj(STALL, sc, 87)
add_obj(CRATE, 66, 91); add_obj(WOODBOX, 72, 91); add_obj(CHEST, 77, 91)
add_obj(SIGN, 62, 87)
add_obj(BANNER['posts'], 81, 87)
add_obj(LAMP, 63, 91); add_obj(LAMP, 80, 91)

# 📷 el Palacio de Cristal (bereal) — pabellón de columnas
for r in range(66, 74):
    for c in range(96, 105):
        dx, dy = (c - 100) / 4.5, (r - 70) / 4.0
        if dx * dx + dy * dy <= 1 and (c, r) not in occ_tight and (c, r) not in PATH:
            FLOOR.add((c, r))
for (pc, pr) in [(97, 68), (103, 68), (96, 71), (104, 71), (98, 74), (102, 74)]:
    add_obj(PILLAR, pc, pr)
add_obj(ARCH_SMALL, 100, 67)
add_obj(FOUNT_SM, 100, 71)
add_obj(BANNER['bereal'], 103, 66)
add_obj(LAMP, 97, 74); add_obj(LAMP, 104, 67)

# 🌙 el Observatorio (stories) — torre amurallada con otoño alrededor
veto = lambda cell: cell in occ_tight or cell in PATH
wall_box(c_muros, idx, inb, veto, 112, 122, 77, 87,
         gaps=[(c, 87) for c in range(115, 120)])
for r in range(80, 87):
    for c in range(113, 122):
        if not c_muros[idx(c, r)] and (c, r) not in occ_tight:
            FLOOR.add((c, r))
add_obj(STAIRS[1], 117, 88)
add_obj(PEDESTAL, 117, 81); add_obj(STATUE, 117, 80)
add_obj(STELE, 114, 83); add_obj(AMPHORA, 120, 83)
add_obj(BANNER['stories'], 120, 89)
add_obj(LAMP, 113, 88); add_obj(LAMP, 121, 88)
for (tc, tr) in [(109, 78), (108, 85), (125, 79), (124, 88), (111, 92), (120, 92)]:
    add_obj(AUTUMN[(tc + tr) % 3], tc, tr)

# 🏠 Casita del Pescador (profile) — cabaña amurallada con puerta al sur
wall_box(c_muros, idx, inb, veto, 59, 68, 11, 18,
         gaps=[(c, 18) for c in range(62, 66)])
for r in range(14, 18):
    for c in range(60, 68):
        if not c_muros[idx(c, r)] and (c, r) not in occ_tight:
            FLOOR.add((c, r))
add_obj(ARCH_SMALL, 63, 18)
add_obj(BARREL, 60, 14); add_obj(BARREL, 61, 15); add_obj(CHEST, 66, 14)
add_obj(BENCH, 64, 16)
add_obj(BANNER['profile'], 66, 20)
add_obj(LAMP, 60, 20)

# ─── 7) santuario del NE — el mirador viejo (terraza de manu) ya da el cuerpo;
#     lo abrazamos con muro en U (abierto al sur) + explanada + columnata ─────
wall_box(c_muros, idx, inb, veto, 106, 124, 5, 16,
         gaps=[(c, 16) for c in range(107, 124)])
for r in range(8, 16):
    for c in range(107, 124):
        if not c_muros[idx(c, r)] and (c, r) not in occ_tight:
            FLOOR.add((c, r))
add_obj(STAIRS[0], 115, 17)
for pc in (109, 113, 117, 121):
    add_obj(PILLAR, pc, 9)
for sc in (110, 115, 120):
    add_obj(STATUE, sc, 13)
add_obj(FOUNTAIN_BIG, 115, 12)
add_obj(AMPHORA, 108, 15); add_obj(AMPHORA2, 122, 15)
add_obj(LAMP, 111, 18); add_obj(LAMP, 119, 18)

# ─── 8) viñetas sueltas ──────────────────────────────────────────────────────
# cementerio recoleto (SO)
for i, (gc, gr) in enumerate([(9, 83), (12, 83), (15, 83), (9, 86), (12, 86), (15, 86)]):
    add_obj([GRAVE1, GRAVE2, GRAVE3][i % 3], gc, gr)
add_obj(CROSS, 12, 80)
add_obj(AUTUMN[1], 17, 88)
add_obj(LAMP, 6, 85)
# pozo en el cruce del gran eje con la avenida norte
add_obj(WELL_RING, 66, 24)
# rocas y piedras a la orilla del lago
for (rc, rr) in [(79, 21), (106, 40), (92, 20), (103, 39)]:
    add_obj(ROCK_BIG, rc, rr)
    add_obj(STONES[(rc + rr) % len(STONES)], rc + 1, rr + 1)
# rincón de la estatua (O)
add_obj(STATUE, 12, 52); add_obj(BENCH, 10, 54); add_obj(BENCH, 14, 54)
add_obj(POST_SIGN, 8, 52)
# barriles junto a la puerta sur
add_obj(BARREL, 58, 93); add_obj(BARREL, 59, 94)
# el Ángel Caído (easter egg del Retiro, centro del parque)
add_obj(PEDESTAL, 66, 57); add_obj(STATUE, 66, 56)
add_obj(BENCH, 63, 58); add_obj(BENCH, 69, 58)
for i, (sc, sr) in enumerate([(64, 55), (68, 55), (63, 57), (69, 57)]):
    add_obj(STONES[i % len(STONES)], sc, sr)
add_obj(AUTUMN[2], 61, 54); add_obj(AUTUMN[0], 71, 54)
add_obj(LAMP, 64, 59); add_obj(LAMP, 68, 59)
# kiosco de música (pérgola-templete con bancos)
add_obj(PERGOLA, 51, 46)
add_obj(BENCH, 48, 49); add_obj(BENCH, 54, 49)
add_obj(LAMP, 47, 46); add_obj(LAMP, 55, 46)
add_obj(AMPHORA2, 49, 47)

# fuente de la plaza + su mobiliario (después de zonas para tener FLOOR listo)
add_obj(FOUNTAIN_BIG, PLAZA_C, PLAZA_R + 1, 'fuente de la plaza')
add_obj(LAMP, 21, 24); add_obj(LAMP, 33, 24); add_obj(LAMP, 21, 32); add_obj(LAMP, 33, 32)
add_obj(BENCH, 24, 25); add_obj(BENCH, 30, 25)
add_obj(BANNER['tweets'], 33, 30) if False else None

# ─── 9) suelo de piedra construido + derrames orgánicos de borde ─────────────
for (c, r) in FLOOR:
    h = (c * 40503 ^ r * 73856093) & 0xffff
    c_suelo[idx(c, r)] = COBBLE[h % len(COBBLE)]

STONE_SET = PATH | FLOOR
for (c, r) in list(STONE_SET):
    for dc, dr, spill in ((0, -1, SPILL_N), (0, 1, SPILL_S)):
        nc, nr = c + dc, r + dr
        if inb(nc, nr) and (nc, nr) not in STONE_SET and (nc, nr) not in occ \
           and (nc, nr) not in LAKE and not c_muros[idx(nc, nr)] and not caminos[idx(nc, nr)] \
           and not c_suelo[idx(nc, nr)]:
            h = (nc * 19349663 ^ nr * 83492791) & 0xffff
            suelo[idx(nc, nr)] = spill[h % 2]
    for dc, dr in ((-1, 0), (1, 0)):
        nc, nr = c + dc, r + dr
        if inb(nc, nr) and (nc, nr) not in STONE_SET and (nc, nr) not in occ \
           and (nc, nr) not in LAKE and not c_muros[idx(nc, nr)]:
            h = (nc * 2654435761 ^ nr * 19349663) & 0xffff
            if h % 100 < 40 and suelo[idx(nc, nr)] in GRASS_PLAIN:
                suelo[idx(nc, nr)] = SPILL_SIDE[h % len(SPILL_SIDE)]

# ─── 10) farolas por las avenidas ────────────────────────────────────────────
def lamp_row_h(r_above, r_below, c0, c1, step=9):
    side = 0
    for c in range(c0, c1, step):
        r = r_above if side % 2 == 0 else r_below
        if (c, r) not in occ and (c, r) not in LAKE and (c, r) not in PATH and not c_muros[idx(c, r)]:
            add_obj(LAMP, c, r)
        side += 1


lamp_row_h(26, 30, 8, 76)         # gran eje
lamp_row_h(18, 22, 78, 108)       # paseo norte del lago (evita el agua por chequeo)
for r in range(34, 68, 9):        # avenida sur
    c = 26 if (r // 9) % 2 == 0 else 30
    if (c, r) not in occ and (c, r) not in PATH:
        add_obj(LAMP, c, r)
for r in range(58, 92, 11):       # bajada a la puerta sur
    if (59, r) not in occ and (59, r) not in PATH:
        add_obj(LAMP, 59, r)

# ─── 11) bosquecillos + arbustos ─────────────────────────────────────────────
NO_TREE = STONE_SET | LAKE | occ
NO_TREE |= {(c, r) for r in range(H) for c in range(W) if c_muros[idx(c, r)] or c_suelo[idx(c, r)]}
NO_TREE |= {(c, r) for c in range(W) for r in list(range(0, 5)) + list(range(95, H))}
NO_TREE |= {(c, r) for r in range(H) for c in list(range(0, 5)) + list(range(129, W))}
# también los recintos: rosaleda y el vecindario del lago (que respire)
NO_TREE |= {(c, r) for r in range(64, 80) for c in range(25, 42)}


def tree_ok(c, r):
    return inb(c, r) and (c, r) not in NO_TREE


# alamedas: hileras de árboles flanqueando el gran eje y la avenida sur
for c in range(8, 75, 7):
    for r in (24, 32):
        if tree_ok(c, r):
            add_obj(TREES[(c + r) % 3], c, r)
for r in range(34, 64, 7):
    for c in (24, 32):
        if tree_ok(c, r):
            add_obj(TREES[(c + r) % 3], c, r)

placed_trees = []
attempts = 0
clusters = 0
while clusters < 60 and attempts < 5000:
    attempts += 1
    cc, cr = rng.randrange(6, 128), rng.randrange(6, 94)
    if not tree_ok(cc, cr):
        continue
    autumn_cluster = rng.random() < 0.28
    n = rng.randrange(3, 8)
    got = 0
    for _ in range(n * 4):
        if got >= n:
            break
        tc = cc + int(rng.gauss(0, 2.6))
        tr = cr + int(rng.gauss(0, 2.2))
        if tree_ok(tc, tr) and all(abs(tc - a) + abs(tr - b) > 2 for a, b in placed_trees[-14:]):
            gid = (AUTUMN[rng.randrange(3)] if (autumn_cluster or rng.random() < .12)
                   else TREES[rng.randrange(3)])
            add_obj(gid, tc, tr)
            placed_trees.append((tc, tr))
            got += 1
    if got:
        clusters += 1
for _ in range(40):                # matas sueltas
    c, r = rng.randrange(6, 128), rng.randrange(6, 94)
    if tree_ok(c, r):
        add_obj(BUSHES[rng.randrange(len(BUSHES))], c, r)

# ─── 12) ensamblar el .tmj ───────────────────────────────────────────────────
for ts in m['tilesets']:               # water.png ahora es 128x128 (16 tiles)
    if ts['name'] == 'water':
        ts.update(imagewidth=128, imageheight=128, tilecount=16, columns=4)
if not any(t['name'] == 'extra' for t in m['tilesets']):
    m['tilesets'].append({
        'columns': 4, 'firstgid': 463, 'image': '../img/extra/extra.png',
        'imageheight': 32, 'imagewidth': 128, 'margin': 0, 'name': 'extra',
        'spacing': 0, 'tilecount': 4, 'tileheight': 32, 'tilewidth': 32,
    })
if not any(t['name'] == 'extra_obj' for t in m['tilesets']):
    tiles = []
    mw = mh = 0
    for i, f in enumerate(EXTRA_OBJ_FILES):
        w, h = SIZES[X + i]
        mw, mh = max(mw, w), max(mh, h)
        tiles.append({'id': i, 'image': f'../img/extra/obj/{f}',
                      'imagewidth': w, 'imageheight': h})
    m['tilesets'].append({
        'columns': 0, 'firstgid': X,
        'grid': {'height': 32, 'orientation': 'orthogonal', 'width': 32},
        'margin': 0, 'name': 'extra_obj', 'objectalignment': 'bottomleft',
        'spacing': 0, 'tilecount': len(tiles), 'tileheight': mh,
        'tilewidth': mw, 'tiles': tiles,
    })

layers['suelo']['data'] = suelo
layers['caminos']['data'] = caminos
layers['construido_suelo']['data'] = c_suelo
layers['construido_muros']['data'] = c_muros
layers['construido_colision']['data'] = c_colis
layers['estructuras']['objects'] = objects
if 'agua' not in layers:
    agua_layer = {'data': agua, 'height': H, 'width': W, 'id': max(l['id'] for l in m['layers']) + 1,
                  'name': 'agua', 'opacity': 1, 'type': 'tilelayer', 'visible': True, 'x': 0, 'y': 0}
    pos = next(i for i, l in enumerate(m['layers']) if l['name'] == 'construido_suelo')
    m['layers'].insert(pos, agua_layer)
    layers['agua'] = agua_layer
else:
    layers['agua']['data'] = agua
m['nextobjectid'] = _nid[0]
json.dump(m, open(TMJ, 'w'), separators=(',', ':'))

# ─── 13) validación: flood-fill desde el spawn ───────────────────────────────
block = set()
for name in ('muros', 'colision', 'agua', 'construido_muros', 'construido_colision'):
    data = layers[name]['data']
    for i, g in enumerate(data):
        if g:
            block.add((i % W, i // W))
holes = set()
for lay in ('props', 'estructuras'):
    for o in layers[lay]['objects']:
        if o.get('gid') in STAIRS:
            w, h = o['width'], o['height']
            for r in range(int((o['y'] - h) // 32), int(o['y'] // 32) + 1):
                for c in range(int(o['x'] // 32), int((o['x'] + w) // 32) + 1):
                    holes.add((c, r))
block -= holes
from collections import deque
seen = {(23, 27)}
q = deque(seen)
while q:
    c, r = q.popleft()
    for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (c + dc, r + dr)
        if inb(*n) and n not in block and n not in seen:
            seen.add(n)
            q.append(n)
targets = {
    'spawn': (23, 27), 'puerta O': (4, 27), 'puerta S': (63, 94), 'puerta E': (129, 29),
    'Parterre': (31, 30), 'Moyano': (68, 90), 'Observatorio': (117, 82),
    'Cristal': (100, 70), 'Rosaleda': (31, 72), 'Casita': (64, 15),
    'tablón': (92, 49), 'templete manu': (91, 45), 'templo NE': (115, 11),
    'Rosa': (33, 32), 'Tomás': (89, 49), 'Lola': (32, 71), 'Paco': (67, 89),
    'Marisa': (65, 20), 'Quique': (99, 68),
}
bad = [k for k, v in targets.items() if v not in seen]
print(f'objetos nuevos: {len(objects)} · celdas andables alcanzables: {len(seen)}')
print('INALCANZABLES:', bad if bad else 'ninguno ✓')

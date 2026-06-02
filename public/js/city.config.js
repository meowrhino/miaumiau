// CityConfig — world constants, zone/deco/decoration data.
// Loaded BEFORE city.js so the latter can destructure these locals at the top of its IIFE.
//
// ── RESKIN "EL RETIRO" (rama reskin-retiro) ───────────────────────────────────
// El mundo pasó de 3 islas + plaza (1280×720) a UN PARQUE GRANDE inspirado en el
// Parque del Retiro de Madrid (6400×4800, ~la cámara te sigue). La distribución
// y los landmarks salen del prototipo validado en /tmp/miau-mockup. El "skin"
// sigue siendo RO/Elthen: cada landmark se vestirá con su PNG de Elthen.
//   feed     = Estanque Grande + Monumento (NO es zona, es el centro social)
//   tweets   = el Parterre (terraza)          posts   = Cuesta de Moyano (libros)
//   stories  = el Observatorio                 bereal  = Palacio de Cristal
//   chat     = la Rosaleda                     profile = Casita del Pescador
//   entrada/spawn = Puerta de Alcalá
;(function () {
  // Top-down 3/4 perspective. World units == screen units (1:1) before camera
  // scale; la cámara (city.camera.js) ahora SIGUE al jugador (no encaja todo).
  const W = 6400, H = 4800
  const PLAYER_SPEED = 320  // px/sec (mundo grande → algo más rápido)
  const PLAYER_SIZE = 60    // sprite render size

  // ─── Verja (perímetro irregular del parque) ───────────────────────────────
  // Polígono cerrado. city.js lo usa para colisión (point-in-polygon) y
  // city.render.ground.js para clip de césped + dibujo de la reja.
  const VERJA = [
    { x: 1700, y: 260 }, { x: 3400, y: 200 }, { x: 4900, y: 420 }, { x: 5900, y: 1300 },
    { x: 6150, y: 2600 }, { x: 5700, y: 3900 }, { x: 4400, y: 4520 }, { x: 2700, y: 4600 },
    { x: 1300, y: 4300 }, { x: 500, y: 3300 }, { x: 360, y: 1900 }, { x: 820, y: 820 },
  ]

  // ─── Aguas (no se pisan) ──────────────────────────────────────────────────
  // 'rect'  = estanque grande (el feed)   ·  'ellipse' = estanque del Cristal
  // 'stroke'= arroyo (polilínea con ancho). city.js los resta de la zona andable.
  const WATER = [
    { type: 'rect', x: 2800, y: 1675, w: 1400, h: 950, r: 60 },
    { type: 'ellipse', x: 4800, y: 3560, rx: 185, ry: 115 },
    { type: 'stroke', w: 42, pts: [ { x: 2010, y: 840 }, { x: 1820, y: 1010 }, { x: 1660, y: 1130 }, { x: 1520, y: 1180 } ] },
  ]

  // ─── Paseos (solo visuales; se anda por todo el césped) ───────────────────
  const PASEOS = [
    [{ x: 1150, y: 1320 }, { x: 1750, y: 1560 }, { x: 2350, y: 1820 }, { x: 2820, y: 2010 }],
    [{ x: 2400, y: 1250 }, { x: 3500, y: 1150 }, { x: 4500, y: 1300 }, { x: 5050, y: 2200 }, { x: 4500, y: 3300 }, { x: 3200, y: 3600 }, { x: 1950, y: 3350 }, { x: 1500, y: 2400 }, { x: 2000, y: 1500 }, { x: 2900, y: 1300 }],
    [{ x: 1300, y: 1500 }, { x: 1650, y: 1300 }, { x: 1750, y: 1450 }],
    [{ x: 1550, y: 1700 }, { x: 1400, y: 2400 }, { x: 1480, y: 3300 }],
    [{ x: 1500, y: 3550 }, { x: 2100, y: 3900 }, { x: 2750, y: 4100 }, { x: 3350, y: 4300 }],
    [{ x: 3400, y: 4250 }, { x: 3700, y: 3500 }, { x: 3550, y: 2700 }],
    [{ x: 3300, y: 1600 }, { x: 3150, y: 1100 }, { x: 3100, y: 880 }],
    [{ x: 4150, y: 2550 }, { x: 4500, y: 3000 }, { x: 4780, y: 3250 }],
    [{ x: 4850, y: 3450 }, { x: 5300, y: 3750 }, { x: 5600, y: 3950 }],
  ]

  // Estanque grande + Monumento = corazón social ("el feed"). MONUMENT = columnata.
  const ESTANQUE = WATER[0]
  const MONUMENT = { x: 4250, y: 2150 }
  // Explanada del Monumento (adoquín andable, al ESTE del estanque) + fuente.
  const PLAZA = { x: 4430, y: 2150, rx: 250, ry: 220 }
  const FOUNTAIN = { x: 4430, y: 2150, r: 48 }
  // Spawn: Puerta de Alcalá (entrada oeste).
  const SPAWN = { x: 1120, y: 1320 }
  // Puertas de la verja (futuros warps / fast-travel).
  const GATES = [ { x: 760, y: 1220, label: 'Puerta de Alcalá' }, { x: 3050, y: 4560, label: 'Puerta de España' }, { x: 5700, y: 1450, label: 'Puerta de Hernani' } ]

  // ─── 6 zonas (modos) en sus landmarks del Retiro ──────────────────────────
  // MISMA FORMA que antes (id/name/x/y/w/h/color/mascotColor/habitat/building/roof)
  // para no romper input/presence/sheet/tooltip/render. Solo cambian posición y name.
  const ZW = 260, ZH = 190
  const ZONES = [
    { id: 'tweets',  name: 'el Parterre',          x: 1490 - ZW/2, y: 1450 - ZH/2, w: ZW, h: ZH, color: '#f0a85a', mascotColor: '#FFB800', habitat: 'tweets',  building: '☕', roof: '#c97a3a' },
    { id: 'posts',   name: 'Cuesta de Moyano',     x: 3300 - ZW/2, y: 4360 - ZH/2, w: ZW, h: ZH, color: '#5fa3d8', mascotColor: '#007AFF', habitat: 'posts',   building: '📌', roof: '#3877a6' },
    { id: 'stories', name: 'el Observatorio',      x: 5650 - ZW/2, y: 3960 - ZH/2, w: ZW, h: ZH, color: '#7a3a8e', mascotColor: '#BF7BD9', habitat: 'stories', building: '🌙', roof: '#552366' },
    { id: 'bereal',  name: 'el Palacio de Cristal', x: 4800 - ZW/2, y: 3380 - ZH/2, w: ZW, h: ZH, color: '#ff8a3c', mascotColor: '#FF9500', habitat: 'bereal',  building: '📷', roof: '#cc6320' },
    { id: 'chat',    name: 'la Rosaleda',          x: 1495 - ZW/2, y: 3470 - ZH/2, w: ZW, h: ZH, color: '#4abd76', mascotColor: '#34C759', habitat: 'chat',    building: '🪑', roof: '#2f8f56' },
    { id: 'profile', name: 'Casita del Pescador',  x: 3100 - ZW/2, y: 840 - ZH/2,  w: ZW, h: ZH, color: '#a87dd8', mascotColor: '#BF7BD9', habitat: 'profile', building: '🏠', roof: '#7e54a8' },
  ]

  // Vestigial (islas/puentes ya no existen) — se mantienen los KEYS exportados
  // para no romper destructuring de consumidores que aún los nombran.
  const ISLANDS = []
  const ISLAND_R = 36
  const BRIDGES = []

  // ─── Deco buildings (kinds existentes → loadSprites los conoce) ───────────
  // Repartidos por el parque para densidad. 'stall' x varios = mercado del feed.
  const DECO_BUILDINGS = [
    // Mercado del feed (junto al Monumento) — puestos = posts
    { kind: 'stall', seed: 7,  x: 3960, y: 2050, h: 56 },
    { kind: 'stall', seed: 13, x: 4080, y: 2330, h: 56 },
    { kind: 'stall', seed: 21, x: 4380, y: 1950, h: 56 },
    { kind: 'stage', x: 4430, y: 2360, h: 50 },
    // Casita del Pescador (profile) — vecindario
    { kind: 'cottage', seed: 11, x: 2820, y: 760,  h: 90 },
    { kind: 'cottage', seed: 22, x: 3380, y: 780,  h: 90 },
    { kind: 'barn',    x: 2700, y: 1020, h: 90 },
    // La Rosaleda (chat) — pozo
    { kind: 'well',  x: 1700, y: 3520, h: 60 },
    // el Parterre (café) — horno/panadería de terraza
    { kind: 'bakery',  x: 1760, y: 1300, h: 100 },
    // Observatorio — molino cercano (campo)
    { kind: 'mill',    x: 5350, y: 4180, h: 180 },
    { kind: 'workshop', x: 4980, y: 3560, h: 100 },
  ]

  // ─── Árboles (bosque del Retiro) — scatter determinista con claros ────────
  const TREES = (function () {
    const pts = [], cx = 3200, cy = 2400
    const excl = [ [3500,2150,920], [4800,3400,360], [1495,3470,340], [3300,4380,640], [5650,4020,360], [3100,860,300], [1490,1450,300], [1100,1280,360] ]
    for (let gx = 620; gx < W - 420; gx += 320) {
      for (let gy = 460; gy < H - 380; gy += 320) {
        const x = Math.round(gx + Math.sin(gx * 0.7 + gy) * 110)
        const y = Math.round(gy + Math.cos(gy * 0.5 + gx) * 110)
        if (((x - cx) / 2760) ** 2 + ((y - cy) / 2060) ** 2 > 0.93) continue
        let skip = false
        for (const e of excl) { if ((x - e[0]) ** 2 + (y - e[1]) ** 2 < e[2] * e[2]) { skip = true; break } }
        if (!skip) pts.push({ x, y })
      }
    }
    return pts
  })()

  // ─── Farolas a lo largo de los paseos (cozy de noche) ─────────────────────
  const LAMPS = [
    { x: 2000, y: 1700 }, { x: 2900, y: 1250 }, { x: 4250, y: 1980 }, { x: 4520, y: 2200 },
    { x: 3600, y: 3400 }, { x: 1450, y: 2600 }, { x: 5100, y: 3700 }, { x: 3300, y: 860 },
    { x: 1700, y: 1470 }, { x: 1600, y: 3550 }, { x: 2750, y: 4100 }, { x: 4780, y: 3250 },
  ]

  // Image asset manifest. Keys: 'building:<zoneId>', 'deco:<kind>:<variant>',
  // 'tile:<name>'. Files under /img/. Missing files → procedural fallback.
  // (M5 del port: aquí entran los PNGs recortados de Elthen, slot a slot.)
  const ASSET_MANIFEST = {
    'building:tweets':  '/img/buildings/tweets-cafe.png',
    'building:posts':   '/img/buildings/posts-board.png',
    'building:stories': '/img/buildings/stories-observatory.png',
    'building:chat':    '/img/buildings/chat-bench-house.png',
    'building:bereal':  '/img/buildings/bereal-polaroid.png',
    'building:profile': '/img/buildings/profile-home.png',
    'deco:cottage:1':   '/img/deco/cottage-1.png',
    'deco:cottage:2':   '/img/deco/cottage-2.png',
    'deco:cottage:3':   '/img/deco/cottage-3.png',
    'deco:cottage:4':   '/img/deco/cottage-4.png',
    'deco:bakery':      '/img/deco/bakery.png',
    'deco:workshop':    '/img/deco/workshop.png',
    'deco:barn':        '/img/deco/barn.png',
    'deco:mill':        '/img/deco/mill.png',
    'deco:well':        '/img/deco/well.png',
    'deco:stage':       '/img/deco/stage.png',
    'deco:stall:1':     '/img/deco/stall-1.png',
    'deco:stall:2':     '/img/deco/stall-2.png',
  }

  // Per-zone anchors (ratios 0..1) para humo/bandera/glow sobre cada PNG.
  const ZONE_ANCHORS = {
    tweets:  { chimney: [0.69, 0.05], door: [0.50, 0.78], window: [0.30, 0.66] },
    posts:   { flag:    [0.56, 0.05], door: [0.50, 0.78], window: [0.32, 0.66] },
    stories: { telescope: [0.50, 0.18], door: [0.50, 0.78], window: [0.30, 0.66] },
    chat:    { bubble:  [0.62, 0.10], door: [0.50, 0.78], window: [0.30, 0.66] },
    bereal:  { lens:    [0.50, 0.42], door: [0.50, 0.78] },
    profile: { heart:   [0.50, 0.78], door: [0.50, 0.78] },
  }

  // Vestigial sheet rects (Sprout Lands ya no se usa; KEYS mantenidos por compat).
  const GRASS_TILE_RECT = { sx: 96, sy: 224, sw: 16, sh: 16 }
  const HOUSE_RECTS = {
    tweets:  { sx: 64, sy: 64, sw: 64, sh: 64 }, posts: { sx: 0, sy: 0, sw: 64, sh: 64 },
    stories: { sx: 64, sy: 128, sw: 64, sh: 64 }, chat: { sx: 64, sy: 0, sw: 64, sh: 64 },
    bereal:  { sx: 0, sy: 64, sw: 64, sh: 64 }, profile: { sx: 128, sy: 0, sw: 64, sh: 64 },
  }
  const TREE_RECTS = [
    { sx: 0, sy: 0, sw: 32, sh: 48 }, { sx: 32, sy: 0, sw: 32, sh: 48 },
    { sx: 96, sy: 0, sw: 32, sh: 48 }, { sx: 160, sy: 0, sw: 32, sh: 48 },
  ]
  const COTTAGE_RECTS = [
    { sx: 128, sy: 64, sw: 64, sh: 64 }, { sx: 0, sy: 128, sw: 64, sh: 64 },
    { sx: 128, sy: 128, sw: 64, sh: 64 }, { sx: 64, sy: 64, sw: 64, sh: 64 },
  ]
  const HUT_RECT = { sx: 0, sy: 0, sw: 64, sh: 64 }
  const BRICK_RECTS = { bakery: { sx: 0, sy: 0, sw: 96, sh: 80 }, workshop: { sx: 96, sy: 0, sw: 96, sh: 80 } }

  window.CityConfig = {
    W, H, PLAYER_SPEED, PLAYER_SIZE,
    ZONES, PLAZA, FOUNTAIN, SPAWN,
    ISLANDS, ISLAND_R, BRIDGES,
    VERJA, WATER, PASEOS, ESTANQUE, MONUMENT, GATES,
    DECO_BUILDINGS, TREES, LAMPS,
    ASSET_MANIFEST, ZONE_ANCHORS,
    GRASS_TILE_RECT, HOUSE_RECTS, TREE_RECTS, COTTAGE_RECTS, HUT_RECT, BRICK_RECTS,
  }
})()

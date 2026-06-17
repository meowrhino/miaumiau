// CityConfig — TODOS los datos del MAPA: el mundo, los caminos (PASEOS), el agua
// (WATER), los 6 modos (ZONES), deco, árboles, farolas... Si quieres MOVER o
// CAMBIAR algo del parque, se hace AQUÍ (no hace falta tocar el render).
// 📖 Guía fácil para editarlo: ver  MAPA.md  (en la raíz del repo).
//
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

  // ─── Caminos en REJILLA (autotile Cainos) — ESTO es lo que se pinta ────────
  // Avenidas alineadas a la cuadrícula (rectos H/V + giros de 90°). Cada segmento
  // es RECTO: comparte y (horizontal) o x (vertical). Se autotilean con stone.png
  // (9-slice → bordes y esquinas de piedra de verdad). Ancho fijo = 3 celdas.
  // ⚠️ Los PASEOS curvos de arriba quedan como datos LEGACY (ya NO se dibujan).
  // 📖 Para mover/añadir avenidas: ver MAPA.md (es solo cambiar números aquí).
  const PATH_GRID = 48
  const PATH_SEGMENTS = [
    // Anillo alrededor del Estanque (el "paseo del estanque"); plaza en el lado este
    { x0: 1500, y0: 1450, x1: 4430, y1: 1450 },  // arriba
    { x0: 4430, y0: 1450, x1: 4430, y1: 2850 },  // este (pasa por la plaza)
    { x0: 1500, y0: 2850, x1: 4430, y1: 2850 },  // abajo
    { x0: 1500, y0: 1450, x1: 1500, y1: 2850 },  // oeste
    // Ramales rectos a las zonas y las puertas
    { x0: 760,  y0: 1450, x1: 1500, y1: 1450 },  // → Puerta de Alcalá (oeste)
    { x0: 1120, y0: 1320, x1: 1120, y1: 1450 },  // baja al spawn
    { x0: 3100, y0: 1450, x1: 3100, y1: 840  },  // → Casita del Pescador (norte)
    { x0: 4430, y0: 1450, x1: 5700, y1: 1450 },  // → Puerta de Hernani (este)
    { x0: 1500, y0: 2850, x1: 1500, y1: 3470 },  // → la Rosaleda (suroeste)
    { x0: 3100, y0: 2850, x1: 3100, y1: 4560 },  // → Cuesta de Moyano / Pta España (sur)
    { x0: 3100, y0: 4360, x1: 3300, y1: 4360 },  // jog hasta posts
    { x0: 4430, y0: 2850, x1: 4430, y1: 3380 },  // baja desde la plaza
    { x0: 4430, y0: 3380, x1: 5650, y1: 3380 },  // → Palacio de Cristal (este)
    { x0: 5650, y0: 3380, x1: 5650, y1: 3960 },  // → el Observatorio (sur)
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

  // ─── Deco buildings (kinds existentes → loadSprites los conoce) ───────────
  // Repartidos por el parque para densidad. 'stall' x varios = mercado del feed.
  const DECO_BUILDINGS = [
    // Mercado del feed (junto al Monumento) — puestos = posts
    // Reskin Cainos: quitado el deco procedural que chocaba (cottages, bakery, barn,
    // workshop, well, stage). Se mantienen los puestos del feed (leen como mercado)
    // y el molino de piedra del Observatorio (pega razonablemente).
    { kind: 'stall', seed: 7,  x: 3960, y: 2050, h: 56 },
    { kind: 'stall', seed: 13, x: 4080, y: 2330, h: 56 },
    { kind: 'stall', seed: 21, x: 4380, y: 1950, h: 56 },
    { kind: 'mill',    x: 5350, y: 4180, h: 180 },
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

  // ─── Vecinos (NPCs que pasean por el barrio) ──────────────────────────────
  // El alma del sitio: aunque no haya nadie conectado, el parque está VIVO. Cada
  // vecino tiene su casa (home), un radio de paseo (roam) y frases ambientales.
  // Pasean lento, se paran, sueltan una frase de vez en cuando. 📖 Para añadir o
  // mover vecinos: edita aquí (igual que LAMPS/TREES). `color` = nombre de COLORS;
  // `seed` cambia su carita. Futuro: `quest` para misiones de recados al vecino.
  const NPCS = [
    { name: 'Rosa',   color: 'RosyBrown',   seed: 412, home: { x: 1620, y: 1560 }, roam: 240, near: 'el Parterre',
      gift: { emoji: '🌷', name: 'un tulipán' },
      lines: ['buenas!', '¿qué tal el día?', 'qué solecito hace hoy', 'riego las flores y vuelvo'] },
    { name: 'Tomás',  color: 'SaddleBrown', seed: 77,  home: { x: 4300, y: 2360 }, roam: 260, near: 'el Monumento',
      gift: { emoji: '☕', name: 'un café' },
      lines: ['hombre, cuánto tiempo', '¿bajamos al estanque?', 'me he dejado las llaves…', 'invito a un café'] },
    { name: 'Lola',   color: 'PaleVioletRed', seed: 935, home: { x: 1560, y: 3420 }, roam: 230, near: 'la Rosaleda',
      gift: { emoji: '🌹', name: 'una rosa' },
      lines: ['huele a rosas, ¿eh?', 'siéntate un rato', '¿has visto a mi gato?', 'qué gusto de tarde'] },
    { name: 'Paco',   color: 'Olive',       seed: 248, home: { x: 3260, y: 4280 }, roam: 220, near: 'Cuesta de Moyano',
      gift: { emoji: '🔖', name: 'un marcapáginas' },
      lines: ['¿un libro de viejo?', 'aquí, dando una vuelta', 'me han traído carta hoy', 'ay, mis rodillas'] },
    { name: 'Marisa', color: 'CadetBlue',   seed: 561, home: { x: 3160, y: 960 },  roam: 210, near: 'la Casita del Pescador',
      gift: { emoji: '🐚', name: 'una concha' },
      lines: ['¿pican los peces?', 'desde aquí se ve todo', 'tranquilo esto, ¿verdad?', 'me sé un atajo'] },
    { name: 'Quique', color: 'DarkCyan',    seed: 1330, home: { x: 4760, y: 3300 }, roam: 230, near: 'el Palacio de Cristal',
      gift: { emoji: '📷', name: 'una polaroid' },
      lines: ['mira qué cristales', 'te hago una foto', '¿posas un segundo?', 'qué luz más bonita'] },
  ]

  // ─── Tablón del barrio (muro de fotos) ───────────────────────────────────
  // Junto al estanque/Monumento (el corazón social = "el feed"). Las fotos que
  // entregas en los buzones de los vecinos se cuelgan aquí. Clicar abre el muro.
  // 👉 Esta es la COSTURA donde enchufarán las fotos cuadradas reales más adelante.
  const TABLON = { x: 4430, y: 2370, label: 'Tablón del barrio' }

  // Image asset manifest. Keys: 'building:<zoneId>', 'deco:<kind>:<variant>',
  // 'tile:<name>'. Files under /img/. Missing files → procedural fallback.
  // (M5 del port: aquí entran los PNGs recortados de Elthen, slot a slot.)
  const ASSET_MANIFEST = {
    // Cainos — Pixel Art Top Down Basic (gratis + comercial). Atlas de tiles;
    // el render recorta sub-celdas. Crédito en ASSETS_LICENSES.md.
    'cainos:grass':  '/img/cainos/grass.png',
    'cainos:stone':  '/img/cainos/stone.png',
    'cainos:plant':  '/img/cainos/plant.png',
    'cainos:props':  '/img/cainos/props.png',
    'cainos:wall':   '/img/cainos/wall.png',
    'cainos:struct': '/img/cainos/struct.png',
  }

  window.CityConfig = {
    W, H, PLAYER_SPEED, PLAYER_SIZE,
    ZONES, PLAZA, FOUNTAIN, SPAWN,
    VERJA, WATER, PASEOS, PATH_GRID, PATH_SEGMENTS, ESTANQUE, MONUMENT, GATES,
    DECO_BUILDINGS, TREES, LAMPS, NPCS, TABLON,
    ASSET_MANIFEST,
  }
})()

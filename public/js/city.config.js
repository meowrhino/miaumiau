// CityConfig — world constants, zone/deco/decoration data.
// Loaded BEFORE city.js so the latter can destructure these locals at the top of its IIFE.
;(function () {
  // Top-down 3/4 perspective (Stardew / Pokémon style). World units == screen
  // units (1:1) before camera scale; the camera handles centering and zoom.
  const W = 1280, H = 720
  const PLAYER_SPEED = 200  // px/sec
  const PLAYER_SIZE = 56    // sprite render size

  // 6 zones placed asymmetrically across an organic village (no hex/circle pattern).
  // Plaza sits SW (descentrada). Functional houses are spread out and mixed with
  // decorative buildings (cottages, bakery, workshop, barn, mill, well, stalls, stage)
  // so the world feels like a real lived-in town, not a 3x2 grid.
  const ZONES = [
    { id: 'tweets',  name: 'el café',     x: 80,  y: 90,  w: 180, h: 140, color: '#f0a85a', mascotColor: '#FFB800', habitat: 'tweets',  building: '☕', roof: '#c97a3a' },
    { id: 'posts',   name: 'el tablón',   x: 470, y: 320, w: 180, h: 140, color: '#5fa3d8', mascotColor: '#007AFF', habitat: 'posts',   building: '📌', roof: '#3877a6' },
    { id: 'stories', name: 'el miradero', x: 920, y: 70,  w: 180, h: 140, color: '#7a3a8e', mascotColor: '#BF7BD9', habitat: 'stories', building: '🌙', roof: '#552366' },
    { id: 'chat',    name: 'el banquito', x: 100, y: 450, w: 180, h: 140, color: '#4abd76', mascotColor: '#34C759', habitat: 'chat',    building: '🪑', roof: '#2f8f56' },
    { id: 'bereal',  name: 'la polaroid', x: 600, y: 100, w: 180, h: 140, color: '#ff8a3c', mascotColor: '#FF9500', habitat: 'bereal',  building: '📷', roof: '#cc6320' },
    { id: 'profile', name: 'tu casa',     x: 950, y: 420, w: 180, h: 140, color: '#a87dd8', mascotColor: '#BF7BD9', habitat: 'profile', building: '🏠', roof: '#7e54a8' },
  ]

  // Plaza descentrada al SO — fountain + stage + market stalls + well live here.
  const PLAZA = { x: 400, y: 510, rx: 200, ry: 110 }
  const FOUNTAIN = { x: 380, y: 510, r: 36 }

  // Spawning point — runa al norte del plaza, donde aparecen los recién
  // llegados al pueblo. Visualmente se dibuja un círculo rúnico pulsante
  // sobre el cobble; sirve de "te encuentras aquí" + ritual de bienvenida.
  const SPAWN = { x: 400, y: 460 }

  // Decorative buildings — visual filler so the village reads as a pueblo, not a hexagon.
  // None of these are interactive (no doormat trigger). They depth-sort with everything else.
  const DECO_BUILDINGS = [
    { kind: 'cottage', seed: 11, x: 330, y: 210, h: 100 },  // top: between cafe and polaroid
    { kind: 'cottage', seed: 22, x: 800, y: 240, h: 100 },  // middle: behind polaroid/miradero
    { kind: 'cottage', seed: 33, x: 1180, y: 210, h: 100 }, // NE corner, neighbour to miradero
    { kind: 'cottage', seed: 44, x: 60,  y: 350, h: 100 },  // far W, between cafe & banquito
    { kind: 'bakery',  x: 740,  y: 470, h: 110 },           // commercial near tablon
    { kind: 'workshop', x: 1140, y: 580, h: 110 },          // SE near tu casa
    { kind: 'barn',    x: 880,  y: 660, h: 100 },           // far S behind zones
    { kind: 'mill',    x: 1200, y: 200, h: 200 },           // NE tall, decorative landmark
    { kind: 'well',    x: 480,  y: 600, h: 70 },            // in plaza
    { kind: 'stage',   x: 320,  y: 590, h: 60 },            // in plaza
    { kind: 'stall',   seed: 7,  x: 540, y: 555, h: 64 },   // plaza market
    { kind: 'stall',   seed: 13, x: 600, y: 595, h: 64 },
  ]

  // Static decorations: trees, lamps. Hand-placed for "lived-in" feel.
  const TREES = [
    { x: 30,  y: 280 }, { x: 270, y: 80 },  { x: 430, y: 70 },
    { x: 720, y: 90 },  { x: 1080, y: 240 }, { x: 1240, y: 380 },
    { x: 50,  y: 580 }, { x: 380, y: 280 }, { x: 820, y: 380 },
    { x: 1200, y: 540 }, { x: 700, y: 660 },
  ]
  const LAMPS = [
    { x: 260, y: 460 }, { x: 540, y: 460 }, { x: 280, y: 600 },
  ]

  // Image asset manifest. Keys are namespaced ('building:<zoneId>',
  // 'deco:<kind>:<variant>', 'tile:<name>'). Files live under /img/. Missing
  // files automatically fall back to the procedural sprites in sprites.js.
  // Source: Sprout Lands by Cup Nooble (see ASSETS_LICENSES.md).
  const ASSET_MANIFEST = {
    'tile:grass_sheet':  '/img/tiles/grass_sheet.png',
    'tile:house_sheet':  '/img/buildings/house_sheet.png',
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

  // Sprout Lands grass sheet — tile coords (x,y,w,h) of a clean grass tile.
  // The sheet is 176×400 with 16-px tiles. Bottom rows hold full grass
  // blocks; each block has scattered details. Offsets here pick the tile
  // that paints best when tiled across the world without visible seams.
  const GRASS_TILE_RECT = { sx: 96, sy: 224, sw: 16, sh: 16 }

  // Sprout Lands house sheet (192×192, 3×3 grid of 64-px houses, 9 colors).
  // Per-zone sub-rect picks the variant whose roof tone matches the zone's
  // identity. Used by drawBuilding when 'tile:house_sheet' is loaded.
  // Grid layout (col, row): blue, green, pink / yellow, orange, brown / red, purple, gray.
  const HOUSE_RECTS = {
    tweets:  { sx: 64,  sy: 64,  sw: 64, sh: 64 }, // orange — café
    posts:   { sx: 0,   sy: 0,   sw: 64, sh: 64 }, // blue — tablón
    stories: { sx: 64,  sy: 128, sw: 64, sh: 64 }, // purple — miradero
    chat:    { sx: 64,  sy: 0,   sw: 64, sh: 64 }, // green — banquito
    bereal:  { sx: 0,   sy: 64,  sw: 64, sh: 64 }, // yellow — polaroid
    profile: { sx: 128, sy: 0,   sw: 64, sh: 64 }, // pink — tu casa
  }

  // Per-zone anchors expressed as ratios of the rendered sprite (0..1).
  // Used by drawHouseOverlay so smoke/flag/glow can sit correctly on each PNG.
  // Tweak per-sprite when real assets land.
  const ZONE_ANCHORS = {
    tweets:  { chimney: [0.69, 0.05], door: [0.50, 0.78], window: [0.30, 0.66] },
    posts:   { flag:    [0.56, 0.05], door: [0.50, 0.78], window: [0.32, 0.66] },
    stories: { telescope: [0.50, 0.18], door: [0.50, 0.78], window: [0.30, 0.66] },
    chat:    { bubble:  [0.62, 0.10], door: [0.50, 0.78], window: [0.30, 0.66] },
    bereal:  { lens:    [0.50, 0.42], door: [0.50, 0.78] },
    profile: { heart:   [0.50, 0.78], door: [0.50, 0.78] },
  }

  window.CityConfig = {
    W, H, PLAYER_SPEED, PLAYER_SIZE,
    ZONES, PLAZA, FOUNTAIN, SPAWN,
    DECO_BUILDINGS, TREES, LAMPS,
    ASSET_MANIFEST, ZONE_ANCHORS, GRASS_TILE_RECT, HOUSE_RECTS,
  }
})()

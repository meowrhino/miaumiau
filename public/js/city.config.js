// CityConfig — world constants, zone/deco/decoration data.
// Loaded BEFORE city.js so the latter can destructure these locals at the top of its IIFE.
;(function () {
  // Top-down 3/4 perspective (Stardew / Pokémon style). World units == screen
  // units (1:1) before camera scale; the camera handles centering and zoom.
  const W = 1280, H = 720
  const PLAYER_SPEED = 200  // px/sec
  const PLAYER_SIZE = 56    // sprite render size

  // 6 zones grouped into 3 islands. Each island clusters 2 zones whose mood
  // pairs naturally (relax/social NW, visual NE, intimate SE). Plaza sits in
  // the middle and connects to all 3 islands via short bridges.
  const ZONES = [
    // ─── ISLA NW (relax / social) ───
    { id: 'tweets',  name: 'el café',     x: 80,  y: 100, w: 180, h: 140, color: '#f0a85a', mascotColor: '#FFB800', habitat: 'tweets',  building: '☕', roof: '#c97a3a' },
    { id: 'posts',   name: 'el tablón',   x: 240, y: 180, w: 180, h: 140, color: '#5fa3d8', mascotColor: '#007AFF', habitat: 'posts',   building: '📌', roof: '#3877a6' },
    // ─── ISLA NE (visual / alta) ───
    { id: 'stories', name: 'el miradero', x: 850,  y: 80,  w: 180, h: 140, color: '#7a3a8e', mascotColor: '#BF7BD9', habitat: 'stories', building: '🌙', roof: '#552366' },
    { id: 'bereal',  name: 'la polaroid', x: 1050, y: 180, w: 180, h: 140, color: '#ff8a3c', mascotColor: '#FF9500', habitat: 'bereal',  building: '📷', roof: '#cc6320' },
    // ─── ISLA SE (íntima / cozy) ───
    { id: 'chat',    name: 'el banquito', x: 800,  y: 480, w: 180, h: 140, color: '#4abd76', mascotColor: '#34C759', habitat: 'chat',    building: '🪑', roof: '#2f8f56' },
    { id: 'profile', name: 'tu casa',     x: 1020, y: 540, w: 180, h: 140, color: '#a87dd8', mascotColor: '#BF7BD9', habitat: 'profile', building: '🏠', roof: '#7e54a8' },
  ]

  // Plaza central — fountain + stage + market stalls + well live here.
  const PLAZA = { x: 640, y: 490, rx: 170, ry: 110 }
  const FOUNTAIN = { x: 640, y: 490, r: 36 }

  // Spawning point — runa en plaza norte (los recién llegados aparecen aquí).
  const SPAWN = { x: 640, y: 420 }

  // Three islands surround the plaza. ISLAND_R is the corner radius applied
  // by drawShoreline + the grass clip so each island reads as land, not as
  // a floating rectangle.
  const ISLAND_R = 36
  const ISLANDS = [
    { id: 'nw', x: 40,  y: 60,  w: 400, h: 290, r: ISLAND_R },
    { id: 'ne', x: 820, y: 40,  w: 420, h: 320, r: ISLAND_R },
    { id: 'se', x: 760, y: 460, w: 480, h: 240, r: ISLAND_R },
  ]

  // Bridges connect plaza ↔ each island. Each bridge is a fat rectangle
  // along the line (ax,ay)→(bx,by). drawn as wooden planks with a darker
  // edge ring; depth-sorted with everything else.
  const BRIDGES = [
    { ax: 484, ay: 414, bx: 432, by: 340, w: 26 }, // plaza NW corner → island NW SE corner
    { ax: 796, ay: 414, bx: 824, by: 340, w: 26 }, // plaza NE corner → island NE SW corner
    { ax: 808, ay: 510, bx: 760, by: 532, w: 26 }, // plaza E         → island SE W edge
  ]

  // Decorative buildings — distributed so each island feels lived-in.
  const DECO_BUILDINGS = [
    // ISLA NW
    { kind: 'cottage', seed: 11, x: 130, y: 90,  h: 90 },
    { kind: 'cottage', seed: 44, x: 400, y: 110, h: 90 },
    // ISLA NE
    { kind: 'cottage', seed: 22, x: 920, y: 320, h: 90 },
    { kind: 'cottage', seed: 33, x: 1190, y: 60, h: 90 },
    { kind: 'mill',    x: 1190, y: 230, h: 180 },
    // ISLA SE
    { kind: 'bakery',   x: 820,  y: 670, h: 100 },
    { kind: 'workshop', x: 1180, y: 490, h: 100 },
    { kind: 'barn',     x: 990,  y: 690, h: 90 },
    // PLAZA
    { kind: 'well',  x: 720, y: 540, h: 60 },
    { kind: 'stage', x: 560, y: 540, h: 50 },
    { kind: 'stall', seed: 7,  x: 580, y: 460, h: 56 },
    { kind: 'stall', seed: 13, x: 700, y: 460, h: 56 },
  ]

  // Trees scattered across the islands.
  const TREES = [
    // ISLA NW
    { x: 60, y: 110 }, { x: 260, y: 80 }, { x: 90, y: 320 }, { x: 420, y: 300 },
    // ISLA NE
    { x: 830, y: 70 }, { x: 1090, y: 70 }, { x: 1240, y: 350 },
    // ISLA SE
    { x: 770, y: 480 }, { x: 1230, y: 560 }, { x: 1000, y: 690 },
  ]
  // One lamp per bridge (cozy night vibe at the crossings).
  const LAMPS = [
    { x: 458, y: 377 }, // bridge NW
    { x: 810, y: 377 }, // bridge NE
    { x: 784, y: 521 }, // bridge SE
  ]

  // Image asset manifest. Keys are namespaced ('building:<zoneId>',
  // 'deco:<kind>:<variant>', 'tile:<name>'). Files live under /img/. Missing
  // files automatically fall back to the procedural sprites in sprites.js.
  // Source: Sprout Lands by Cup Nooble (see ASSETS_LICENSES.md).
  const ASSET_MANIFEST = {
    'tile:grass_sheet':  '/img/tiles/grass_sheet.png',
    'tile:house_sheet':  '/img/buildings/house_sheet.png',
    'tile:trees_sheet':  '/img/deco/trees_sheet.png',
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

  // Sprout Lands trees sheet (192×128). Tree variants cycle by index so the
  // forest doesn't read as copy-paste. Top row holds mature trees in 32×48
  // cells; we pick four with distinct silhouettes/colours.
  const TREE_RECTS = [
    { sx: 0,   sy: 0, sw: 32, sh: 48 }, // fluffy dark
    { sx: 32,  sy: 0, sw: 32, sh: 48 }, // fluffy light
    { sx: 96,  sy: 0, sw: 32, sh: 48 }, // alt canopy
    { sx: 160, sy: 0, sw: 32, sh: 48 }, // pine-like
  ]

  // Decorative cottages cycle through unused slots of the house sheet so each
  // cottage in the village gets a different roof colour. Index = seed % 4.
  const COTTAGE_RECTS = [
    { sx: 128, sy: 64,  sw: 64, sh: 64 }, // brown — slot (2,1) unused by zones
    { sx: 0,   sy: 128, sw: 64, sh: 64 }, // red — slot (0,2)
    { sx: 128, sy: 128, sw: 64, sh: 64 }, // gray — slot (2,2)
    { sx: 64,  sy: 64,  sw: 64, sh: 64 }, // orange (reuse — small village ok)
  ]

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
    ISLANDS, ISLAND_R, BRIDGES,
    DECO_BUILDINGS, TREES, LAMPS,
    ASSET_MANIFEST, ZONE_ANCHORS,
    GRASS_TILE_RECT, HOUSE_RECTS, TREE_RECTS, COTTAGE_RECTS,
  }
})()

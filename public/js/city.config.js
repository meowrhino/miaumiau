// CityConfig — world constants, zone/deco/decoration data, iso projection helpers.
// Loaded BEFORE city.js so the latter can destructure these locals at the top of its IIFE.
;(function () {
  // World units (game logic uses these — zones, paths, fountain are placed in this space).
  // Game logic stays in flat top-down (x/y on the ground plane). The renderer
  // projects every position through an isometric camera before painting.
  const W = 1280, H = 720
  const PLAYER_SPEED = 200  // px/sec
  const PLAYER_SIZE = 56    // sprite render size

  // ─── Isometric camera (Habbo / Club Penguin style) ──────────────────────────
  // 2:1 dimétrica: 1 world tile is 2 screen units wide and 1 tall.
  //   screenX = (worldX − worldY)
  //   screenY = (worldX + worldY) * 0.5
  // The world bbox in screen units is therefore (W+H) wide × (W+H)/2 tall;
  // a horizontal offset of H * scale shifts negative screenX into the viewport.
  const ISO_BBOX_W = W + H        // 2000 with W=1280, H=720
  const ISO_BBOX_H = (W + H) / 2  // 1000
  function w2s(wx, wy) {
    return { sx: (wx - wy), sy: (wx + wy) * 0.5 }
  }
  function s2w(sx, sy) {
    return { wx: sy + sx * 0.5, wy: sy - sx * 0.5 }
  }

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
  // 'deco:<kind>:<variant>', etc). Files live under /img/. Missing files
  // automatically fall back to the procedural sprites in sprites.js.
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
    ISO_BBOX_W, ISO_BBOX_H,
    w2s, s2w,
    ZONES, PLAZA, FOUNTAIN, SPAWN,
    DECO_BUILDINGS, TREES, LAMPS,
    ASSET_MANIFEST, ZONE_ANCHORS,
  }
})()

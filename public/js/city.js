// City — Phase 1: solo player. Canvas with 6 zones. WASD/click-to-walk.
// Zone detection emits enter:zone events. No networking yet.
//
// World constants and zone/deco/decoration data live in city.config.js as
// `window.CityConfig`. We destructure them locally here.
;(function () {
  const {
    W, H, PLAYER_SPEED, PLAYER_SIZE,
    ZONES, PLAZA, FOUNTAIN, SPAWN,
    ISLANDS, ISLAND_R, BRIDGES,
    DECO_BUILDINGS, TREES, LAMPS,
    ASSET_MANIFEST, ZONE_ANCHORS,
  } = window.CityConfig

  // Returns 'nw' | 'ne' | 'se' | 'plaza' | 'bridge' | null for a world point.
  // Used by pathfinding to decide if click-to-walk needs to route via plaza.
  function whichLand(x, y) {
    for (const isl of ISLANDS) {
      const left = isl.x, top = isl.y
      const right = isl.x + isl.w, bottom = isl.y + isl.h
      if (x < left || x > right || y < top || y > bottom) continue
      const r = isl.r || ISLAND_R
      if (x < left + r && y < top + r    && Math.hypot(x - (left+r),  y - (top+r))    > r) continue
      if (x > right - r && y < top + r   && Math.hypot(x - (right-r), y - (top+r))    > r) continue
      if (x < left + r && y > bottom - r && Math.hypot(x - (left+r),  y - (bottom-r)) > r) continue
      if (x > right - r && y > bottom - r&& Math.hypot(x - (right-r), y - (bottom-r)) > r) continue
      return isl.id
    }
    const px = (x - PLAZA.x) / PLAZA.rx, py = (y - PLAZA.y) / PLAZA.ry
    if (px*px + py*py <= 1) return 'plaza'
    if (BRIDGES) {
      for (const br of BRIDGES) {
        const dx = br.bx - br.ax, dy = br.by - br.ay
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len, uy = dy / len
        const nx = -uy, ny = ux
        const rx = x - br.ax, ry = y - br.ay
        const along = rx * ux + ry * uy
        const across = rx * nx + ry * ny
        if (along >= 0 && along <= len && Math.abs(across) <= br.w/2) return 'bridge'
      }
    }
    return null
  }

  // Land collision: returns true if the world point (x,y) is on walkable
  // ground (one of the 3 islands, the plaza ellipse, or a bridge).
  // Rounded-rect islands: inside bbox AND outside the corner exclusion arcs.
  function pointInLand(x, y) {
    for (const isl of ISLANDS) {
      const left = isl.x, top = isl.y
      const right = isl.x + isl.w, bottom = isl.y + isl.h
      if (x < left || x > right || y < top || y > bottom) continue
      const r = isl.r || ISLAND_R
      if (x < left + r && y < top + r)    { if (Math.hypot(x - (left+r),  y - (top+r))    > r) continue }
      if (x > right - r && y < top + r)   { if (Math.hypot(x - (right-r), y - (top+r))    > r) continue }
      if (x < left + r && y > bottom - r) { if (Math.hypot(x - (left+r),  y - (bottom-r)) > r) continue }
      if (x > right - r && y > bottom - r){ if (Math.hypot(x - (right-r), y - (bottom-r)) > r) continue }
      return true
    }
    // Plaza (ellipse)
    const px = (x - PLAZA.x) / PLAZA.rx, py = (y - PLAZA.y) / PLAZA.ry
    if (px*px + py*py <= 1) return true
    // Bridges (rotated rect from ax,ay → bx,by, half-width br.w/2 perpendicular)
    if (BRIDGES) {
      for (const br of BRIDGES) {
        const dx = br.bx - br.ax, dy = br.by - br.ay
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len, uy = dy / len
        const nx = -uy, ny = ux
        const rx = x - br.ax, ry = y - br.ay
        const along = rx * ux + ry * uy
        const across = rx * nx + ry * ny
        if (along >= 0 && along <= len && Math.abs(across) <= br.w/2) return true
      }
    }
    return false
  }

  const City = {
    canvas: null, ctx: null,
    raf: 0,
    last: 0,
    keys: { up: false, down: false, left: false, right: false },
    target: null,        // current waypoint {x,y}
    targetQueue: null,   // remaining waypoints after `target` (for routing)
    player: { x: SPAWN.x, y: SPAWN.y, dir: 0, walking: false, color: 'Coral' },
    currentZone: null,
    mascots: {},  // zoneId → poporing img bitmap
    others: [],          // [{user_id, zone, x, y, username, color, avatar_seed, sprite}]
    otherSprites: {},    // user_id → Image
    pollTimer: 0,
    wavesTimer: 0,
    _wavesSeen: new Set(),
    lastPresenceWrite: 0,
    lastPresenceState: null,
    // Image-asset feature flag. Set _assetWhitelist=null when all PNGs are in.
    useImageAssets: true,
    _assetWhitelist: null,  // Set<zoneId|decoKind> | null (null = use for everything)
    _assetsReady: false,

    // Camera (top-down world coords). zoom = 1 is fit-to-bbox.
    // mode: 'desktop' (fixed centered) | 'mobile-follow' (lerps toward player)
    //       | 'mobile-free' (user took control via pan)
    camera: {
      x: 640, y: 360,                // = (W/2, H/2)
      zoom: 1,
      targetX: 640, targetY: 360,
      targetZoom: 1,
      mode: 'desktop',
    },
    input: {
      pointers: new Map(),           // pointerId → {x, y, startX, startY, startTime}
      panAnchorWorld: null,          // {x, y} world point under pointer at pan-start
      hasMoved: false,
      isPanning: false,
      isPinching: false,
      pinchDist0: 0,
      pinchZoom0: 1,
    },

    enter() {
      const sec = document.getElementById('mode-city')
      if (!sec) return
      sec.hidden = false
      City.canvas = document.getElementById('cityCanvas')
      if (!City.canvas) return
      City.ctx = City.canvas.getContext('2d')
      // Pick camera mode from viewport, then sync target so first frame is correct.
      City.applyCameraMode(City.detectCameraMode())
      City.camera.x = City.camera.targetX
      City.camera.y = City.camera.targetY
      City.camera.zoom = City.camera.targetZoom
      City.fitCanvas()
      window.addEventListener('resize', City.onResize)

      // Player avatar source
      if (App.user) {
        City.player.color = App.user.color || 'Coral'
        City.loadPlayerSprite()
      }
      // Mascot poporings (one per zone)
      City.loadMascots()
      // Pixel-art world sprites (houses, trees, fountain, lamp, ground tiles)
      City.loadSprites()
      City.render(0)
      City.bind()
      City.last = performance.now()
      cancelAnimationFrame(City.raf)
      City.raf = requestAnimationFrame(City.tick)

      // Presence: write own + poll others + waves broadcast
      City.writePresence(true)
      clearInterval(City.pollTimer)
      City.pollTimer = setInterval(() => City.fetchOthers(), 5000)
      City.fetchOthers()
      clearInterval(City.wavesTimer)
      City.wavesTimer = setInterval(() => City.fetchWaves(), 3500)
      City.fetchWaves()
    },

    onResize() {
      // On resize, re-pick camera mode (laptop ↔ phone via DevTools, orientation change, etc.)
      // Don't override mobile-free (user took control of camera) — just refit and clamp.
      const newMode = City.detectCameraMode()
      if (City.camera.mode !== 'mobile-free') City.applyCameraMode(newMode)
      City.fitCanvas()
      City.clampCamera()
    },

    leave() {
      cancelAnimationFrame(City.raf)
      City.unbind()
      window.removeEventListener('resize', City.onResize)
      clearInterval(City.pollTimer)
      clearInterval(City.wavesTimer)
      // Optional: clear presence on leave (best-effort)
      if (App.user && window.API) API.del('/city/presence').catch(() => {})
    },

    // ─── Camera + fitCanvas (fitCanvas, detectCameraMode, applyCameraMode,
    //     clampCamera, recenterCamera, updateRecenterButton) live in
    //     city.camera.js (loaded after this file). ───

    loadPlayerSprite() {
      const seed = App.user.avatar_seed ?? 0
      const svg = (typeof generateCatSvg === 'function') ? generateCatSvg(seed, App.user.color) : null
      if (!svg) return
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => { City.player.sprite = img; URL.revokeObjectURL(url) }
      img.src = url
    },

    loadSprites() {
      // Kick off image asset preload (non-blocking). Renderer falls back to
      // procedural sprites for any key that hasn't loaded yet.
      if (window.Assets && City.useImageAssets) {
        Assets.load(ASSET_MANIFEST).then(() => { City._assetsReady = true })
      }
      if (typeof MiauSprites === 'undefined') return
      const ownerHex = (App.user && typeof colorHex === 'function') ? colorHex(App.user.color) : '#FFB800'
      const houses = {}
      ZONES.forEach(z => {
        houses[z.id] = MiauSprites.house(z.id, z.roof, z.id === 'profile' ? ownerHex : null)
      })
      // Tree variants per position
      const trees = TREES.map((_, i) => {
        const seed = i * 31 + 7
        const v = i % 4
        if (v === 0) return MiauSprites.treeLush(seed)
        if (v === 1) return MiauSprites.treeSakura(seed)
        if (v === 2) return MiauSprites.treePine(seed)
        return MiauSprites.treeLush(seed + 13)
      })
      // Deco buildings — pre-render each one. Cottages get a seeded roof color so
      // they don't all match.
      const deco = DECO_BUILDINGS.map(d => {
        if (d.kind === 'cottage')  return MiauSprites.cottage(d.seed, null)
        if (d.kind === 'bakery')   return MiauSprites.bakery()
        if (d.kind === 'workshop') return MiauSprites.workshop()
        if (d.kind === 'barn')     return MiauSprites.barn()
        if (d.kind === 'mill')     return MiauSprites.mill()
        if (d.kind === 'well')     return MiauSprites.well()
        if (d.kind === 'stage')    return MiauSprites.stage()
        if (d.kind === 'stall')    return MiauSprites.marketStall(d.seed || 1)
        return null
      })
      City.sprites = {
        house: houses,
        trees,
        deco,
        bushes: [MiauSprites.bush(11), MiauSprites.bush(22), MiauSprites.bush(33), MiauSprites.bush(44)],
        flowers: [MiauSprites.flowerPatch(55), MiauSprites.flowerPatch(66), MiauSprites.flowerPatch(77)],
        fountain: MiauSprites.fountain(),
        lamp: MiauSprites.lampPost(),
        bench: MiauSprites.bench(),
        fence: MiauSprites.fence(),
        grass: MiauSprites.grassTile(123),
        cobble: MiauSprites.cobbleTile(),
        dirt: MiauSprites.dirtPathTile(),
        clouds: [MiauSprites.cloud(11), MiauSprites.cloud(22), MiauSprites.cloud(33)],
      }
    },

    loadMascots() {
      // Each zone has a curated poporing that's *visually distinct* from a
      // regular user poporing: a non-default body size + exotic trait combo
      // that fits the zone's mood. Render size on screen also varies.
      const MASCOT_SPEC = {
        tweets:  { size: 'big',   render: 76, traits: { eyes: 'sleepy',  mouth: 'open',   cheeks: 'freckles', headTop: 'leaf' } },     // barista grandote dormido
        posts:   { size: 'tiny',  render: 44, traits: { eyes: 'sparkle', mouth: 'cat',    cheeks: 'blush',    headTop: 'droplet' } }, // chiquitín alerta con bandera
        stories: { size: 'big',   render: 78, traits: { eyes: 'star',    mouth: 'o',      cheeks: 'blush',    headTop: 'antenna' } }, // místico mirando lunas
        chat:    { size: 'small', render: 56, traits: { eyes: 'heart',   mouth: 'smile',  cheeks: 'blush',    headTop: 'none' } },    // simpático del banquito
        bereal:  { size: 'tiny',  render: 46, traits: { eyes: 'round',   mouth: 'tongue', cheeks: 'freckles', headTop: 'spike' } },   // travieso fotógrafo
        profile: { size: 'big',   render: 74, traits: { eyes: 'heart',   mouth: 'smirk',  cheeks: 'blush',    headTop: 'antenna' } }, // anfitrión cariñoso
      }
      City.mascotSizes = {}
      ZONES.forEach(z => {
        if (typeof generatePoporingFromTraits !== 'function') return
        const spec = MASCOT_SPEC[z.id] || { size: 'normal', render: 56, traits: {} }
        City.mascotSizes[z.id] = spec.render
        const svg = generatePoporingFromTraits(spec.traits, z.mascotColor, spec.size)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => { City.mascots[z.id] = img; URL.revokeObjectURL(url) }
        img.src = url
      })
    },

    // ─── Input handlers (bind/unbind, onPointer*, onWheel, onKey, onMove,
    //     onLeave, onEsc, canvasCoords, findOtherAt, findZoneMascotAt,
    //     isInputBlocked, onPointer, teleportToZone) live in city.input.js. ───
    // ─── Sheet logic (openSheet/closeSheet/openSheetForHabitat/checkZone)
    //     live in city.sheet.js. Both load after this file. ───


    // ─── Presence (writePresence, fetchOthers, fetchWaves, MASCOT_COORDS,
    //     writePresenceForMode) live in city.presence.js (loaded after this file). ───

    tick(now) {
      const dt = Math.min(0.05, (now - City.last) / 1000)
      City.last = now
      const p = City.player
      let vx = 0, vy = 0
      if (City.keys.up) vy -= 1
      if (City.keys.down) vy += 1
      if (City.keys.left) vx -= 1
      if (City.keys.right) vx += 1
      const usingKeys = vx !== 0 || vy !== 0

      if (!usingKeys && City.target) {
        const dx = City.target.x - p.x
        const dy = City.target.y - p.y
        const d = Math.hypot(dx, dy)
        if (d < 4) { City.target = null; p.walking = false }
        else { vx = dx / d; vy = dy / d }
      }

      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy) || 1
        const stepX = (vx / len) * PLAYER_SPEED * dt
        const stepY = (vy / len) * PLAYER_SPEED * dt
        // Try X and Y independently so the player slides along land edges
        // instead of getting stuck on diagonal moves toward the shoreline.
        if (pointInLand(p.x + stepX, p.y)) p.x += stepX
        if (pointInLand(p.x, p.y + stepY)) p.y += stepY
        // If a click target is unreachable (point in water), drop it so we
        // don't bounce against the shore forever.
        if (City.target && !pointInLand(City.target.x, City.target.y)) {
          City.target = null
          City.targetQueue = null
        }
        p.walking = true
        if (vx < -0.1) p.dir = 1
        else if (vx > 0.1) p.dir = 0
      } else {
        p.walking = false
        // Reached current target. If there are queued waypoints, advance.
        if (!City.target && City.targetQueue && City.targetQueue.length) {
          City.target = City.targetQueue.shift()
        }
      }
      // Hard world bounds (in case islands are ever moved past the edge).
      p.x = Math.max(40, Math.min(W - 40, p.x))
      p.y = Math.max(40, Math.min(H - 40, p.y))
      City.checkZone()
      // Throttled presence write while moving
      if (p.walking) City.writePresence(false)

      // Camera: follow player in mobile-follow, lerp toward targets, refit transform.
      if (City.camera.mode === 'mobile-follow') {
        City.camera.targetX = City.player.x
        City.camera.targetY = City.player.y
      }
      const k = 0.18
      City.camera.x += (City.camera.targetX - City.camera.x) * k
      City.camera.y += (City.camera.targetY - City.camera.y) * k
      City.camera.zoom += (City.camera.targetZoom - City.camera.zoom) * k
      City.clampCamera()
      City.fitCanvas()
      City.updateRecenterButton()

      City.render(now)
      City.raf = requestAnimationFrame(City.tick)
    },

    // ─── render + draw* (drawGround, drawBuilding, drawDecoBuilding,
    //     drawHouseOverlay, drawFountain, drawTree, drawLamp, drawOther,
    //     drawPlayer, drawHud) live in city.render.js (loaded after this file). ───

  }

  // ─── Other-poporing tooltip + popover live in city.tooltip.js (loaded after this file) ───
  // ─── Presence (MASCOT_COORDS, writePresenceForMode, etc) live in city.presence.js ───

  // Bridge index by island id. Order in config matters: BRIDGES[0]=NW etc.
  const BRIDGE_BY_ISLAND = { nw: BRIDGES[0], ne: BRIDGES[1], se: BRIDGES[2] }

  // Pathfinding helper: build a waypoint queue so click-to-walk auto-routes
  // through bridges instead of getting stuck on the shore. Each bridge has
  // (ax,ay) on the plaza side and (bx,by) on the island side.
  //
  //   player on isla X, target on isla X     → direct
  //   player in plaza,  target on isla X     → bridge X plaza-side, bridge X island-side, target
  //   player on isla X, target in plaza      → bridge X island-side, bridge X plaza-side, target
  //   player on isla X, target on isla Y     → bridge X (cross), plaza, bridge Y (cross), target
  //   player on bridge → treat as "plaza" for this purpose (close enough)
  City.setWalkTarget = function (x, y) {
    if (!pointInLand(x, y)) { City.target = null; City.targetQueue = null; return }
    const pLand = whichLand(City.player.x, City.player.y)
    const tLand = whichLand(x, y)
    const isIsland = (k) => k === 'nw' || k === 'ne' || k === 'se'
    const wp = []  // waypoints to traverse before the final (x,y)
    if (isIsland(pLand) && isIsland(tLand) && pLand !== tLand) {
      const a = BRIDGE_BY_ISLAND[pLand], b = BRIDGE_BY_ISLAND[tLand]
      wp.push({ x: a.bx, y: a.by }, { x: a.ax, y: a.ay })
      wp.push({ x: b.ax, y: b.ay }, { x: b.bx, y: b.by })
    } else if (isIsland(pLand) && (tLand === 'plaza' || tLand === 'bridge')) {
      const a = BRIDGE_BY_ISLAND[pLand]
      wp.push({ x: a.bx, y: a.by }, { x: a.ax, y: a.ay })
    } else if ((pLand === 'plaza' || pLand === 'bridge') && isIsland(tLand)) {
      const b = BRIDGE_BY_ISLAND[tLand]
      wp.push({ x: b.ax, y: b.ay }, { x: b.bx, y: b.by })
    }
    // First waypoint becomes target; remainder + final go in the queue.
    if (wp.length === 0) {
      City.target = { x, y }
      City.targetQueue = null
    } else {
      City.target = wp.shift()
      City.targetQueue = wp.concat([{ x, y }])
    }
  }
  // Expose collision predicates for debugging / future pathfinding work.
  City._pointInLand = pointInLand
  City._whichLand   = whichLand

  window.City = City

  // Tiny polyfill for roundRect (older Safari)
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w/2, h/2)
      this.moveTo(x + r, y)
      this.arcTo(x + w, y, x + w, y + h, r)
      this.arcTo(x + w, y + h, x, y + h, r)
      this.arcTo(x, y + h, x, y, r)
      this.arcTo(x, y, x + w, y, r)
      this.closePath()
    }
  }
})()

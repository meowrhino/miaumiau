// City — Phase 1: solo player. Canvas with 6 zones. WASD/click-to-walk.
// Zone detection emits enter:zone events. No networking yet.
//
// World constants and zone/deco/decoration data live in city.config.js as
// `window.CityConfig`. We destructure them locally here so the rest of this
// file keeps using bare `W`, `H`, `ZONES`, `w2s`, etc. — same names, same
// references, just one less inline block of declarations.
;(function () {
  const {
    W, H, PLAYER_SPEED, PLAYER_SIZE,
    ISO_BBOX_W, ISO_BBOX_H,
    w2s, s2w,
    ZONES, PLAZA, FOUNTAIN,
    DECO_BUILDINGS, TREES, LAMPS,
    ASSET_MANIFEST, ZONE_ANCHORS,
  } = window.CityConfig

  const City = {
    canvas: null, ctx: null,
    raf: 0,
    last: 0,
    keys: { up: false, down: false, left: false, right: false },
    target: null,  // {x,y} click-to-walk
    player: { x: PLAZA.x, y: PLAZA.y, dir: 0, walking: false, color: 'Coral' },
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

    fitCanvas() {
      if (!City.canvas) return
      const wrap = City.canvas.parentElement
      if (!wrap) return
      // Resize backing store only when needed (avoids losing context state every frame).
      const vw = wrap.clientWidth
      const vh = wrap.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const targetW = Math.round(vw * dpr)
      const targetH = Math.round(vh * dpr)
      if (City.canvas.width !== targetW || City.canvas.height !== targetH) {
        City.canvas.width = targetW; City.canvas.height = targetH
        City.canvas.style.width = vw + 'px'; City.canvas.style.height = vh + 'px'
      }
      // Camera-aware composition: baseScale fits the full iso bbox to viewport;
      // camera.zoom multiplies on top. Camera.x/y are top-down world coords;
      // we project them to iso to find the screen point we want at viewport center.
      const baseScale = Math.min(vw / ISO_BBOX_W, vh / ISO_BBOX_H)
      const scale = baseScale * City.camera.zoom
      const camIso = w2s(City.camera.x, City.camera.y)
      const ox = vw / 2 - camIso.sx * scale
      const oy = vh / 2 - camIso.sy * scale
      City._view = { scale, ox, oy, vw, vh, dpr, baseScale }
      City.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr, oy * dpr)
    },

    // Detect viewport mode for camera defaults.
    detectCameraMode() {
      const w = window.innerWidth
      const isCoarse = matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches
      return (w < 768 || isCoarse) ? 'mobile-follow' : 'desktop'
    },

    // Apply camera defaults for a given mode (zoom + target position).
    applyCameraMode(mode) {
      City.camera.mode = mode
      if (mode === 'desktop') {
        City.camera.targetZoom = 1
        City.camera.targetX = W / 2
        City.camera.targetY = H / 2
      } else if (mode === 'mobile-follow') {
        City.camera.targetZoom = 1.6
        City.camera.targetX = City.player.x
        City.camera.targetY = City.player.y
      }
      // mobile-free: leave target as-is (user is in control)
    },

    // Clamp camera so player roughly stays in world bounds. Slack lets the
    // grass spillover paint outside the world rect without revealing void.
    clampCamera() {
      const slack = 120
      const lo = -slack, hiX = W + slack, hiY = H + slack
      City.camera.x = Math.max(lo, Math.min(hiX, City.camera.x))
      City.camera.y = Math.max(lo, Math.min(hiY, City.camera.y))
      City.camera.targetX = Math.max(lo, Math.min(hiX, City.camera.targetX))
      City.camera.targetY = Math.max(lo, Math.min(hiY, City.camera.targetY))
      City.camera.zoom = Math.max(0.5, Math.min(3, City.camera.zoom))
      City.camera.targetZoom = Math.max(0.5, Math.min(3, City.camera.targetZoom))
    },

    // Reset camera to the default for the current viewport mode (used by the
    // centrar button). Desktop → centered on world; mobile → following player.
    recenterCamera() {
      City.applyCameraMode(City.detectCameraMode())
    },

    // Show the centrar button only when pressing it would actually change the view:
    // user broke out of follow (mobile-free), or zoom drifted from its mode default.
    updateRecenterButton() {
      const btn = document.getElementById('cityRecenterBtn')
      if (!btn) return
      const c = City.camera
      const defaultZoom = (c.mode === 'mobile-follow') ? 1.6 : 1
      const zoomedAway = Math.abs(c.zoom - defaultZoom) > 0.06
      const inFreeMode = c.mode === 'mobile-free'
      const active = inFreeMode || zoomedAway
      const cur = btn.dataset.active === 'true'
      if (active !== cur) btn.dataset.active = active ? 'true' : 'false'
    },

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
      // Each zone: pre-render a deterministic poporing matching its theme
      const traitsByZone = {
        tweets:  { eyes: 'classic', mouth: 'open',   cheeks: 'blush',    headTop: 'leaf' },
        stories: { eyes: 'sleepy',  mouth: 'smile',  cheeks: 'blush',    headTop: 'spike' },
        posts:   { eyes: 'sparkle', mouth: 'cat',    cheeks: 'blush',    headTop: 'droplet' },
        chat:    { eyes: 'heart',   mouth: 'smile',  cheeks: 'blush',    headTop: 'none' },
        bereal:  { eyes: 'round',   mouth: 'o',      cheeks: 'freckles', headTop: 'antenna' },
        profile: { eyes: 'star',    mouth: 'smirk',  cheeks: 'blush',    headTop: 'antenna' },
      }
      ZONES.forEach(z => {
        if (typeof generatePoporingFromTraits !== 'function') return
        const svg = generatePoporingFromTraits(traitsByZone[z.id], z.mascotColor)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => { City.mascots[z.id] = img; URL.revokeObjectURL(url) }
        img.src = url
      })
    },

    bind() {
      window.addEventListener('keydown', City.onKey)
      window.addEventListener('keyup', City.onKey)
      City.canvas.addEventListener('pointerdown', City.onPointerDown)
      City.canvas.addEventListener('pointermove', City.onPointerMove)
      City.canvas.addEventListener('pointerup', City.onPointerUp)
      City.canvas.addEventListener('pointercancel', City.onPointerCancel)
      City.canvas.addEventListener('pointerleave', City.onLeave)
      City.canvas.addEventListener('wheel', City.onWheel, { passive: false })
      window.addEventListener('keydown', City.onEsc)
      const recenter = document.getElementById('cityRecenterBtn')
      if (recenter) recenter.addEventListener('click', City.recenterCamera)
    },
    unbind() {
      window.removeEventListener('keydown', City.onKey)
      window.removeEventListener('keyup', City.onKey)
      if (City.canvas) {
        City.canvas.removeEventListener('pointerdown', City.onPointerDown)
        City.canvas.removeEventListener('pointermove', City.onPointerMove)
        City.canvas.removeEventListener('pointerup', City.onPointerUp)
        City.canvas.removeEventListener('pointercancel', City.onPointerCancel)
        City.canvas.removeEventListener('pointerleave', City.onLeave)
        City.canvas.removeEventListener('wheel', City.onWheel)
      }
      const recenter = document.getElementById('cityRecenterBtn')
      if (recenter) recenter.removeEventListener('click', City.recenterCamera)
      window.removeEventListener('keydown', City.onEsc)
      City.hideOtherTooltip()
      City.closeOtherPopover()
    },

    // ─── Pointer pipeline (pan + pinch + tap-vs-drag) ───
    // 1 pointer drag → pan (any device); 2 pointers → pinch zoom; tap → click.
    // A "tap" = movement < 6px AND duration < 350ms. Otherwise it's a drag.
    onPointerDown(e) {
      if (City.isInputBlocked()) return
      try { City.canvas.setPointerCapture(e.pointerId) } catch (_) {}
      const p = {
        id: e.pointerId,
        x: e.clientX, y: e.clientY,
        startX: e.clientX, startY: e.clientY,
        startTime: performance.now(),
      }
      City.input.pointers.set(e.pointerId, p)
      const n = City.input.pointers.size
      if (n === 1) {
        City.input.panAnchorWorld = City.canvasCoords(e)
        City.input.hasMoved = false
        City.input.isPanning = false
        City.input.isPinching = false
      } else if (n === 2) {
        const arr = [...City.input.pointers.values()]
        const a = arr[0], b = arr[1]
        City.input.pinchDist0 = Math.hypot(b.x - a.x, b.y - a.y) || 1
        City.input.pinchZoom0 = City.camera.targetZoom
        City.input.isPinching = true
        City.input.isPanning = false
      }
    },

    onPointerMove(e) {
      const p = City.input.pointers.get(e.pointerId)
      if (!p) {
        // Not a captured pointer → hover (mouse without button down)
        City.onMove(e)
        return
      }
      p.x = e.clientX; p.y = e.clientY

      if (City.input.isPinching && City.input.pointers.size >= 2) {
        const arr = [...City.input.pointers.values()]
        const a = arr[0], b = arr[1]
        const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const ratio = dist / City.input.pinchDist0
        City.camera.targetZoom = Math.max(0.5, Math.min(3, City.input.pinchZoom0 * ratio))
        // Pinch counts as user-driven panning intent → break out of follow mode.
        if (City.camera.mode === 'mobile-follow') City.camera.mode = 'mobile-free'
        City.input.hasMoved = true
        return
      }

      if (City.input.pointers.size === 1) {
        const dx = p.x - p.startX, dy = p.y - p.startY
        if (!City.input.hasMoved && Math.hypot(dx, dy) > 6) City.input.hasMoved = true
        if (City.input.hasMoved) {
          City.input.isPanning = true
          if (City.camera.mode === 'mobile-follow') City.camera.mode = 'mobile-free'
          // Keep panAnchorWorld under the pointer: shift camera by (anchor - current).
          // canvasCoords inverts the current transform, so this delta works in top-down coords.
          const cur = City.canvasCoords(e)
          City.camera.x += City.input.panAnchorWorld.x - cur.x
          City.camera.y += City.input.panAnchorWorld.y - cur.y
          City.camera.targetX = City.camera.x
          City.camera.targetY = City.camera.y
          City.clampCamera()
        }
      }
    },

    onPointerUp(e) {
      const p = City.input.pointers.get(e.pointerId)
      if (!p) return
      City.input.pointers.delete(e.pointerId)
      if (City.input.pointers.size < 2) City.input.isPinching = false
      const wasTap = !City.input.hasMoved && (performance.now() - p.startTime) < 350
      if (wasTap && City.input.pointers.size === 0) {
        // Delegate to existing click logic (other-poporing popover, mascot teleport, click-to-walk).
        City.onPointer({ clientX: p.x, clientY: p.y })
      }
      if (City.input.pointers.size === 0) {
        City.input.isPanning = false
        City.input.hasMoved = false
      }
    },

    onPointerCancel(e) {
      City.input.pointers.delete(e.pointerId)
      if (City.input.pointers.size < 2) City.input.isPinching = false
      if (City.input.pointers.size === 0) {
        City.input.isPanning = false
        City.input.hasMoved = false
      }
    },

    onWheel(e) {
      if (City.isInputBlocked()) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0015)
      const before = City.canvasCoords(e)
      City.camera.targetZoom = Math.max(0.5, Math.min(3, City.camera.targetZoom * factor))
      // Zoom-toward-cursor: nudge the camera target a bit toward the cursor so
      // the world point under the cursor stays roughly put across zoom changes.
      const k = (factor - 1) * 0.5
      City.camera.targetX += (before.x - City.camera.x) * k
      City.camera.targetY += (before.y - City.camera.y) * k
    },

    onEsc(e) {
      if (e.key !== 'Escape') return
      if (City.activeOtherId) { City.closeOtherPopover(); return }
      City.closeSheet()
    },

    canvasCoords(e) {
      const r = City.canvas.getBoundingClientRect()
      const v = City._view || { scale: 1, ox: 0, oy: 0 }
      // CSS pixels relative to canvas
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      // Reverse the base transform first to get iso screen coords (in world units),
      // then reverse the iso projection to recover top-down world coords.
      const isoX = (cx - v.ox) / v.scale
      const isoY = (cy - v.oy) / v.scale
      const { wx, wy } = s2w(isoX, isoY)
      return { x: wx, y: wy, rect: r }
    },

    findOtherAt(x, y) {
      // Return the closest other within the click radius, if any.
      let best = null, bestD = 999
      for (const o of City.others) {
        const d = Math.hypot(x - o.x, y - o.y)
        if (d < 28 && d < bestD) { best = o; bestD = d }
      }
      return best
    },

    findZoneMascotAt(x, y) {
      for (const z of ZONES) {
        const my = z.y + z.h - 30
        if (Math.hypot(x - (z.x + z.w/2), y - my) < 32) return z
      }
      return null
    },

    onMove(e) {
      const { x, y } = City.canvasCoords(e)
      const o = City.findOtherAt(x, y)
      const z = !o ? City.findZoneMascotAt(x, y) : null
      const newId = o ? o.user_id : null
      if (newId !== City.hoveredOtherId) {
        City.hoveredOtherId = newId
        if (o) City.showOtherTooltip(o, e.clientX, e.clientY)
        else   City.hideOtherTooltip()
      } else if (o) {
        City.moveOtherTooltip(e.clientX, e.clientY)
      }
      City.canvas.style.cursor = (o || z) ? 'pointer' : 'grab'
    },

    onLeave() {
      City.hoveredOtherId = null
      City.hideOtherTooltip()
    },

    // True when typing in an input/textarea OR a modal/sheet/overlay is open.
    // While blocked, WASD and click-to-walk are disabled so the player doesn't run off
    // while you're writing a post or reading a story.
    isInputBlocked() {
      const ae = document.activeElement
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true
      const open = document.querySelector('.modal:not([hidden]), .zone-sheet:not([hidden]), .story-viewer:not([hidden]), .story-editor:not([hidden]), .events-modal:not([hidden]), .pet-menu:not([hidden]), #zoneSheet:not([hidden])')
      return !!open
    },

    onKey(e) {
      const down = e.type === 'keydown'
      const k = e.key.toLowerCase()
      // Block WASD/arrows whenever a modal/sheet is open or you're typing — let Esc still work.
      if (City.isInputBlocked() && k !== 'escape') {
        // Also drop any keys held before the modal opened so the player doesn't keep walking
        City.keys.up = City.keys.down = City.keys.left = City.keys.right = false
        return
      }
      if (k === 'w' || k === 'arrowup')    { City.keys.up = down;    City.target = null }
      else if (k === 's' || k === 'arrowdown')  { City.keys.down = down;  City.target = null }
      else if (k === 'a' || k === 'arrowleft')  { City.keys.left = down;  City.target = null }
      else if (k === 'd' || k === 'arrowright') { City.keys.right = down; City.target = null }
      else return
      if (down) e.preventDefault()
    },

    onPointer(e) {
      // While a modal/sheet is open, the canvas is non-interactive (the overlay owns the
      // input). Don't let stray clicks send the player walking under the modal.
      if (City.isInputBlocked()) return
      const { x, y } = City.canvasCoords(e)
      // 1. Other player → open interaction popover (sesión 8)
      const other = City.findOtherAt(x, y)
      if (other) {
        City.openOtherPopover(other, e.clientX, e.clientY)
        return
      }
      // 2. Zone mascot → teleport + open sheet
      const zone = City.findZoneMascotAt(x, y)
      if (zone) { City.teleportToZone(zone.id); return }
      // 3. Empty ground → click-to-walk
      City.target = { x, y }
      City.closeOtherPopover()
    },

    teleportToZone(zoneId) {
      const z = ZONES.find(zz => zz.id === zoneId)
      if (!z) return
      // Walk-in to entrance (just below mascot)
      City.player.x = z.x + z.w/2
      City.player.y = z.y + z.h - 30
      City.target = null
      City.checkZone()
      // Open the zone's section as a bottom sheet on top of the city (Phase 4)
      setTimeout(() => City.openSheet(z), 280)
    },

    // ─── Bottom Sheet (Phase 4) ───
    // Hosts a section's .mode element inside the sheet so users stay in /city visually.
    // The element is moved (not cloned) into #zoneSheetContent and restored on close.

    // Open the sheet for a given habitat id ('tweets', 'posts', etc.). Used by
    // the routing layer (deep links) and by the doormat-trigger / mascot click.
    openSheetForHabitat(habitatId, chatWith) {
      const z = ZONES.find(zz => zz.habitat === habitatId || zz.id === habitatId)
      if (!z) return
      // If the sheet for this same zone is already open, do nothing
      const sheet = document.getElementById('zoneSheet')
      if (sheet && !sheet.hidden && City._sheetReturn && City._sheetReturn.el && City._sheetReturn.el.id === 'mode-' + habitatId) return
      City.openSheet(z)
      // /chat/<username> deep link → after the sheet is up, open the conversation
      // with that user. We only have the username slug; resolve it to a user_id by
      // looking it up in the presence list (cached) or falling back to a search.
      if (habitatId === 'chat' && chatWith && App.openChat) {
        const lower = chatWith.toLowerCase()
        const tryOpen = () => {
          const other = (City.others || []).find(o => (o.username || '').toLowerCase() === lower)
          if (other) { App.openChat(other.user_id, other.username, other.color); return true }
          return false
        }
        // Try immediately, then retry once after presence has refreshed
        setTimeout(() => { if (!tryOpen()) setTimeout(tryOpen, 1500) }, 250)
      }
    },

    openSheet(zone) {
      if (!zone) return
      const sheet = document.getElementById('zoneSheet')
      const content = document.getElementById('zoneSheetContent')
      const modeEl = document.getElementById('mode-' + zone.habitat)
      if (!sheet || !content || !modeEl) return
      // Update title chrome
      document.getElementById('zoneSheetTitle').textContent = zone.name
      const subs = { tweets: 'lo que se está miaulando', posts: 'fotos del día', stories: 'lo que pasa hoy', chat: 'conversaciones', bereal: 'tu miau real', profile: 'tu rincón' }
      document.getElementById('zoneSheetSub').textContent = subs[zone.habitat] || ''
      // Stash original parent so we can put it back on close
      City._sheetReturn = { el: modeEl, parent: modeEl.parentNode, next: modeEl.nextSibling }
      modeEl.hidden = false
      content.appendChild(modeEl)
      // Trigger that mode's enter to load its data (tweets, posts, etc.)
      if (App['enter_' + zone.habitat]) App['enter_' + zone.habitat]()
      sheet.hidden = false
      sheet.dataset.open = 'true'
      requestAnimationFrame(() => sheet.classList.add('open'))
      // Track which sheet is open so other modules (chat polling, etc.) can react.
      if (window.App) App.activeSheet = zone.habitat
      // Reflect the sheet in the URL so refresh / back / share keep the same view.
      // /tweets, /posts, etc. map to mode='city' + sheet=<habitat>.
      if (window.history && history.replaceState && window.Routes) {
        const path = Routes.pathFor('city', { sheet: zone.habitat })
        if (location.pathname !== path) history.replaceState({ mode: 'city', sheet: zone.habitat }, '', path)
        document.title = `${zone.habitat} · miaumiau`
      }
    },

    closeSheet() {
      const sheet = document.getElementById('zoneSheet')
      if (!sheet || sheet.hidden) return
      sheet.classList.remove('open')
      sheet.dataset.open = 'false'
      // Step the player slightly off the doormat so the proximity trigger doesn't
      // immediately re-open the sheet, and add a cooldown for safety.
      const z = ZONES.find(zz => zz.id === City._matZoneId) || ZONES.find(zz => zz.id === City.currentZone)
      if (z) {
        // Push player just below the doormat (toward the plaza)
        const cx = z.x + z.w/2, cy = z.y + z.h - 30
        const px = W/2, py = H/2 + 20
        const dx = px - cx, dy = py - cy
        const len = Math.hypot(dx, dy) || 1
        City.player.x = cx + (dx/len) * 60
        City.player.y = cy + (dy/len) * 60
      }
      City._matCooldownUntil = performance.now() + 1500
      City._matZoneId = null
      City._matEnterTime = 0
      if (window.App) App.activeSheet = null
      // Reset URL back to the city home so the back button + refresh behave naturally
      if (window.history && history.replaceState && location.pathname !== '/') {
        history.replaceState({ mode: 'city' }, '', '/')
        document.title = 'miaumiau'
      }
      // After the slide-down transition, restore the .mode element back to its original parent
      setTimeout(() => {
        sheet.hidden = true
        const ret = City._sheetReturn
        if (ret && ret.el && ret.parent) {
          ret.el.hidden = true
          if (ret.next) ret.parent.insertBefore(ret.el, ret.next)
          else ret.parent.appendChild(ret.el)
        }
        City._sheetReturn = null
      }, 320)
    },

    checkZone() {
      const p = City.player
      const inside = ZONES.find(z => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h)
      const newZone = inside ? inside.id : null
      // Doormat proximity trigger: standing on the doormat (in front of the door,
      // 28px around the mascot) for ≥420ms opens that zone's sheet automatically.
      // While walking through, the timer resets, so passing by doesn't trigger.
      const now = performance.now()
      const cooldownActive = now < (City._matCooldownUntil || 0)
      const sheetOpen = !!(document.getElementById('zoneSheet') && !document.getElementById('zoneSheet').hidden)
      if (!cooldownActive && !sheetOpen) {
        const onMat = ZONES.find(z => Math.hypot(p.x - (z.x + z.w/2), p.y - (z.y + z.h - 30)) < 28)
        if (onMat) {
          City._matZoneId = onMat.id
          // Enter the moment the player STOPS on the doormat (arrived by click-to-walk
          // → target cleared / arrived by WASD → keys released). Walking through doesn't
          // trigger because p.walking is still true mid-step.
          if (!p.walking) City.openSheet(onMat)
        } else if (City._matZoneId) {
          City._matZoneId = null
          City._matEnterTime = 0
        }
      }
      if (newZone !== City.currentZone) {
        City.currentZone = newZone
        if (window.World) {
          if (newZone) World.applyHabitat(inside.habitat)
          else World.applyHabitat('city')
        }
        City.writePresence(true)  // immediate write on zone change
        // Track zone entry (drives heatmap)
        if (newZone && window.track) track('enter:zone', { zone: newZone })
      }
    },

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
        p.x += (vx / len) * PLAYER_SPEED * dt
        p.y += (vy / len) * PLAYER_SPEED * dt
        p.walking = true
        if (vx < -0.1) p.dir = 1
        else if (vx > 0.1) p.dir = 0
      } else {
        p.walking = false
      }
      // Bounds
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

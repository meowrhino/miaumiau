// City — Phase 1: solo player. Canvas with 6 zones. WASD/click-to-walk.
// Zone detection emits enter:zone events. No networking yet.
;(function () {
  // World units (game logic uses these — zones, paths, fountain are placed in this space).
  // The canvas backing buffer is the actual viewport size; a scale+offset transform maps world → screen.
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

  const City = {
    canvas: null, ctx: null,
    raf: 0,
    last: 0,
    keys: { up: false, down: false, left: false, right: false },
    target: null,  // {x,y} click-to-walk
    player: { x: PLAZA.x + PLAZA.w/2, y: PLAZA.y + PLAZA.h/2, dir: 0, walking: false, color: 'Coral' },
    currentZone: null,
    mascots: {},  // zoneId → poporing img bitmap
    bgCache: null,
    others: [],          // [{user_id, zone, x, y, username, color, avatar_seed, sprite}]
    otherSprites: {},    // user_id → Image
    presenceTimer: 0,
    pollTimer: 0,
    wavesTimer: 0,
    _wavesSeen: new Set(),
    lastPresenceWrite: 0,
    lastPresenceState: null,

    enter() {
      const sec = document.getElementById('mode-city')
      if (!sec) return
      sec.hidden = false
      City.canvas = document.getElementById('cityCanvas')
      if (!City.canvas) return
      City.ctx = City.canvas.getContext('2d')
      City.fitCanvas()
      window.addEventListener('resize', City.fitCanvas)

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

    leave() {
      cancelAnimationFrame(City.raf)
      City.unbind()
      window.removeEventListener('resize', City.fitCanvas)
      clearInterval(City.pollTimer)
      clearInterval(City.wavesTimer)
      // Optional: clear presence on leave (best-effort)
      if (App.user && window.API) API.del('/city/presence').catch(() => {})
    },

    fitCanvas() {
      if (!City.canvas) return
      const wrap = City.canvas.parentElement
      if (!wrap) return
      // Full-bleed: the canvas covers the entire viewport (no letterbox / no degradient gap).
      // Strategy: backing buffer = viewport_w × viewport_h × dpr; world is drawn at a scale
      // that COVERS the viewport (so no empty letterbox), and ground/sky are painted beyond
      // world bounds to fill any extra room when the viewport aspect differs from 16:9.
      const vw = wrap.clientWidth
      const vh = wrap.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      City.canvas.width  = Math.round(vw * dpr)
      City.canvas.height = Math.round(vh * dpr)
      City.canvas.style.width  = vw + 'px'
      City.canvas.style.height = vh + 'px'
      // contain-fit: smallest scale so the entire world is visible — the spillover beyond
      // the world rect (top/bottom on tall viewports, sides on wide ones) is filled with
      // extended grass by drawGround. No letterbox / no degradient gap.
      const scale = Math.min(vw / W, vh / H)
      const ox = (vw - W * scale) / 2
      const oy = (vh - H * scale) / 2
      City._view = { scale, ox, oy, vw, vh, dpr }
      // Apply: dpr × scale, with offset (in CSS px times dpr → device pixels)
      City.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr, oy * dpr)
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
      City.canvas.addEventListener('pointerdown', City.onPointer)
      City.canvas.addEventListener('pointermove', City.onMove)
      City.canvas.addEventListener('pointerleave', City.onLeave)
      window.addEventListener('keydown', City.onEsc)
    },
    unbind() {
      window.removeEventListener('keydown', City.onKey)
      window.removeEventListener('keyup', City.onKey)
      if (City.canvas) {
        City.canvas.removeEventListener('pointerdown', City.onPointer)
        City.canvas.removeEventListener('pointermove', City.onMove)
        City.canvas.removeEventListener('pointerleave', City.onLeave)
      }
      window.removeEventListener('keydown', City.onEsc)
      City.hideOtherTooltip()
      City.closeOtherPopover()
    },

    onEsc(e) {
      if (e.key !== 'Escape') return
      if (City.activeOtherId) { City.closeOtherPopover(); return }
      City.closeSheet()
    },

    canvasCoords(e) {
      const r = City.canvas.getBoundingClientRect()
      const v = City._view
      // CSS pixels relative to canvas
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      // Inverse of fitCanvas transform: world = (css − offset) / scale
      const x = (cx - (v ? v.ox : 0)) / (v ? v.scale : 1)
      const y = (cy - (v ? v.oy : 0)) / (v ? v.scale : 1)
      return { x, y, rect: r }
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
      // Optional secondary action — e.g. /chat/manu opens the conversation with manu
      if (habitatId === 'chat' && chatWith && App.openChatWith) {
        setTimeout(() => App.openChatWith(chatWith), 220)
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

    // ─── Presence ───
    async writePresence(immediate) {
      if (!App.user) return
      const now = Date.now()
      // Throttle: write at most every 8s, unless immediate (zone change)
      if (!immediate && now - City.lastPresenceWrite < 8000) return
      const p = City.player
      const zone = City.currentZone || 'plaza'
      // Only write if state actually changed
      const state = `${zone}|${Math.round(p.x/12)}|${Math.round(p.y/12)}`
      if (!immediate && state === City.lastPresenceState) return
      City.lastPresenceState = state
      City.lastPresenceWrite = now
      try {
        await API.post('/city/presence', { zone, x: Math.round(p.x), y: Math.round(p.y) })
      } catch (_) {}
    },

    async fetchOthers() {
      try {
        const list = await API.get('/city/presence')
        const meId = App.user?.id
        const incoming = list.filter(o => o.user_id !== meId)
        // Preserve transient client-only fields (heart bubble timer) across polls
        const prevById = {}
        for (const o of City.others) prevById[o.user_id] = o
        City.others = incoming.map(o => {
          const prev = prevById[o.user_id]
          return prev ? Object.assign(o, { _heartUntil: prev._heartUntil }) : o
        })
        // Lazy-load sprites for new others
        City.others.forEach(o => {
          if (City.otherSprites[o.user_id]) return
          const img = new Image()
          img.src = `/api/users/${o.user_id}/avatar.svg`
          img.onload = () => { City.otherSprites[o.user_id] = img }
        })
      } catch (_) {}
    },

    async fetchWaves() {
      try {
        const list = await API.get('/city/waves')
        if (!Array.isArray(list)) return
        for (const w of list) {
          if (City._wavesSeen.has(w.id)) continue
          City._wavesSeen.add(w.id)
          // Find the recipient and trigger their heart bubble
          const target = City.others.find(o => o.user_id === w.to_user_id)
          if (target) target._heartUntil = performance.now() + 1500
          // If I'm the one being saluted → soft toast
          if (w.to_user_id === App.user?.id && w.from_user_id !== App.user?.id) {
            if (typeof showToast === 'function') showToast(`${w.from_username} te saludó 💗`, 2000)
          }
        }
        // Trim seen set so it doesn't grow forever
        if (City._wavesSeen.size > 400) City._wavesSeen = new Set(Array.from(City._wavesSeen).slice(-200))
      } catch (_) {}
    },

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
      City.render(now)
      City.raf = requestAnimationFrame(City.tick)
    },

    render(now) {
      const ctx = City.ctx
      if (!ctx) return
      // Compute world-space visible bounds (may extend past 0..W / 0..H when the viewport
      // aspect differs from the world aspect — drawGround paints the spillover with extended grass).
      const v = City._view || { scale: 1, ox: 0, oy: 0, vw: W, vh: H }
      const visL = -v.ox / v.scale
      const visT = -v.oy / v.scale
      const visR = (v.vw - v.ox) / v.scale
      const visB = (v.vh - v.oy) / v.scale
      ctx.clearRect(visL, visT, visR - visL, visB - visT)

      // ── 0. drifting clouds (above the world, scroll horizontally) ──
      if (City.sprites && City.sprites.clouds) {
        const clouds = City.sprites.clouds
        const totalW = (visR - visL) + 200
        for (let i = 0; i < clouds.length; i++) {
          const cl = clouds[i]
          const speed = 0.012 + i * 0.005
          const phase = (now * speed + i * 400) % totalW
          const cx = visL - 60 + ((phase + i * 200) % totalW)
          const cy = visT + 40 + i * 60
          ctx.globalAlpha = 0.85
          ctx.drawImage(cl, cx, cy)
          ctx.globalAlpha = 1
        }
      }

      // ── 1. ground (tiled grass + plaza cobble + paths + bushes/flowers) ──
      City.drawGround(ctx, now, visL, visT, visR, visB)

      // ── 2. ambient back layer: trees and bushes behind anything they sit higher than
      const PLAZA_Y = PLAZA.y - 40
      TREES.forEach((t, i) => { if (t.y < PLAZA_Y) City.drawTree(ctx, t.x, t.y, now, i) })

      // ── 3. all buildings (functional zones + decorative) depth-sorted by Y of base ──
      const buildings = []
      ZONES.forEach(z => buildings.push({ kind: 'zone', y: z.y + z.h, ref: z }))
      DECO_BUILDINGS.forEach((d, i) => buildings.push({ kind: 'deco', y: d.y, ref: d, idx: i }))
      buildings.sort((a, b) => a.y - b.y)
      buildings.forEach(b => {
        if (b.kind === 'zone') City.drawBuilding(ctx, b.ref, now)
        else                   City.drawDecoBuilding(ctx, b.ref, City.sprites && City.sprites.deco[b.idx], now)
      })

      // ── 4. fountain in plaza (descentrada) ──
      City.drawFountain(ctx, FOUNTAIN.x, FOUNTAIN.y, now)

      // ── 5. lamps (warm halo, always lit thanks to World tint) ──
      LAMPS.forEach(l => City.drawLamp(ctx, l.x, l.y, now))

      // ── 6. front-layer trees (in front of plaza area) ──
      TREES.forEach((t, i) => { if (t.y >= PLAZA_Y) City.drawTree(ctx, t.x, t.y, now, i) })

      // ── 7. characters (others + me, sorted by y for fake parallax) ──
      const chars = City.others.map(o => ({ kind: 'other', y: o.y, data: o }))
      chars.push({ kind: 'me', y: City.player.y, data: City.player })
      chars.sort((a, b) => a.y - b.y)
      chars.forEach(c => {
        if (c.kind === 'other') City.drawOther(ctx, c.data, now)
        else                    City.drawPlayer(ctx, c.data, now)
      })

      // ── 8. HUD overlay (counter + tooltip) ──
      City.drawHud(ctx, now)
    },

    // ─── Render helpers (sesión 7: ciudad parece ciudad) ───

    drawGround(ctx, now, visL, visT, visR, visB) {
      visL = visL ?? 0; visT = visT ?? 0; visR = visR ?? W; visB = visB ?? H
      const sp = City.sprites
      ctx.imageSmoothingEnabled = false

      // Pasto tileado pixel-art — llena toda el área visible (extiende fuera del world)
      if (sp && sp.grass) {
        const ts = 32
        const sxStart = Math.floor(visL / ts) * ts
        const syStart = Math.floor(visT / ts) * ts
        for (let y = syStart; y < visB; y += ts) {
          for (let x = sxStart; x < visR; x += ts) {
            ctx.drawImage(sp.grass, x, y)
          }
        }
      } else {
        ctx.fillStyle = '#a8d8a0'
        ctx.fillRect(visL, visT, visR - visL, visB - visT)
      }

      // Plaza descentrada al SO con cobble pixel-art
      const cx = PLAZA.x, cy = PLAZA.y, prx = PLAZA.rx, pry = PLAZA.ry

      // Caminos serpenteantes: desde la plaza a cada zona funcional. Asimétricos
      // (cada uno tiene su propia longitud porque las zonas están repartidas org.).
      ZONES.forEach(z => {
        const tx = z.x + z.w/2, ty = z.y + z.h - 30
        ctx.save()
        ctx.strokeStyle = '#a08868'
        ctx.lineWidth = 26
        ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke()
        ctx.strokeStyle = '#d6b988'
        ctx.lineWidth = 22
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke()
        // Pebble specks scattered along
        const dx = tx - cx, dy = ty - cy, len = Math.hypot(dx, dy)
        const nx = -dy/len, ny = dx/len
        for (let t = 0.15; t < 0.95; t += 0.10) {
          const pxx = cx + dx*t + nx * (((t * 7919) % 7) - 3)
          const pyy = cy + dy*t + ny * (((t * 7919) % 7) - 3)
          ctx.fillStyle = '#a08868'
          ctx.fillRect(pxx|0, pyy|0, 2, 2)
        }
        ctx.restore()
      })

      // Plaza (cobble tiles, clipped a la elipse)
      if (sp && sp.cobble) {
        ctx.save()
        ctx.beginPath(); ctx.ellipse(cx, cy, prx, pry, 0, 0, Math.PI * 2)
        ctx.clip()
        const ts = 16
        for (let y = cy - pry - 8; y < cy + pry + 8; y += ts) {
          for (let x = cx - prx - 8; x < cx + prx + 8; x += ts) {
            ctx.drawImage(sp.cobble, x|0, y|0)
          }
        }
        ctx.strokeStyle = 'rgba(140,100,60,0.35)'
        ctx.lineWidth = 4
        ctx.beginPath(); ctx.ellipse(cx, cy, prx - 2, pry - 2, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.restore()
      } else {
        ctx.fillStyle = '#e8c898'
        ctx.beginPath(); ctx.ellipse(cx, cy, prx, pry, 0, 0, Math.PI * 2); ctx.fill()
      }

      // Bushes & flower patches scattered around the village ambiente.
      if (sp) {
        const decoSpots = [
          { kind: 'bush',   x: 30,   y: 380, i: 0 },
          { kind: 'bush',   x: 690,  y: 700, i: 1 },
          { kind: 'bush',   x: 1240, y: 660, i: 2 },
          { kind: 'bush',   x: 220,  y: 700, i: 3 },
          { kind: 'flower', x: 350,  y: 80,  i: 0 },
          { kind: 'flower', x: 850,  y: 700, i: 1 },
          { kind: 'flower', x: 1100, y: 80,  i: 2 },
          { kind: 'flower', x: 60,   y: 480, i: 0 },
        ]
        for (const d of decoSpots) {
          const img = d.kind === 'bush' ? sp.bushes[d.i % sp.bushes.length] : sp.flowers[d.i % sp.flowers.length]
          if (img) ctx.drawImage(img, d.x - img.width/2, d.y - img.height)
        }
      }
    },

    drawBuilding(ctx, z, now) {
      // Pixel-art house sprite + animated overlays (smoke, sign sway, mascot bob).
      const cx = z.x + z.w/2, cy = z.y + z.h/2
      const sp = City.sprites
      // Floor shadow under the building
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath(); ctx.ellipse(cx, z.y + z.h - 14, z.w * 0.34, 12, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()

      // Render the house sprite (96×96 logical, scaled to fit zone footprint)
      const houseImg = sp && sp.house && sp.house[z.id]
      const renderW = 180, renderH = 180
      const bx = cx - renderW/2
      const by = z.y + z.h - renderH + 4   // anchor base at zone bottom
      ctx.imageSmoothingEnabled = false
      if (houseImg) ctx.drawImage(houseImg, bx, by, renderW, renderH)
      else { // fallback: simple block
        ctx.fillStyle = z.roof
        ctx.fillRect(cx - 60, z.y + 40, 120, 100)
      }

      // Per-zone animated overlays (smoke, blink, glow) layered on top of the sprite
      City.drawHouseOverlay(ctx, z, bx, by, renderW, renderH, now)

      // Hanging sign with the emoji symbol — floats above the rooftop, sways gently with the wind
      const swayS = Math.sin(now/1500 + z.x*0.01) * 2
      const sx = cx
      const signTop = by - 22         // floats above the house roof apex
      ctx.save()
      ctx.translate(sx, signTop)
      ctx.rotate(swayS * Math.PI / 180)
      ctx.translate(-sx, -signTop)
      // Hang line
      ctx.strokeStyle = 'rgba(80,55,30,0.7)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(sx, signTop - 8); ctx.lineTo(sx, signTop); ctx.stroke()
      // Plate
      ctx.fillStyle = '#fff7e8'
      ctx.strokeStyle = 'rgba(80,55,30,0.7)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.roundRect(sx - 22, signTop, 44, 26, 6); ctx.fill(); ctx.stroke()
      // Emoji icon
      ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(z.building, sx, signTop + 14)
      ctx.restore()

      // Mascot poporing in front of the door (clickable hotspot + doormat trigger)
      const mascot = City.mascots[z.id]
      const my = z.y + z.h - 30
      const bob = Math.sin(now/600 + z.x*0.01) * 4
      // Doormat aura — soft pulsing glow tells the player "stand here to enter".
      // When the player is actually on the mat, the aura grows + a progress ring fills
      // until 420ms have passed and the sheet opens.
      const distToMat = Math.hypot(City.player.x - cx, City.player.y - my)
      const isOnMat = City._matZoneId === z.id
      ctx.save()
      if (distToMat < 100) {
        const t = Math.max(0, 1 - distToMat / 100)
        const pulse = (Math.sin(now/600) + 1) * 0.5
        ctx.fillStyle = `rgba(255,236,168,${(0.10 + pulse * 0.15) * t})`
        ctx.beginPath(); ctx.arc(cx, my + 4, 36, 0, Math.PI * 2); ctx.fill()
      }
      if (isOnMat && City._matEnterTime) {
        const prog = Math.min(1, (performance.now() - City._matEnterTime) / 420)
        // Progress ring around the mascot
        ctx.strokeStyle = z.color
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(cx, my + 4, 30, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2); ctx.stroke()
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath(); ctx.ellipse(cx, my + 22, 18, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      if (mascot) {
        const size = 56
        ctx.save()
        ctx.shadowColor = z.color
        ctx.shadowBlur = 14
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(mascot, cx - size/2, my - size/2 + bob, size, size)
        ctx.restore()
      } else {
        ctx.fillStyle = z.color
        ctx.beginPath(); ctx.arc(cx, my + bob, 20, 0, Math.PI * 2); ctx.fill()
      }

      // Pixel-style nameplate under the mascot
      ctx.save()
      ctx.font = '700 13px "Pixelify Sans", monospace'
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.textAlign = 'center'
      ctx.strokeText(z.name, cx, my + 36)
      ctx.fillText(z.name, cx, my + 36)
      ctx.restore()
    },

    drawDecoBuilding(ctx, d, img, now) {
      // Decorative buildings render at d.x (center) with their footprint base at d.y.
      // d.h is the desired rendered height; width keeps the sprite's aspect ratio.
      const sp = City.sprites
      ctx.save()
      ctx.imageSmoothingEnabled = false
      // Floor shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath(); ctx.ellipse(d.x, d.y - 4, (d.h * 0.42), 8, 0, 0, Math.PI * 2); ctx.fill()
      if (img) {
        const aspect = img.width / img.height
        const rh = d.h, rw = rh * aspect
        ctx.drawImage(img, d.x - rw/2, d.y - rh, rw, rh)
        // Mill: spinning blades attached at the hub (sprite local (40, 36) → world coords)
        if (d.kind === 'mill') {
          const cxBlade = d.x
          const cyBlade = d.y - rh + (36 / 120) * rh
          const angle = now / 1500
          ctx.save()
          ctx.translate(cxBlade, cyBlade)
          ctx.rotate(angle)
          const bladeLen = 56, bladeW = 8
          for (let i = 0; i < 4; i++) {
            // Blade outline (dark)
            ctx.fillStyle = '#3a2613'
            ctx.fillRect(2, -bladeW/2 - 1, bladeLen + 2, bladeW + 2)
            // Blade body
            ctx.fillStyle = '#fff5e0'
            ctx.fillRect(3, -bladeW/2, bladeLen, bladeW)
            // Highlight stripe
            ctx.fillStyle = '#e0d0a8'
            ctx.fillRect(3, -bladeW/2 + bladeW - 2, bladeLen, 2)
            // Sail panels
            ctx.fillStyle = 'rgba(80,55,30,0.6)'
            for (let s = 8; s < bladeLen; s += 8) ctx.fillRect(3 + s, -bladeW/2 + 1, 1, bladeW - 2)
            ctx.rotate(Math.PI / 2)
          }
          // Hub cap (brown)
          ctx.fillStyle = '#3a2010'
          ctx.fillRect(-5, -5, 10, 10)
          ctx.fillStyle = '#7a4d2a'
          ctx.fillRect(-3, -3, 6, 6)
          ctx.restore()
        }
        // Bakery: animated steam from the chimney (sprite local around x=58, y=12)
        if (d.kind === 'bakery') {
          const csx = d.x + (4 / aspect)
          const csy = d.y - rh + 4
          for (let i = 0; i < 3; i++) {
            const t = ((now/1100) + i * 0.33) % 1
            const ssx = csx + Math.sin(t * Math.PI * 2 + i) * 5
            const ssy = csy - t * 24
            ctx.fillStyle = `rgba(255,255,255,${0.50 - t*0.40})`
            ctx.beginPath(); ctx.arc(ssx, ssy, 3 + t*3, 0, Math.PI * 2); ctx.fill()
          }
        }
        // Workshop: glow from the forge window
        if (d.kind === 'workshop') {
          const flicker = (Math.sin(now/180) + 1) * 0.5
          const fx = d.x - rw/2 + (23 / aspect) * (rh / img.height) * aspect
          const fy = d.y - rh + (51 / img.height) * rh
          ctx.fillStyle = `rgba(255,120,60,${0.20 + flicker * 0.20})`
          ctx.beginPath(); ctx.arc(fx, fy, 12, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.restore()
    },

    drawHouseOverlay(ctx, z, bx, by, rw, rh, now) {
      // Animated overlays on top of each zone's house sprite. The sprite already has
      // baked detail (chimney, flag, telescope, camera) — these are the bits that move:
      // smoke, glow, blink, swaying flag, etc.
      ctx.save()
      const sx = bx + rw/2          // sprite center x
      if (z.id === 'tweets') {
        // Smoke rising from chimney (chimney is at sprite local x ≈ 66, y ≈ 8)
        const chimX = bx + (66/96) * rw
        const chimY = by + (8/96) * rh
        for (let i = 0; i < 4; i++) {
          const t = ((now/1300) + i * 0.25) % 1
          const px = chimX + Math.sin(t * Math.PI * 2 + i) * 8
          const py = chimY - t * 38
          ctx.fillStyle = `rgba(255,255,255,${0.55 - t*0.45})`
          ctx.beginPath(); ctx.arc(px, py, 5 + t*5, 0, Math.PI * 2); ctx.fill()
        }
      } else if (z.id === 'posts') {
        // Bandera ondeando — el sprite ya tiene una bandera roja, se le añade un ripple shading encima
        const flagX = bx + (54/96) * rw
        const flagY = by + (8/96) * rh
        const flap = Math.sin(now/450) * 4
        ctx.fillStyle = `rgba(255,255,255,${0.25 + (Math.sin(now/300) + 1) * 0.15})`
        ctx.fillRect(flagX, flagY + flap, (10/96) * rw, 1)
      } else if (z.id === 'stories') {
        // Telescope slit glow + tiny moon orbiting
        const slitX = bx + (48/96) * rw
        const slitY = by + (24/96) * rh
        const glow = (Math.sin(now/900) + 1) * 0.5
        ctx.fillStyle = `rgba(180,210,255,${0.18 + glow*0.20})`
        ctx.beginPath(); ctx.arc(slitX, slitY, 12, 0, Math.PI * 2); ctx.fill()
        // Floating moon above
        const mx = sx, my = by - 6
        ctx.fillStyle = `rgba(255,236,168,${0.45 + glow*0.30})`
        ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff5d2'
        ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill()
      } else if (z.id === 'chat') {
        // Speech bubble bobbing above
        const bxb = sx - 6 + Math.sin(now/700) * 1.5
        const byb = by + 4 + Math.sin(now/600) * 1.5
        ctx.fillStyle = '#fff7e8'
        ctx.beginPath(); ctx.roundRect(bxb - 12, byb - 12, 24, 18, 6); ctx.fill()
        ctx.strokeStyle = 'rgba(60,40,20,0.55)'; ctx.lineWidth = 1.5; ctx.stroke()
        ctx.fillStyle = '#5a4730'
        ;[bxb - 5, bxb, bxb + 5].forEach(dx => {
          ctx.beginPath(); ctx.arc(dx, byb - 3, 1.3, 0, Math.PI * 2); ctx.fill()
        })
      } else if (z.id === 'bereal') {
        // Red record-light blink on the rooftop camera
        const lx = bx + (56/96) * rw
        const ly = by + (20/96) * rh
        const blink = (Math.sin(now/520) + 1) * 0.5
        ctx.fillStyle = `rgba(255,80,80,${0.5 + blink*0.5})`
        ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill()
        if (blink > 0.85) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)'
          ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill()
        }
      } else if (z.id === 'profile') {
        // Heart pulse over the door
        const pulse = (Math.sin(now/700) + 1) * 0.5
        const hx = bx + (47/96) * rw
        const hy = by + (54/96) * rh
        ctx.fillStyle = `rgba(208,64,96,${0.25 + pulse * 0.25})`
        ctx.beginPath(); ctx.arc(hx, hy, 8 + pulse*2, 0, Math.PI * 2); ctx.fill()
      }
      // Window flicker overlay (warm glow pulse on whichever window the sprite has near 25,66)
      const flick = (Math.sin(now/2200 + z.x*0.02) + 1) * 0.5
      ctx.fillStyle = `rgba(255,236,168,${0.10 + flick*0.10})`
      const wx = bx + (29/96) * rw
      const wy = by + (66/96) * rh
      ctx.beginPath(); ctx.arc(wx, wy, 14, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    },

    drawFountain(ctx, x, y, now) {
      // Pixel-art fountain sprite + animated water shimmer/jet/droplets overlays.
      const sp = City.sprites
      ctx.save()
      ctx.imageSmoothingEnabled = false
      const fImg = sp && sp.fountain
      const fw = 144, fh = 112
      if (fImg) ctx.drawImage(fImg, x - fw/2, y - fh + 36, fw, fh)
      else {
        ctx.fillStyle = '#bdb1a3'
        ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 14, 0, 0, Math.PI * 2); ctx.fill()
      }
      // Animated water surface shimmer (white sparkles drifting)
      for (let i = 0; i < 4; i++) {
        const t = ((now/900) + i * 0.25) % 1
        const sxx = x + Math.sin(t * Math.PI * 2 + i * 1.3) * 18
        const syy = y - 4 + Math.cos(t * Math.PI * 2 + i) * 2
        ctx.fillStyle = `rgba(255,255,255,${0.5 - t*0.3})`
        ctx.fillRect(sxx|0, syy|0, 2, 2)
      }
      // Jet rising from the top bowl
      const jet = 8 + (Math.sin(now/180) + 1) * 3
      ctx.fillStyle = 'rgba(190,225,245,0.85)'
      ctx.beginPath(); ctx.ellipse(x, y - 50 - jet/2, 3, jet/2, 0, 0, Math.PI * 2); ctx.fill()
      // Falling droplets from the top bowl
      for (let i = 0; i < 3; i++) {
        const t = ((now/600) + i * 0.33) % 1
        const dy = -42 + t * 38
        const dx = (i - 1) * 8
        ctx.fillStyle = `rgba(190,225,245,${0.85 - t*0.3})`
        ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    },

    drawTree(ctx, x, y, now, idx) {
      const sp = City.sprites
      const img = sp && sp.trees && sp.trees[idx ?? 0]
      ctx.save()
      // Shadow
      ctx.fillStyle = 'rgba(40,25,15,0.30)'
      ctx.beginPath(); ctx.ellipse(x, y + 30, 20, 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.imageSmoothingEnabled = false
      // Sway: tiny horizontal jitter (keeps the trunk aligned visually)
      const sway = Math.sin(now/1500 + x*0.01) * 1.5
      if (img) {
        const renderW = img.width * 1.6, renderH = img.height * 1.6
        ctx.drawImage(img, x - renderW/2 + sway, y - renderH + 36, renderW, renderH)
      } else {
        ctx.fillStyle = '#5fb070'
        ctx.beginPath(); ctx.arc(x, y - 8, 18, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    },

    drawLamp(ctx, x, y, now) {
      const sp = City.sprites
      ctx.save()
      // Shadow
      ctx.fillStyle = 'rgba(40,25,15,0.30)'
      ctx.beginPath(); ctx.ellipse(x, y + 30, 10, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.imageSmoothingEnabled = false
      const img = sp && sp.lamp
      if (img) {
        const renderW = img.width * 1.6, renderH = img.height * 1.6
        ctx.drawImage(img, x - renderW/2, y - renderH + 32, renderW, renderH)
      } else {
        ctx.fillStyle = '#3a3530'
        ctx.fillRect(x - 2, y - 28, 4, 56)
      }
      // Warm halo glow (animated)
      const glow = (Math.sin(now/1200) + 1) * 0.5
      const lampHeadY = y - 60
      ctx.fillStyle = `rgba(255,210,120,${0.30 + glow*0.20})`
      ctx.beginPath(); ctx.arc(x, lampHeadY, 28, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = `rgba(255,236,168,${0.55 + glow*0.30})`
      ctx.beginPath(); ctx.arc(x, lampHeadY, 14, 0, Math.PI * 2); ctx.fill()
      // Tiny moth circling the lamp
      const ma = (now / 800) + x * 0.01
      const mx = x + Math.cos(ma) * 16
      const my = lampHeadY + Math.sin(ma) * 8
      ctx.fillStyle = `rgba(220,180,140,${0.75 + Math.sin(now/120) * 0.25})`
      ctx.fillRect(mx|0, my|0, 2, 2)
      ctx.restore()
    },

    drawOther(ctx, o, now) {
      const sprite = City.otherSprites[o.user_id]
      const bob = Math.sin(now/600 + o.user_id) * 2
      const ox = o.x, oy = o.y
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath(); ctx.ellipse(ox, oy + PLAYER_SIZE/2 - 6, 14, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      // Hover halo
      if (City.hoveredOtherId === o.user_id) {
        ctx.save()
        ctx.strokeStyle = colorHex ? colorHex(o.color) : '#fff'
        ctx.lineWidth = 3
        ctx.globalAlpha = 0.7
        ctx.beginPath(); ctx.arc(ox, oy + bob, PLAYER_SIZE/2 - 2, 0, Math.PI * 2); ctx.stroke()
        ctx.restore()
      }
      if (sprite) {
        ctx.save()
        ctx.imageSmoothingEnabled = false
        ctx.globalAlpha = 0.96
        ctx.drawImage(sprite, ox - PLAYER_SIZE/2 + 4, oy - PLAYER_SIZE/2 + bob + 4, PLAYER_SIZE - 8, PLAYER_SIZE - 8)
        ctx.restore()
      } else {
        ctx.fillStyle = colorHex ? colorHex(o.color) : '#888'
        ctx.beginPath(); ctx.arc(ox, oy + bob, 14, 0, Math.PI * 2); ctx.fill()
      }
      // Heart bubble (decir-hola action) — sesión 8
      if (o._heartUntil && o._heartUntil > now) {
        const heartT = (o._heartUntil - now) / 1200
        ctx.save()
        ctx.globalAlpha = heartT
        ctx.font = '20px "Apple Color Emoji",sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('💗', ox + 14, oy - PLAYER_SIZE/2 - 10 - (1 - heartT) * 20)
        ctx.restore()
      }
      // Username label
      ctx.save()
      ctx.font = '600 11px "Pixelify Sans", monospace'
      ctx.textAlign = 'center'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.fillStyle = colorHex ? colorHex(o.color) : '#fff'
      ctx.strokeText(o.username, ox, oy - PLAYER_SIZE/2 - 2)
      ctx.fillText(o.username, ox, oy - PLAYER_SIZE/2 - 2)
      ctx.restore()
    },

    drawPlayer(ctx, p, now) {
      const bobP = p.walking ? Math.sin(now/100) * 2 : Math.sin(now/600) * 1
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.30)'
      ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER_SIZE/2 - 4, 18, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      if (p.sprite) {
        ctx.save()
        ctx.imageSmoothingEnabled = false
        if (p.dir === 1) {
          ctx.translate(p.x + PLAYER_SIZE/2, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(p.sprite, 0, p.y - PLAYER_SIZE/2 + bobP, PLAYER_SIZE, PLAYER_SIZE)
        } else {
          ctx.drawImage(p.sprite, p.x - PLAYER_SIZE/2, p.y - PLAYER_SIZE/2 + bobP, PLAYER_SIZE, PLAYER_SIZE)
        }
        ctx.restore()
      } else {
        ctx.fillStyle = '#FFB800'
        ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill()
      }
    },

    drawHud(ctx, now) {
      // Bottom-center hint
      if (!City.currentZone) {
        ctx.save()
        ctx.font = '500 13px "Pixelify Sans", monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.textAlign = 'center'
        const msg = 'WASD o click · click un poporing para entrar'
        ctx.strokeText(msg, W/2, H - 14)
        ctx.fillText(msg, W/2, H - 14)
        ctx.restore()
      }
      // Online counter (sesión 8) when there are people around
      const total = City.others.length + 1
      if (total >= 2) {
        ctx.save()
        ctx.font = '700 14px "Pixelify Sans", monospace'
        const text = `${total} cats en el pueblo`
        const m = ctx.measureText(text)
        const pad = 10
        const bw = m.width + pad * 2, bh = 26
        const bx = 18, by = 18
        ctx.fillStyle = 'rgba(20,14,8,0.55)'
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(text, bx + pad, by + bh/2 + 1)
        ctx.restore()
      }
    },
  }

  // ─── Other-poporing interaction (sesión 8) ───
  function fmtAgo(updatedAt) {
    if (!updatedAt) return 'aquí'
    const diff = (Date.now() - new Date(updatedAt + 'Z').getTime()) / 1000
    if (diff < 30)    return 'ahora mismo'
    if (diff < 90)    return 'hace 1 min'
    if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`
    return 'hace un rato'
  }
  function zoneLabel(zoneId) {
    const z = ZONES.find(zz => zz.id === zoneId)
    return z ? z.name : 'la plaza'
  }

  City.showOtherTooltip = function (o, clientX, clientY) {
    let tip = document.getElementById('cityTooltip')
    if (!tip) {
      tip = document.createElement('div')
      tip.id = 'cityTooltip'
      tip.className = 'city-tooltip'
      document.body.appendChild(tip)
    }
    const c = (typeof colorHex === 'function') ? colorHex(o.color) : '#888'
    tip.innerHTML = `
      <span class="city-tooltip-name" style="color:${c}">${escText(o.username)}</span>
      <span class="city-tooltip-zone">en ${escText(zoneLabel(o.zone))}</span>
      <span class="city-tooltip-ago">${fmtAgo(o.updated_at)}</span>
    `
    tip.hidden = false
    City.moveOtherTooltip(clientX, clientY)
  }
  City.moveOtherTooltip = function (clientX, clientY) {
    const tip = document.getElementById('cityTooltip')
    if (!tip || tip.hidden) return
    tip.style.left = (clientX + 14) + 'px'
    tip.style.top  = (clientY - 14) + 'px'
  }
  City.hideOtherTooltip = function () {
    const tip = document.getElementById('cityTooltip')
    if (tip) tip.hidden = true
  }

  City.openOtherPopover = function (o, clientX, clientY) {
    City.activeOtherId = o.user_id
    City.hideOtherTooltip()
    let pop = document.getElementById('cityPopover')
    if (!pop) {
      pop = document.createElement('div')
      pop.id = 'cityPopover'
      pop.className = 'city-popover'
      document.body.appendChild(pop)
    }
    const c = (typeof colorHex === 'function') ? colorHex(o.color) : '#888'
    pop.innerHTML = `
      <div class="city-popover-head">
        <span class="city-popover-name" style="color:${c}">${escText(o.username)}</span>
        <span class="city-popover-where">en ${escText(zoneLabel(o.zone))} · ${fmtAgo(o.updated_at)}</span>
      </div>
      <div class="city-popover-actions">
        <button class="city-popover-btn" data-act="profile">ver perfil</button>
        <button class="city-popover-btn" data-act="chat">miau privado</button>
        <button class="city-popover-btn" data-act="hello">decir hola 💗</button>
      </div>
      <button class="city-popover-close" aria-label="cerrar">×</button>
    `
    pop.hidden = false
    pop.style.left = Math.min(window.innerWidth - 220, clientX + 10) + 'px'
    pop.style.top  = Math.min(window.innerHeight - 140, clientY + 10) + 'px'

    pop.querySelector('[data-act="profile"]').onclick = () => {
      City.closeOtherPopover()
      const slug = (o.username || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
      window.location.assign('/u/' + slug)
    }
    pop.querySelector('[data-act="chat"]').onclick = () => {
      City.closeOtherPopover()
      const slug = (o.username || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
      if (window.Routes) Routes.navigate('/chat/' + slug)
    }
    pop.querySelector('[data-act="hello"]').onclick = () => {
      o._heartUntil = performance.now() + 1500
      if (typeof showToast === 'function') showToast(`saludaste a ${o.username} 💗`, 1500)
      if (window.track) track('city:hello', { to: o.user_id })
      // Broadcast the wave so everyone else in the city sees the heart bubble too
      if (window.API) API.post('/city/wave', { to_user_id: o.user_id }).catch(() => {})
      City.closeOtherPopover()
    }
    pop.querySelector('.city-popover-close').onclick = () => City.closeOtherPopover()
  }
  City.closeOtherPopover = function () {
    const pop = document.getElementById('cityPopover')
    if (pop) pop.hidden = true
    City.activeOtherId = null
  }

  function escText(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
  }

  // Mascot center coords per zone — used by app.js to write presence from outside the city
  City.MASCOT_COORDS = ZONES.reduce((m, z) => {
    m[z.id] = { x: z.x + z.w/2, y: z.y + z.h/2 }
    return m
  }, {})

  // Write presence for a given mode (called by App.go for non-city modes)
  City.writePresenceForMode = async function (mode) {
    if (!App.user || !window.API) return
    const coords = City.MASCOT_COORDS[mode]
    if (!coords) return
    try { await API.post('/city/presence', { zone: mode, x: coords.x, y: coords.y }) } catch (_) {}
  }

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

// City — Phase 1: solo player. Canvas with 6 zones. WASD/click-to-walk.
// Zone detection emits enter:zone events. No networking yet.
;(function () {
  const W = 1280, H = 720
  const PLAYER_SPEED = 200  // px/sec
  const PLAYER_SIZE = 56    // sprite render size

  // 6 zones laid out 3x2 with a central plaza area.
  // building: emoji sprite + roof color define the silhouette.
  const ZONES = [
    { id: 'tweets',  name: 'el café',     x: 110,  y: 120, w: 320, h: 200, color: '#f0a85a', mascotColor: '#FFB800', habitat: 'tweets',  building: '☕', roof: '#c97a3a' },
    { id: 'posts',   name: 'el tablón',   x: 480,  y: 60,  w: 320, h: 200, color: '#5fa3d8', mascotColor: '#007AFF', habitat: 'posts',   building: '📌', roof: '#3877a6' },
    { id: 'stories', name: 'el miradero', x: 850,  y: 120, w: 320, h: 200, color: '#7a3a8e', mascotColor: '#BF7BD9', habitat: 'stories', building: '🌙', roof: '#552366' },
    { id: 'chat',    name: 'el banquito', x: 110,  y: 420, w: 320, h: 200, color: '#4abd76', mascotColor: '#34C759', habitat: 'chat',    building: '🪑', roof: '#2f8f56' },
    { id: 'bereal',  name: 'la polaroid', x: 480,  y: 460, w: 320, h: 200, color: '#ff8a3c', mascotColor: '#FF9500', habitat: 'bereal',  building: '📷', roof: '#cc6320' },
    { id: 'profile', name: 'tu casa',     x: 850,  y: 420, w: 320, h: 200, color: '#a87dd8', mascotColor: '#BF7BD9', habitat: 'profile', building: '🏠', roof: '#7e54a8' },
  ]
  const PLAZA = { x: 605, y: 340, w: 70, h: 70 }  // center

  // Static decorations: trees, lamps, fountain. Hand-placed so the town feels lived-in.
  const TREES   = [{ x: 70, y: 360 }, { x: 1210, y: 360 }, { x: 295, y: 380 }, { x: 985, y: 380 }]
  const LAMPS   = [{ x: 460, y: 360 }, { x: 820, y: 360 }]
  const FOUNTAIN = { x: 640, y: 380, r: 36 }

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
      // Cover the wrapper, keep the world's 16:9 aspect — letterbox if needed.
      const ratio = W / H
      let cw = wrap.clientWidth
      let ch = cw / ratio
      if (ch > wrap.clientHeight) { ch = wrap.clientHeight; cw = ch * ratio }
      // Hi-DPI: scale the backing buffer so canvas drawings stay crisp on retina.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      City.canvas.width  = Math.round(W * dpr)
      City.canvas.height = Math.round(H * dpr)
      City.canvas.style.width  = cw + 'px'
      City.canvas.style.height = ch + 'px'
      // Reset transform then apply DPR scale so all drawing code keeps using W × H units.
      City.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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
      const x = (e.clientX - r.left) * (W / r.width)
      const y = (e.clientY - r.top) * (H / r.height)
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

    onKey(e) {
      const down = e.type === 'keydown'
      const k = e.key.toLowerCase()
      if (k === 'w' || k === 'arrowup')    { City.keys.up = down;    City.target = null }
      else if (k === 's' || k === 'arrowdown')  { City.keys.down = down;  City.target = null }
      else if (k === 'a' || k === 'arrowleft')  { City.keys.left = down;  City.target = null }
      else if (k === 'd' || k === 'arrowright') { City.keys.right = down; City.target = null }
      else return
      if (down) e.preventDefault()
    },

    onPointer(e) {
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
      // Update URL without leaving city (so refresh still lands on the city map)
      if (window.history && history.replaceState) {
        history.replaceState({ mode: 'city', sheet: zone.habitat }, '', '/city')
      }
    },

    closeSheet() {
      const sheet = document.getElementById('zoneSheet')
      if (!sheet || sheet.hidden) return
      sheet.classList.remove('open')
      sheet.dataset.open = 'false'
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
      ctx.clearRect(0, 0, W, H)

      // ── 1. ground (tiled grass + plaza dirt + paths) ──
      City.drawGround(ctx, now)

      // ── 2. ambient back layer: trees behind buildings ──
      TREES.forEach(t => { if (t.y < 400) City.drawTree(ctx, t.x, t.y, now) })

      // ── 3. buildings (depth-sorted: top rows first so bottom rows overlap) ──
      const sortedZones = ZONES.slice().sort((a, b) => a.y - b.y)
      sortedZones.forEach(z => City.drawBuilding(ctx, z, now))

      // ── 4. fountain in plaza ──
      City.drawFountain(ctx, FOUNTAIN.x, FOUNTAIN.y, now)

      // ── 5. lamps (light on at night via World tint, but the post is always there) ──
      LAMPS.forEach(l => City.drawLamp(ctx, l.x, l.y, now))

      // ── 6. front-layer trees (in front of plaza) ──
      TREES.forEach(t => { if (t.y >= 400) City.drawTree(ctx, t.x, t.y, now) })

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

    drawGround(ctx, now) {
      // Big grass field (tile illusion via subtle dots)
      ctx.fillStyle = '#a8d8a0'
      ctx.fillRect(0, 0, W, H)

      // Tile dots — cheap pattern that reads as grass texture
      ctx.save()
      ctx.fillStyle = 'rgba(120,170,90,0.35)'
      const tile = 24
      for (let y = 0; y < H; y += tile) {
        for (let x = (y / tile) % 2 ? tile/2 : 0; x < W; x += tile) {
          ctx.fillRect(x, y, 2, 2)
        }
      }
      ctx.restore()

      // Central plaza (round dirt patch with cobble border)
      const cx = W/2, cy = H/2 + 20
      ctx.save()
      ctx.fillStyle = '#e8c898'
      ctx.beginPath(); ctx.ellipse(cx, cy, 280, 170, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(140,90,50,0.45)'
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Paths: from plaza center toward each building entrance
      ZONES.forEach(z => {
        const tx = z.x + z.w/2, ty = z.y + z.h - 30
        ctx.save()
        ctx.strokeStyle = '#d6b988'
        ctx.lineWidth = 22
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(tx, ty)
        ctx.stroke()
        // dashed mid-line to suggest cobble seams
        ctx.strokeStyle = 'rgba(180,140,90,0.45)'
        ctx.lineWidth = 2
        ctx.setLineDash([8, 10])
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(tx, ty)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      })
    },

    drawBuilding(ctx, z, now) {
      // Each zone is a building: small floor pad + roof silhouette + emoji sign +
      // mascot poporing in front. Sign hangs over the entrance.
      const cx = z.x + z.w/2, cy = z.y + z.h/2
      // Floor / shadow pad under the building
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.10)'
      ctx.beginPath(); ctx.ellipse(cx, z.y + z.h - 18, z.w * 0.36, 16, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()

      // Building silhouette: house shape with roof
      const bw = 160, bh = 120
      const bx = cx - bw/2, by = cy - bh/2 - 20
      // Walls
      ctx.save()
      ctx.fillStyle = '#fff7e8'
      ctx.strokeStyle = 'rgba(80,55,30,0.55)'
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.roundRect(bx, by + 30, bw, bh - 30, 8); ctx.fill(); ctx.stroke()
      // Roof (triangle with overhang)
      ctx.fillStyle = z.roof
      ctx.beginPath()
      ctx.moveTo(bx - 12, by + 38)
      ctx.lineTo(cx, by - 14)
      ctx.lineTo(bx + bw + 12, by + 38)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // Roof shadow stripe (subtle depth)
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.moveTo(bx - 12, by + 38)
      ctx.lineTo(bx + bw + 12, by + 38)
      ctx.lineTo(bx + bw + 12, by + 44)
      ctx.lineTo(bx - 12, by + 44)
      ctx.closePath()
      ctx.fill()
      // Window (warm glow with shutter)
      const winFlicker = (Math.sin(now/2200 + z.x*0.02) + 1) * 0.5
      ctx.fillStyle = `rgba(255, 230 + ${Math.round(winFlicker*8)}, 168, 1)`
      ctx.fillRect(bx + 18, by + 50, 26, 22)
      ctx.strokeRect(bx + 18, by + 50, 26, 22)
      ctx.beginPath(); ctx.moveTo(bx + 31, by + 50); ctx.lineTo(bx + 31, by + 72); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(bx + 18, by + 61); ctx.lineTo(bx + 44, by + 61); ctx.stroke()
      // Door
      ctx.fillStyle = '#8a5a32'
      ctx.beginPath(); ctx.roundRect(bx + bw - 50, by + 60, 32, bh - 60, 4); ctx.fill(); ctx.stroke()
      // Door step
      ctx.fillStyle = 'rgba(80,55,30,0.35)'
      ctx.fillRect(bx + bw - 54, by + bh - 4, 40, 4)
      // Door knob
      ctx.fillStyle = '#ffd86a'
      ctx.beginPath(); ctx.arc(bx + bw - 24, by + bh - 6, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.restore()

      // Per-zone roof detail: chimney with smoke, flag, antenna…
      City.drawRoofDetail(ctx, z, bx, by, bw, now)

      // Hanging sign with the emoji symbol — sways gently with the wind
      const swayS = Math.sin(now/1500 + z.x*0.01) * 1.5
      const sx = cx, sy = by - 24
      ctx.save()
      ctx.translate(sx, by - 14)
      ctx.rotate(swayS * Math.PI / 180)
      ctx.translate(-sx, -(by - 14))
      ctx.strokeStyle = 'rgba(80,55,30,0.7)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(sx, by - 14); ctx.lineTo(sx, sy); ctx.stroke()
      ctx.fillStyle = '#fff7e8'
      ctx.beginPath(); ctx.roundRect(sx - 22, sy - 16, 44, 26, 6); ctx.fill(); ctx.stroke()
      ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(z.building, sx, sy - 2)
      ctx.restore()

      // Mascot poporing in front of the door (clickable hotspot)
      const mascot = City.mascots[z.id]
      const my = z.y + z.h - 30
      const bob = Math.sin(now/600 + z.x*0.01) * 4
      ctx.save()
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

    drawRoofDetail(ctx, z, bx, by, bw, now) {
      ctx.save()
      const cx = bx + bw/2
      if (z.id === 'tweets') {
        // chimney with rising smoke
        const ch = bx + bw - 38, cy0 = by + 6
        ctx.fillStyle = '#a87859'
        ctx.fillRect(ch, cy0, 14, 22)
        ctx.strokeStyle = 'rgba(60,40,20,0.55)'; ctx.lineWidth = 1.5
        ctx.strokeRect(ch, cy0, 14, 22)
        for (let i = 0; i < 3; i++) {
          const t = ((now/1100) + i * 0.33) % 1
          const sx = ch + 7 + Math.sin(t * Math.PI * 2) * 6
          const sy = cy0 - t * 28
          ctx.fillStyle = `rgba(255,255,255,${0.55 - t*0.4})`
          ctx.beginPath(); ctx.arc(sx, sy, 5 + t*4, 0, Math.PI * 2); ctx.fill()
        }
      } else if (z.id === 'posts') {
        // pin flag with paper notes flapping
        const fx = cx, fy = by - 14
        ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 26); ctx.stroke()
        const flap = Math.sin(now/500) * 2
        ctx.fillStyle = '#fff7e8'
        ctx.beginPath()
        ctx.moveTo(fx, fy - 26)
        ctx.lineTo(fx + 18 + flap, fy - 22)
        ctx.lineTo(fx + 18 + flap, fy - 12)
        ctx.lineTo(fx, fy - 16)
        ctx.closePath(); ctx.fill()
        ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.stroke()
      } else if (z.id === 'stories') {
        // tiny moon hanging above the roof
        const mx = cx, my = by - 18
        const glow = (Math.sin(now/1400) + 1) * 0.5
        ctx.fillStyle = `rgba(255,236,168,${0.45 + glow*0.25})`
        ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff5d2'
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill()
      } else if (z.id === 'chat') {
        // speech bubble floating off the roof
        const bxb = cx - 6 + Math.sin(now/700) * 1.5
        const byb = by - 18 + Math.sin(now/600) * 1.5
        ctx.fillStyle = '#fff7e8'
        ctx.beginPath(); ctx.roundRect(bxb - 12, byb - 12, 24, 18, 6); ctx.fill()
        ctx.strokeStyle = 'rgba(60,40,20,0.55)'; ctx.lineWidth = 1.5; ctx.stroke()
        ctx.fillStyle = '#5a4730'
        ;[bxb - 5, bxb, bxb + 5].forEach(dx => {
          ctx.beginPath(); ctx.arc(dx, byb - 3, 1.3, 0, Math.PI * 2); ctx.fill()
        })
      } else if (z.id === 'bereal') {
        // camera lens "blink" on top of the roof
        const lx = cx, ly = by - 6
        ctx.fillStyle = '#3a3530'
        ctx.beginPath(); ctx.roundRect(lx - 14, ly - 10, 28, 16, 4); ctx.fill()
        ctx.fillStyle = '#7fc6e8'
        ctx.beginPath(); ctx.arc(lx, ly - 2, 6, 0, Math.PI * 2); ctx.fill()
        const blink = (Math.sin(now/520) + 1) * 0.5
        ctx.fillStyle = `rgba(255,80,80,${0.4 + blink*0.5})`
        ctx.beginPath(); ctx.arc(lx + 8, ly - 6, 2, 0, Math.PI * 2); ctx.fill()
      } else if (z.id === 'profile') {
        // weather vane on top
        const vx = cx, vy = by - 20
        ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(vx, by - 14); ctx.lineTo(vx, vy - 4); ctx.stroke()
        ctx.fillStyle = '#5a4730'
        const ang = Math.sin(now/2400) * 0.5
        ctx.translate(vx, vy - 4); ctx.rotate(ang)
        ctx.beginPath()
        ctx.moveTo(0, -6); ctx.lineTo(10, 0); ctx.lineTo(0, 6); ctx.lineTo(-3, 0)
        ctx.closePath(); ctx.fill()
      }
      ctx.restore()
    },

    drawFountain(ctx, x, y, now) {
      // Stone basin with animated water
      ctx.save()
      // Base shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath(); ctx.ellipse(x, y + 14, 46, 10, 0, 0, Math.PI * 2); ctx.fill()
      // Basin
      ctx.fillStyle = '#bdb1a3'
      ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 14, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(80,60,40,0.5)'; ctx.lineWidth = 2; ctx.stroke()
      // Water (rippling color shift)
      const ripple = (Math.sin(now/700) + 1) * 6
      ctx.fillStyle = '#7fc6e8'
      ctx.beginPath(); ctx.ellipse(x, y, 32 + ripple*0.1, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath(); ctx.ellipse(x - 8, y - 1, 8, 2, 0, 0, Math.PI * 2); ctx.fill()
      // Center spout + animated jet
      ctx.fillStyle = '#a8a094'
      ctx.fillRect(x - 4, y - 18, 8, 14)
      const jet = 14 + Math.sin(now/180) * 3
      ctx.fillStyle = 'rgba(180,220,240,0.85)'
      ctx.beginPath(); ctx.ellipse(x, y - 18 - jet/2, 4, jet/2, 0, 0, Math.PI * 2); ctx.fill()
      // Falling droplets
      for (let i = 0; i < 3; i++) {
        const t = ((now/600) + i * 0.33) % 1
        const dy = -18 + t * 22
        const dx = (i - 1) * 6
        ctx.fillStyle = 'rgba(180,220,240,0.7)'
        ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    },

    drawTree(ctx, x, y, now) {
      ctx.save()
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath(); ctx.ellipse(x, y + 32, 18, 5, 0, 0, Math.PI * 2); ctx.fill()
      // Trunk
      ctx.fillStyle = '#7a4d2a'
      ctx.fillRect(x - 4, y, 8, 28)
      ctx.strokeStyle = 'rgba(50,30,15,0.55)'; ctx.lineWidth = 1.5
      ctx.strokeRect(x - 4, y, 8, 28)
      // Foliage — three offset blobs with a subtle sway
      const sway = Math.sin(now/900 + x*0.01) * 1.5
      ctx.fillStyle = '#5fb070'
      ctx.beginPath(); ctx.arc(x + sway, y - 4, 18, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x - 10 + sway, y - 12, 14, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + 10 + sway, y - 12, 14, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#84cc92'
      ctx.beginPath(); ctx.arc(x - 4 + sway, y - 14, 6, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    },

    drawLamp(ctx, x, y, now) {
      ctx.save()
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath(); ctx.ellipse(x, y + 30, 8, 3, 0, 0, Math.PI * 2); ctx.fill()
      // Post
      ctx.fillStyle = '#3a3530'
      ctx.fillRect(x - 2, y - 28, 4, 56)
      // Lamp head
      ctx.fillStyle = '#3a3530'
      ctx.beginPath(); ctx.roundRect(x - 8, y - 38, 16, 14, 3); ctx.fill()
      // Glow (warm)
      const glow = (Math.sin(now/1200) + 1) * 0.5
      ctx.fillStyle = `rgba(255,210,120,${0.55 + glow*0.25})`
      ctx.beginPath(); ctx.arc(x, y - 31, 22, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffe6a3'
      ctx.beginPath(); ctx.arc(x, y - 31, 5, 0, Math.PI * 2); ctx.fill()
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

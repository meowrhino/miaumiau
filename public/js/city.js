// City — Phase 1: solo player. Canvas with 6 zones. WASD/click-to-walk.
// Zone detection emits enter:zone events. No networking yet.
;(function () {
  const W = 1280, H = 720
  const PLAYER_SPEED = 200  // px/sec
  const PLAYER_SIZE = 56    // sprite render size

  // 6 zones laid out 3x2 with a central plaza area
  const ZONES = [
    { id: 'tweets',  name: 'el café',     x: 110,  y: 120, w: 320, h: 200, color: '#f0a85a', mascotColor: '#FFB800', habitat: 'tweets' },
    { id: 'posts',   name: 'el tablón',   x: 480,  y: 60,  w: 320, h: 200, color: '#5fa3d8', mascotColor: '#007AFF', habitat: 'posts' },
    { id: 'stories', name: 'el miradero', x: 850,  y: 120, w: 320, h: 200, color: '#7a3a8e', mascotColor: '#BF7BD9', habitat: 'stories' },
    { id: 'chat',    name: 'el banquito', x: 110,  y: 420, w: 320, h: 200, color: '#4abd76', mascotColor: '#34C759', habitat: 'chat' },
    { id: 'bereal',  name: 'la polaroid', x: 480,  y: 460, w: 320, h: 200, color: '#ff8a3c', mascotColor: '#FF9500', habitat: 'bereal' },
    { id: 'profile', name: 'tu casa',     x: 850,  y: 420, w: 320, h: 200, color: '#a87dd8', mascotColor: '#BF7BD9', habitat: 'profile' },
  ]
  const PLAZA = { x: 605, y: 340, w: 70, h: 70 }  // center

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
    lastPresenceWrite: 0,
    lastPresenceState: null,

    enter() {
      const sec = document.getElementById('mode-city')
      if (!sec) return
      sec.hidden = false
      City.canvas = document.getElementById('cityCanvas')
      if (!City.canvas) return
      City.ctx = City.canvas.getContext('2d')
      City.canvas.width = W
      City.canvas.height = H
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

      // Presence: write own + poll others
      City.writePresence(true)
      clearInterval(City.pollTimer)
      City.pollTimer = setInterval(() => City.fetchOthers(), 5000)
      City.fetchOthers()
    },

    leave() {
      cancelAnimationFrame(City.raf)
      City.unbind()
      window.removeEventListener('resize', City.fitCanvas)
      clearInterval(City.pollTimer)
      // Optional: clear presence on leave (best-effort)
      if (App.user && window.API) API.del('/city/presence').catch(() => {})
    },

    fitCanvas() {
      if (!City.canvas) return
      const wrap = City.canvas.parentElement
      if (!wrap) return
      const ratio = W / H
      let cw = wrap.clientWidth
      let ch = cw / ratio
      if (ch > wrap.clientHeight) { ch = wrap.clientHeight; cw = ch * ratio }
      City.canvas.style.width = cw + 'px'
      City.canvas.style.height = ch + 'px'
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
      window.addEventListener('keydown', City.onEsc)
    },
    unbind() {
      window.removeEventListener('keydown', City.onKey)
      window.removeEventListener('keyup', City.onKey)
      if (City.canvas) City.canvas.removeEventListener('pointerdown', City.onPointer)
      window.removeEventListener('keydown', City.onEsc)
    },

    onEsc(e) {
      if (e.key === 'Escape') City.closeSheet()
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
      const r = City.canvas.getBoundingClientRect()
      const x = (e.clientX - r.left) * (W / r.width)
      const y = (e.clientY - r.top) * (H / r.height)
      // If click is on a zone's mascot, teleport there + open zone
      for (const z of ZONES) {
        const mx = z.x + z.w/2, my = z.y + z.h/2
        const d = Math.hypot(x - mx, y - my)
        if (d < 50) {
          City.teleportToZone(z.id)
          return
        }
      }
      City.target = { x, y }
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
        City.others = list.filter(o => o.user_id !== meId)
        // Lazy-load sprites for new others
        City.others.forEach(o => {
          if (City.otherSprites[o.user_id]) return
          const img = new Image()
          img.src = `/api/users/${o.user_id}/avatar.svg`
          img.onload = () => { City.otherSprites[o.user_id] = img }
        })
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

      // Plaza ground
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.beginPath(); ctx.ellipse(W/2, H/2, 360, 220, 0, 0, Math.PI * 2); ctx.fill()

      // Zones
      ZONES.forEach(z => {
        // Floor pad
        ctx.save()
        ctx.fillStyle = `${z.color}33`
        ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 22); ctx.fill()
        ctx.strokeStyle = `${z.color}77`
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()

        // Zone mascot poporing in center
        const cx = z.x + z.w/2, cy = z.y + z.h/2
        const bob = Math.sin(now/600 + z.x*0.01) * 4
        const mascot = City.mascots[z.id]
        if (mascot) {
          const size = 64
          ctx.save()
          ctx.shadowColor = z.color
          ctx.shadowBlur = 18
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(mascot, cx - size/2, cy - size/2 + bob, size, size)
          ctx.restore()
        } else {
          ctx.fillStyle = z.color
          ctx.beginPath(); ctx.arc(cx, cy + bob, 22, 0, Math.PI * 2); ctx.fill()
        }

        // Zone name pixel-style label
        ctx.save()
        ctx.font = '700 14px "Pixelify Sans", monospace'
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.textAlign = 'center'
        ctx.strokeText(z.name, cx, z.y + z.h - 14)
        ctx.fillText(z.name, cx, z.y + z.h - 14)
        ctx.restore()
      })

      // Plaza marker
      ctx.fillStyle = 'rgba(255,255,255,0.20)'
      ctx.beginPath(); ctx.roundRect(PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h, 16); ctx.fill()
      ctx.font = '600 11px "Pixelify Sans", monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.textAlign = 'center'
      ctx.fillText('plaza', PLAZA.x + PLAZA.w/2, PLAZA.y + PLAZA.h/2 + 4)

      // Other players (render before me so I'm on top)
      City.others.forEach(o => {
        const sprite = City.otherSprites[o.user_id]
        const bob = Math.sin(now/600 + o.user_id) * 2
        const ox = o.x, oy = o.y
        // shadow
        ctx.save()
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath(); ctx.ellipse(ox, oy + PLAYER_SIZE/2 - 6, 14, 4, 0, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
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
        // username label
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
      })

      // Player
      const p = City.player
      const bobP = p.walking ? Math.sin(now/100) * 2 : Math.sin(now/600) * 1
      // Shadow
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.30)'
      ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER_SIZE/2 - 4, 18, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      // Sprite
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

      // Tooltip "click on a poporing to enter that place"
      if (!City.currentZone) {
        ctx.save()
        ctx.font = '500 13px "Pixelify Sans", monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.textAlign = 'center'
        ctx.fillText('camina con WASD o click · click un poporing para entrar', W/2, H - 14)
        ctx.restore()
      }
    },
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

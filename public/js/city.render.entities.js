// City — entity renderers: drawFountain, drawTree, drawLamp, drawOther,
// drawPlayer, drawHud. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, PLAYER_SIZE, VERJA, WATER, ZONES } = window.CityConfig

  // Fuente de piedra de Cainos (hoja 'props', pila redonda) — corazón del feed.
  const CAINOS_FOUNTAIN = { sx: 352, sy: 269, sw: 96, sh: 72 }
  City.drawFountain = function (ctx, x, y, now) {
    ctx.save()
    ctx.imageSmoothingEnabled = false
    const props = window.Assets && Assets.get('cainos:props')
    if (props) {
      const r = CAINOS_FOUNTAIN, scale = 1.5
      const rw = r.sw * scale, rh = r.sh * scale
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath(); ctx.ellipse(x, y + rh * 0.30, rw * 0.42, 12, 0, 0, Math.PI * 2); ctx.fill()
      ctx.drawImage(props, r.sx, r.sy, r.sw, r.sh, x - rw / 2, y - rh / 2 - 4, rw, rh)
      // Brillo de agua animado sobre la pila
      for (let i = 0; i < 5; i++) {
        const t = ((now / 900) + i * 0.2) % 1
        const sxx = x + Math.sin(t * Math.PI * 2 + i * 1.3) * 22
        const syy = y - 6 + Math.cos(t * Math.PI * 2 + i) * 7
        ctx.fillStyle = `rgba(255,255,255,${0.5 - t * 0.3})`
        ctx.fillRect(sxx | 0, syy | 0, 2, 2)
      }
    } else {
      ctx.fillStyle = '#bdb1a3'
      ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 14, 0, 0, Math.PI * 2); ctx.fill()
      const jet = 8 + (Math.sin(now / 180) + 1) * 3
      ctx.fillStyle = 'rgba(190,225,245,0.85)'
      ctx.beginPath(); ctx.ellipse(x, y - 50 - jet / 2, 3, jet / 2, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  // Árboles de Cainos (hoja 'plant'): 3 variantes, cajas detectadas del atlas.
  const CAINOS_TREES = [
    { sx: 24, sy: 14, sw: 113, sh: 139 },
    { sx: 161, sy: 14, sw: 95, sh: 139 },
    { sx: 295, sy: 14, sw: 79, sh: 139 },
  ]
  City.drawTree = function (ctx, x, y, now, idx) {
    ctx.save()
    ctx.fillStyle = 'rgba(40,25,15,0.28)'
    ctx.beginPath(); ctx.ellipse(x, y + 24, 26, 8, 0, 0, Math.PI * 2); ctx.fill()
    ctx.imageSmoothingEnabled = false
    const sway = Math.sin(now / 1500 + x * 0.01) * 1.5
    const plant = window.Assets && Assets.get('cainos:plant')
    if (plant) {
      const r = CAINOS_TREES[(idx ?? 0) % CAINOS_TREES.length]
      const scale = 1.25
      const rw = r.sw * scale, rh = r.sh * scale
      ctx.drawImage(plant, r.sx, r.sy, r.sw, r.sh, x - rw / 2 + sway, y - rh + 22, rw, rh)
    } else {
      const sp = City.sprites
      if (sp && sp.trees && sp.trees[idx ?? 0]) {
        const img = sp.trees[idx ?? 0], s = 1.9
        ctx.drawImage(img, x - img.width * s / 2 + sway, y - img.height * s + 30, img.width * s, img.height * s)
      } else {
        ctx.fillStyle = '#3c8042'; ctx.beginPath(); ctx.arc(x, y - 8, 18, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.restore()
  }

  City.drawLamp = function (ctx, x, y, now) {
    const sp = City.sprites
    ctx.save()
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
  }

  City.drawOther = function (ctx, o, now) {
    const sprite = City.otherSprites[o.user_id]
    // Al caminar, salto de poporing (hop + squash & stretch, del motor Midgard);
    // quieto, respiración suave como antes.
    const walking = !!o._walking
    const wt = o._walkT || 0
    const hop = walking ? Math.abs(Math.sin(wt)) * 6 : 0
    const squash = walking ? 1 + Math.sin(wt * 2) * 0.06 : 1
    const bob = walking ? -hop : Math.sin(now/600 + o.user_id) * 2
    const ox = o.x, oy = o.y
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    const shScale = 1 - hop * 0.03   // la sombra encoge al saltar
    ctx.beginPath(); ctx.ellipse(ox, oy + PLAYER_SIZE/2 - 6, 14 * shScale, 4 * shScale, 0, 0, Math.PI * 2); ctx.fill()
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
      const s = PLAYER_SIZE - 8
      const w = s * squash, h = s / squash   // volumen conservado
      const baseY = oy + PLAYER_SIZE/2 - 4   // los pies quedan clavados al suelo
      ctx.translate(ox, baseY + bob)
      if (o._dir === 1) ctx.scale(-1, 1)
      ctx.drawImage(sprite, -w/2, -h, w, h)
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
    ctx.font = '600 11px "Galmuri11", "Pixelify Sans", monospace'
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.fillStyle = colorHex ? colorHex(o.color) : '#fff'
    ctx.strokeText(o.username, ox, oy - PLAYER_SIZE/2 - 2)
    ctx.fillText(o.username, ox, oy - PLAYER_SIZE/2 - 2)
    ctx.restore()
    // Proximity chat bubble (sesión 13)
    const say = City._says && City._says[o.user_id]
    if (say && say.until > now) {
      const a = (say.until - now) > 400 ? 1 : (say.until - now) / 400
      City.drawSpeechBubble(ctx, ox, oy - PLAYER_SIZE/2 - 12, say.text, a)
    }
  }

  City.drawPlayer = function (ctx, p, now) {
    // Salto de poporing al caminar (hop + squash del motor Midgard).
    const wt = p.walkT || 0
    const hop = p.walking ? Math.abs(Math.sin(wt)) * 6 : 0
    const squash = p.walking ? 1 + Math.sin(wt * 2) * 0.06 : 1
    const bobP = p.walking ? -hop : Math.sin(now/600) * 1
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    const shScale = 1 - hop * 0.03
    ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER_SIZE/2 - 4, 18 * shScale, 5 * shScale, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    if (p.sprite) {
      ctx.save()
      ctx.imageSmoothingEnabled = false
      const w = PLAYER_SIZE * squash, h = PLAYER_SIZE / squash
      const baseY = p.y + PLAYER_SIZE/2
      ctx.translate(p.x, baseY + bobP)
      if (p.dir === 1) ctx.scale(-1, 1)
      ctx.drawImage(p.sprite, -w/2, -h, w, h)
      ctx.restore()
    } else {
      ctx.fillStyle = '#FFB800'
      ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill()
    }
    // My own proximity chat bubble (sesión 13)
    const meId = (window.App && App.user) ? App.user.id : null
    const meSay = (meId != null && City._says) ? City._says[meId] : null
    if (meSay && meSay.until > now) {
      const a = (meSay.until - now) > 400 ? 1 : (meSay.until - now) / 400
      City.drawSpeechBubble(ctx, p.x, p.y - PLAYER_SIZE/2 - 12, meSay.text, a)
    }
  }

  // Speech bubble over an avatar — RO-style pergamino box + little tail.
  // Drawn in world space (inside the camera transform) so it tracks the map.
  // cx = avatar centre x; bottomY = where the tail tip points (just above head).
  City.drawSpeechBubble = function (ctx, cx, bottomY, text, alpha) {
    text = String(text == null ? '' : text)
    if (!text) return
    if (text.length > 42) text = text.slice(0, 41) + '…'
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha == null ? 1 : alpha))
    ctx.imageSmoothingEnabled = false
    ctx.font = '600 12px "Galmuri11", "Pixelify Sans", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const padX = 8, bh = 22
    const bw = ctx.measureText(text).width + padX * 2
    const bx = cx - bw / 2, by = bottomY - bh
    ctx.fillStyle = '#fff7ea'
    ctx.strokeStyle = '#241a33'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke()
    // tail pointing down toward the head
    ctx.beginPath()
    ctx.moveTo(cx - 5, by + bh - 1)
    ctx.lineTo(cx, by + bh + 6)
    ctx.lineTo(cx + 5, by + bh - 1)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#241a33'
    ctx.fillText(text, cx, by + bh / 2)
    ctx.restore()
  }

  // Small RO-style parchment panel helper (gradient + dark outline + hard shadow).
  City.drawPanel = function (ctx, x, y, w, h, r) {
    r = r == null ? 8 : r
    ctx.fillStyle = 'rgba(36,26,20,0.45)'
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w, h, r); ctx.fill()  // hard shadow
    const grd = ctx.createLinearGradient(0, y, 0, y + h)
    grd.addColorStop(0, '#f3e6c4'); grd.addColorStop(1, '#e2cd9b')
    ctx.fillStyle = grd
    ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 2; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,247,224,0.7)'; ctx.lineWidth = 1   // inner light bevel
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2)); ctx.stroke()
  }

  // (MUERTA) Antes pintaba el log del chat en canvas. Ahora el chat es una
  // ventana DOM estilo RO (City.mountChatWindow en city.chat.js). Se deja por si
  // algún día se quiere un fallback en canvas; drawHud ya no la llama.
  City.drawChatLog = function (ctx, x, bottomY) {
    const log = City._chatLog
    if (!log || !log.length) return
    const lines = log.slice(-7)
    ctx.save()
    ctx.font = '600 12px "Galmuri11", "Pixelify Sans", monospace'
    ctx.textBaseline = 'middle'
    const w = 360, lh = 17, h = lines.length * lh + 16
    const y = bottomY - h
    ctx.fillStyle = 'rgba(20,14,26,0.58)'
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill()
    let yy = y + 12
    for (const l of lines) {
      ctx.textAlign = 'left'
      const name = (l.name || 'gato') + ': '
      ctx.fillStyle = l.color || '#ffd24a'
      ctx.fillText(name, x + 10, yy)
      const nw = ctx.measureText(name).width
      ctx.fillStyle = '#eae4f0'
      let t = l.text; if (t.length > 38) t = t.slice(0, 37) + '…'
      ctx.fillText(t, x + 10 + nw, yy)
      yy += lh
    }
    ctx.restore()
  }

  // Minimapa estilo RO: verja + agua + zonas + puntos (otros de su color, yo
  // en blanco) + rectángulo del viewport. Todo escalado desde coords de mundo.
  const MINI_W = 128
  City.drawMinimap = function (ctx, bx, by, now) {
    const s = MINI_W / W
    const mh = Math.round(H * s)
    ctx.save()
    // marco pergamino
    City.drawPanel(ctx, bx, by, MINI_W + 8, mh + 8, 6)
    const mx = bx + 4, my = by + 4
    ctx.beginPath(); ctx.rect(mx, my, MINI_W, mh); ctx.clip()
    // hierba base + interior de la verja
    ctx.fillStyle = '#4c7c40'
    ctx.fillRect(mx, my, MINI_W, mh)
    if (VERJA && VERJA.length) {
      ctx.fillStyle = '#63a052'
      ctx.beginPath()
      VERJA.forEach((p, i) => i ? ctx.lineTo(mx + p.x * s, my + p.y * s) : ctx.moveTo(mx + p.x * s, my + p.y * s))
      ctx.closePath(); ctx.fill()
    }
    // agua
    if (WATER) {
      ctx.fillStyle = '#4a83b5'
      for (const w of WATER) {
        if (w.type === 'rect') ctx.fillRect(mx + w.x * s, my + w.y * s, w.w * s, w.h * s)
        else if (w.type === 'ellipse') {
          ctx.beginPath(); ctx.ellipse(mx + w.x * s, my + w.y * s, w.rx * s, w.ry * s, 0, 0, Math.PI * 2); ctx.fill()
        } else if (w.type === 'stroke' && w.pts) {
          ctx.strokeStyle = '#4a83b5'; ctx.lineWidth = Math.max(1, w.w * s); ctx.lineCap = 'round'
          ctx.beginPath()
          w.pts.forEach((p, i) => i ? ctx.lineTo(mx + p.x * s, my + p.y * s) : ctx.moveTo(mx + p.x * s, my + p.y * s))
          ctx.stroke()
        }
      }
    }
    // zonas (casitas/habitats): cuadraditos dorados suaves
    if (ZONES) {
      ctx.fillStyle = 'rgba(255,220,120,0.4)'
      for (const z of ZONES) ctx.fillRect(mx + z.x * s, my + z.y * s, Math.max(2, z.w * s), Math.max(2, z.h * s))
    }
    // viewport de la cámara
    const v = City._view
    if (v && v.scale) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1
      ctx.strokeRect(mx + (-v.ox / v.scale) * s, my + (-v.oy / v.scale) * s, (v.vw / v.scale) * s, (v.vh / v.scale) * s)
    }
    // otros: punto de su color (parpadea suave para que se vean vivos)
    for (const o of City.others) {
      ctx.fillStyle = (typeof colorHex === 'function' && colorHex(o.color)) || '#ffd24a'
      ctx.fillRect(mx + o.x * s - 1.5, my + o.y * s - 1.5, 3, 3)
    }
    // yo: blanco con halo
    const p = City.player
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath(); ctx.arc(mx + p.x * s, my + p.y * s, 4 + Math.sin(now / 300) * 1, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(mx + p.x * s - 2, my + p.y * s - 2, 4, 4)
    ctx.restore()
  }

  City.drawHud = function (ctx, now) {
    // El HUD se dibuja en ESPACIO DE PANTALLA (CSS px). Con la cámara-follow ya
    // no vale dibujar en coords de mundo: reseteamos la matriz a (dpr,0,0,dpr).
    const v = City._view || { vw: window.innerWidth, vh: window.innerHeight, dpr: 1 }
    const dpr = v.dpr || 1, VW = v.vw, VH = v.vh
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Pista (arriba-centro, para no chocar con la barra de chat de abajo)
    if (!City.currentZone) {
      ctx.font = '600 13px "Galmuri11", "Pixelify Sans", monospace'
      ctx.fillStyle = '#fff4d8'; ctx.strokeStyle = 'rgba(36,26,20,0.85)'
      ctx.lineWidth = 4; ctx.lineJoin = 'round'
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      const msg = 'WASD o click · click un poporing para entrar'
      ctx.strokeText(msg, VW / 2, 26); ctx.fillText(msg, VW / 2, 26)
    }
    // Contador online (arriba-izquierda) — placa de pergamino RO
    const total = City.others.length + 1
    if (total >= 2) {
      ctx.font = '700 14px "Galmuri11", "Pixelify Sans", monospace'
      const text = `${total} cats al poble`
      const pad = 12, bw = ctx.measureText(text).width + pad * 2, bh = 28, bx = 14, by = 14
      City.drawPanel(ctx, bx, by, bw, bh, 8)
      ctx.fillStyle = '#3a2a14'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(text, bx + pad, by + bh / 2 + 1)
    }
    // Minimapa (trasplante Midgard): parque en miniatura + puntos de la gente.
    // Solo en pantallas anchas; en móvil el espacio es oro.
    if (VW >= 640) City.drawMinimap(ctx, 14, total >= 2 ? 50 : 14, now)
    // Banner del recado activo (arriba-derecha) + estantería de recuerdos
    if (City.drawQuestBanner) City.drawQuestBanner(ctx, VW, VH)
    if (City.drawKeepsakeShelf) City.drawKeepsakeShelf(ctx, VW, VH)
    // El chat ya NO se pinta en canvas: ahora es una VENTANA DOM estilo RO
    // (City.mountChatWindow en city.chat.js). Ver City.drawChatLog abajo (muerta).
    ctx.restore()
  }
})()

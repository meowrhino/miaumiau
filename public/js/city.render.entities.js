// City — entity renderers: drawFountain, drawTree, drawLamp, drawOther,
// drawPlayer, drawHud. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, PLAYER_SIZE } = window.CityConfig

  City.drawFountain = function (ctx, x, y, now) {
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
  }

  City.drawTree = function (ctx, x, y, now, idx) {
    const sp = City.sprites
    ctx.save()
    ctx.fillStyle = 'rgba(40,25,15,0.30)'
    ctx.beginPath(); ctx.ellipse(x, y + 30, 20, 6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.imageSmoothingEnabled = false
    const sway = Math.sin(now/1500 + x*0.01) * 1.5
    // RO reskin: procedural trees (sprites.js). The Sprout Lands trees_sheet is
    // no longer used; a dedicated PNG could still override via Assets if added.
    if (sp && sp.trees && sp.trees[idx ?? 0]) {
      const img = sp.trees[idx ?? 0]
      const scale = 1.9
      const renderW = img.width * scale, renderH = img.height * scale
      ctx.drawImage(img, x - renderW/2 + sway, y - renderH + 30, renderW, renderH)
    } else {
      ctx.fillStyle = '#3c8042'
      ctx.beginPath(); ctx.arc(x, y - 8, 18, 0, Math.PI * 2); ctx.fill()
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

  // Ventana de chat estilo RO (abajo-izquierda). Espacio de PANTALLA.
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
    // Ventana de chat RO (abajo-izquierda)
    City.drawChatLog(ctx, 14, VH - 14)
    ctx.restore()
  }
})()

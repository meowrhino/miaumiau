// City — entity renderers: drawFountain, drawTree, drawLamp, drawOther,
// drawPlayer, drawHud. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, PLAYER_SIZE, TREE_RECTS } = window.CityConfig

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
    // Prefer Sprout Lands sheet with sub-rect; fall back to procedural sprite.
    const sheet = window.Assets && Assets.get('tile:trees_sheet')
    const rect  = TREE_RECTS && TREE_RECTS[(idx ?? 0) % TREE_RECTS.length]
    if (sheet && rect) {
      const scale = 2.4  // 16-px source pixels at 2.4x = pleasant chunky pixel art
      const renderW = rect.sw * scale, renderH = rect.sh * scale
      ctx.drawImage(sheet, rect.sx, rect.sy, rect.sw, rect.sh,
        x - renderW/2 + sway, y - renderH + 30, renderW, renderH)
    } else if (sp && sp.trees && sp.trees[idx ?? 0]) {
      const img = sp.trees[idx ?? 0]
      const renderW = img.width * 1.6, renderH = img.height * 1.6
      ctx.drawImage(img, x - renderW/2 + sway, y - renderH + 36, renderW, renderH)
    } else {
      ctx.fillStyle = '#5fb070'
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
    ctx.font = '600 11px "Pixelify Sans", monospace'
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.fillStyle = colorHex ? colorHex(o.color) : '#fff'
    ctx.strokeText(o.username, ox, oy - PLAYER_SIZE/2 - 2)
    ctx.fillText(o.username, ox, oy - PLAYER_SIZE/2 - 2)
    ctx.restore()
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
  }

  City.drawHud = function (ctx, now) {
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
  }
})()

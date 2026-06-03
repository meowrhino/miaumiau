// City — building renderers: drawBuilding (zona funcional con casita +
// cartel + mascot + nameplate), drawDecoBuilding (cottage/bakery/mill/etc),
// drawHouseOverlay (animaciones overlay por zona).
// Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City

  // Reskin Cainos: cada modo como "feature de parque" (props Cainos) en vez de casa.
  // Devuelve true si dibujó el feature (y entonces drawBuilding salta la casita).
  const SIGN = { sx: 96, sy: 160, sw: 32, sh: 42 }   // cartel de madera (props)
  const BUSH = [                                      // 6 arbustos (plant)
    { sx: 38, sy: 185, sw: 22, sh: 46 }, { sx: 98, sy: 185, sw: 27, sh: 46 },
    { sx: 156, sy: 185, sw: 38, sh: 46 }, { sx: 216, sy: 185, sw: 47, sh: 46 },
    { sx: 282, sy: 185, sw: 39, sh: 46 }, { sx: 346, sy: 185, sw: 40, sh: 46 },
  ]
  City.drawZoneFeature = function (ctx, z, now) {
    const A = window.Assets
    const props = A && A.get('cainos:props'), plant = A && A.get('cainos:plant')
    if (!props || !plant) return false
    const cx = z.x + z.w / 2, gy = z.y + z.h - 30
    function draw (img, p, dx, dy, scale) {
      const rw = p.sw * scale, rh = p.sh * scale
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(cx + dx, gy + dy + 2, rw * 0.42, 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, cx + dx - rw / 2, gy + dy - rh, rw, rh)
    }
    ctx.save(); ctx.imageSmoothingEnabled = false
    let handled = true
    if (z.id === 'posts') {                  // el tablón → carteles de madera
      draw(props, SIGN, -44, -6, 1.5); draw(props, SIGN, 6, 8, 1.8); draw(props, SIGN, 52, -2, 1.5)
    } else if (z.id === 'chat') {            // la Rosaleda → setos / arbustos
      draw(plant, BUSH[3], -54, 8, 1.7); draw(plant, BUSH[4], 42, 6, 1.7)
      draw(plant, BUSH[2], -8, 16, 1.9); draw(plant, BUSH[1], 72, 14, 1.5); draw(plant, BUSH[0], -88, 14, 1.5)
    } else { handled = false }
    ctx.restore()
    return handled
  }

  City.drawBuilding = function (ctx, z, now) {
    // Top-down pixel-art house sprite + animated overlays (smoke, sign,
    // mascot bob). Sprite is anchored at the doormat (in front of the door).
    const sp = City.sprites
    const cx = z.x + z.w/2
    const my = z.y + z.h - 30                    // doormat / mascot world pos
    const renderW = 180, renderH = 180
    const bx = cx - renderW/2
    const by = my - renderH + 8                  // sprite base sits at anchor

    // Soft top-down ground shadow under the building
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath(); ctx.ellipse(cx, my + 6, 44, 12, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Si el modo ya se dibujó como "feature de parque" Cainos, saltamos la casita.
    const _zoneHandled = City.drawZoneFeature && City.drawZoneFeature(ctx, z, now)
    if (!_zoneHandled) {
    const useAssetForZone = City.useImageAssets &&
      (!City._assetWhitelist || City._assetWhitelist.has(z.id))
    ctx.imageSmoothingEnabled = false
    const assetImg = useAssetForZone && window.Assets ? Assets.get('building:' + z.id) : null
    if (assetImg) {
      ctx.drawImage(assetImg, bx, by, renderW, renderH)
    } else if (sp && sp.house && sp.house[z.id]) {
      ctx.drawImage(sp.house[z.id], bx, by, renderW, renderH)
    } else {
      ctx.fillStyle = z.roof; ctx.fillRect(bx + 30, by + 40, renderW - 60, renderH - 50)
    }

    // Per-zone animated overlays (smoke, blink, glow)
    City.drawHouseOverlay(ctx, z, bx, by, renderW, renderH, now)

    // Hanging sign over the rooftop
    const swayS = Math.sin(now/1500 + z.x*0.01) * 2
    const sxSign = cx
    const signTop = by - 22
    ctx.save()
    ctx.translate(sxSign, signTop)
    ctx.rotate(swayS * Math.PI / 180)
    ctx.translate(-sxSign, -signTop)
    ctx.strokeStyle = 'rgba(80,55,30,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sxSign, signTop - 8); ctx.lineTo(sxSign, signTop); ctx.stroke()
    ctx.fillStyle = '#fff7e8'
    ctx.strokeStyle = 'rgba(80,55,30,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(sxSign - 22, signTop, 44, 26, 6); ctx.fill(); ctx.stroke()
    ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(z.building, sxSign, signTop + 14)
    ctx.restore()
    } // fin if (!_zoneHandled)

    // Doormat aura + progress ring (top-down)
    const distToMat = Math.hypot(City.player.x - cx, City.player.y - my)
    const isOnMat = City._matZoneId === z.id
    ctx.save()
    if (distToMat < 100) {
      const t = Math.max(0, 1 - distToMat / 100)
      const pulse = (Math.sin(now/600) + 1) * 0.5
      ctx.fillStyle = `rgba(255,236,168,${(0.10 + pulse * 0.15) * t})`
      ctx.beginPath(); ctx.ellipse(cx, my + 6, 32, 12, 0, 0, Math.PI * 2); ctx.fill()
    }
    if (isOnMat && City._matEnterTime) {
      const prog = Math.min(1, (performance.now() - City._matEnterTime) / 420)
      ctx.strokeStyle = z.color
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(cx, my + 6, 26, 10, 0, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2); ctx.stroke()
    }
    ctx.restore()

    // Mascot poporing standing at the doormat (bobbing)
    const mascot = City.mascots[z.id]
    const mascotSize = (City.mascotSizes && City.mascotSizes[z.id]) || 56
    const bob = Math.sin(now/600 + z.x*0.01) * 4
    if (mascot) {
      ctx.save()
      ctx.shadowColor = z.color
      ctx.shadowBlur = 14
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(mascot, cx - mascotSize/2, my - mascotSize + bob, mascotSize, mascotSize)
      ctx.restore()
    } else {
      ctx.fillStyle = z.color
      ctx.beginPath(); ctx.arc(cx, my - 20 + bob, 20, 0, Math.PI * 2); ctx.fill()
    }

    // Nameplate under the mascot
    ctx.save()
    ctx.font = '700 13px "Pixelify Sans", monospace'
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.strokeText(z.name, cx, my + 24)
    ctx.fillText(z.name, cx, my + 24)
    ctx.restore()
  }

  City.drawDecoBuilding = function (ctx, d, img, now) {
    // Decorative buildings render at d.x (center) with their footprint base at d.y.
    // d.h is the desired rendered height; width keeps the sprite's aspect ratio.
    const sp = City.sprites
    const useAssetForKind = City.useImageAssets &&
      (!City._assetWhitelist || City._assetWhitelist.has(d.kind))
    // RO reskin: every deco renders from its procedural RO sprite (sprites.js).
    // A dedicated hand-made PNG still overrides if one is dropped in later
    // (deco:<kind>[:variant]). The Sprout Lands sheets are no longer used.
    if (useAssetForKind && window.Assets) {
      const variant = (d.kind === 'cottage') ? (((d.seed || 0) % 4) + 1)
                    : (d.kind === 'stall')   ? (((d.seed || 0) % 2) + 1)
                    : null
      const key = variant ? ('deco:' + d.kind + ':' + variant) : ('deco:' + d.kind)
      const assetImg = Assets.get(key)
      if (assetImg) img = assetImg
    }
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
          ctx.fillStyle = '#3a2613'
          ctx.fillRect(2, -bladeW/2 - 1, bladeLen + 2, bladeW + 2)
          ctx.fillStyle = '#fff5e0'
          ctx.fillRect(3, -bladeW/2, bladeLen, bladeW)
          ctx.fillStyle = '#e0d0a8'
          ctx.fillRect(3, -bladeW/2 + bladeW - 2, bladeLen, 2)
          ctx.fillStyle = 'rgba(80,55,30,0.6)'
          for (let s = 8; s < bladeLen; s += 8) ctx.fillRect(3 + s, -bladeW/2 + 1, 1, bladeW - 2)
          ctx.rotate(Math.PI / 2)
        }
        // Hub cap (brown)
        ctx.fillStyle = '#3a2010'; ctx.fillRect(-5, -5, 10, 10)
        ctx.fillStyle = '#7a4d2a'; ctx.fillRect(-3, -3, 6, 6)
        ctx.restore()
      }
      // Bakery: animated steam from the chimney
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
  }

  City.drawHouseOverlay = function (ctx, z, bx, by, rw, rh, now) {
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
      const flagX = bx + (54/96) * rw
      const flagY = by + (8/96) * rh
      const flap = Math.sin(now/450) * 4
      ctx.fillStyle = `rgba(255,255,255,${0.25 + (Math.sin(now/300) + 1) * 0.15})`
      ctx.fillRect(flagX, flagY + flap, (10/96) * rw, 1)
    } else if (z.id === 'stories') {
      const slitX = bx + (48/96) * rw
      const slitY = by + (24/96) * rh
      const glow = (Math.sin(now/900) + 1) * 0.5
      ctx.fillStyle = `rgba(180,210,255,${0.18 + glow*0.20})`
      ctx.beginPath(); ctx.arc(slitX, slitY, 12, 0, Math.PI * 2); ctx.fill()
      const mx = sx, my = by - 6
      ctx.fillStyle = `rgba(255,236,168,${0.45 + glow*0.30})`
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff5d2'
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill()
    } else if (z.id === 'chat') {
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
  }
})()

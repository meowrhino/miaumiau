// City — render orchestrator + all draw* functions.
// Extends window.City with: render, drawGround, drawBuilding, drawDecoBuilding,
// drawHouseOverlay, drawFountain, drawTree, drawLamp, drawOther, drawPlayer, drawHud.
// Loads after city.js (extends the City object created there).
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const {
    W, H, PLAYER_SIZE, ISO_BBOX_W, ISO_BBOX_H,
    w2s, s2w,
    ZONES, PLAZA, FOUNTAIN, DECO_BUILDINGS, TREES, LAMPS,
  } = window.CityConfig

  City.render = function (now) {
    const ctx = City.ctx
    if (!ctx) return
    // Visible bounds in iso-screen-space. Used by drawGround to know how much
    // extra grass to paint outside the world rect so the viewport never has gaps.
    const v = City._view || { scale: 1, ox: 0, oy: 0, vw: W, vh: H }
    const visL = -v.ox / v.scale
    const visT = -v.oy / v.scale
    const visR = (v.vw - v.ox) / v.scale
    const visB = (v.vh - v.oy) / v.scale
    ctx.clearRect(visL, visT, visR - visL, visB - visT)

    // ── 0. drifting clouds across the upper viewport (free of iso projection) ──
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
        ctx.drawImage(cl, cx, cy, cl.width * 1.6, cl.height * 1.6)
        ctx.globalAlpha = 1
      }
    }

    // ── 1. iso ground (rhombic tiles + plaza + paths + bushes/flowers) ──
    City.drawGround(ctx, now, visL, visT, visR, visB)

    // ── 2-7. depth-sorted entities. With iso projection sy = (wx + wy)/2, so
    //   sorting by (wx + wy) gives correct front-to-back order for everything:
    //   trees, buildings, fountain, lamps, decorative buildings, characters.
    const entities = []
    TREES.forEach((t, i) => entities.push({ kind: 'tree', wx: t.x, wy: t.y, idx: i }))
    ZONES.forEach(z => entities.push({ kind: 'zone', wx: z.x + z.w/2, wy: z.y + z.h - 30, ref: z }))
    DECO_BUILDINGS.forEach((d, i) => entities.push({ kind: 'deco', wx: d.x, wy: d.y, ref: d, idx: i }))
    LAMPS.forEach(l => entities.push({ kind: 'lamp', wx: l.x, wy: l.y }))
    entities.push({ kind: 'fountain', wx: FOUNTAIN.x, wy: FOUNTAIN.y })
    City.others.forEach(o => entities.push({ kind: 'other', wx: o.x, wy: o.y, ref: o }))
    entities.push({ kind: 'me', wx: City.player.x, wy: City.player.y, ref: City.player })
    entities.sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy))
    for (const e of entities) {
      if      (e.kind === 'tree')     City.drawTree(ctx, e.wx, e.wy, now, e.idx)
      else if (e.kind === 'zone')     City.drawBuilding(ctx, e.ref, now)
      else if (e.kind === 'deco')     City.drawDecoBuilding(ctx, e.ref, City.sprites && City.sprites.deco[e.idx], now)
      else if (e.kind === 'lamp')     City.drawLamp(ctx, e.wx, e.wy, now)
      else if (e.kind === 'fountain') City.drawFountain(ctx, e.wx, e.wy, now)
      else if (e.kind === 'other')    City.drawOther(ctx, e.ref, now)
      else if (e.kind === 'me')       City.drawPlayer(ctx, e.ref, now)
    }

    // ── 8. HUD overlay (counter + tooltip) ──
    City.drawHud(ctx, now)
  }

  // ─── Render helpers (sesión 7: ciudad parece ciudad) ───

  City.drawGround = function (ctx, now, visL, visT, visR, visB) {
    visL = visL ?? -ISO_BBOX_W/2; visT = visT ?? 0; visR = visR ?? ISO_BBOX_W/2; visB = visB ?? ISO_BBOX_H
    const sp = City.sprites
    ctx.imageSmoothingEnabled = false

    // ─── Iso grass tiles ─────────────────────────────────────────────────────
    // We paint a rhombic tile per world cell. Tiles outside the world rect
    // (where wx<0 / wy<0 / wx>W / wy>H) still get painted so the viewport never
    // shows blank space. We compute which world tiles cover the visible iso bbox
    // by inverting the projection at the four screen corners.
    const TILE = 64        // world units per tile (large = fewer fills, still reads as grass)
    const halfX = TILE     // rhombus half-width in iso screen
    const halfY = TILE/2   // rhombus half-height
    const corners = [s2w(visL, visT), s2w(visR, visT), s2w(visR, visB), s2w(visL, visB)]
    let minWX = Infinity, maxWX = -Infinity, minWY = Infinity, maxWY = -Infinity
    for (const c of corners) {
      if (c.wx < minWX) minWX = c.wx; if (c.wx > maxWX) maxWX = c.wx
      if (c.wy < minWY) minWY = c.wy; if (c.wy > maxWY) maxWY = c.wy
    }
    const startWX = Math.floor(minWX / TILE) * TILE - TILE
    const endWX   = Math.ceil(maxWX / TILE) * TILE + TILE
    const startWY = Math.floor(minWY / TILE) * TILE - TILE
    const endWY   = Math.ceil(maxWY / TILE) * TILE + TILE

    // Two grass tones, alternated like a checkerboard so the iso grid reads
    const colA = '#a8d8a0', colB = '#9bd095'
    for (let wy = startWY; wy < endWY; wy += TILE) {
      for (let wx = startWX; wx < endWX; wx += TILE) {
        const inWorld = wx >= 0 && wy >= 0 && wx < W && wy < H
        const c = (((wx/TILE) + (wy/TILE)) & 1) ? colB : colA
        // Outside the world rect, slightly darker grass to suggest distance/horizon
        ctx.fillStyle = inWorld ? c : '#90c890'
        const { sx, sy } = w2s(wx + TILE/2, wy + TILE/2)
        ctx.beginPath()
        ctx.moveTo(sx, sy - halfY)
        ctx.lineTo(sx + halfX, sy)
        ctx.lineTo(sx, sy + halfY)
        ctx.lineTo(sx - halfX, sy)
        ctx.closePath()
        ctx.fill()
      }
    }

    // Subtle grass speckles inside the world rect
    ctx.fillStyle = 'rgba(120,170,90,0.45)'
    for (let i = 0; i < 220; i++) {
      const wx = (i * 53) % W, wy = ((i * 97) + 17) % H
      const { sx, sy } = w2s(wx, wy)
      ctx.fillRect(sx|0, sy|0, 2, 2)
    }

    // ─── Iso paths (plaza → each zone), drawn as projected polygons ─────────
    const cx = PLAZA.x, cy = PLAZA.y
    const drawIsoPath = (ax, ay, bx, by, width, color, edge) => {
      const dx = bx - ax, dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len, ny = dx / len
      const half = width / 2
      const corners = [
        w2s(ax + nx * half, ay + ny * half),
        w2s(ax - nx * half, ay - ny * half),
        w2s(bx - nx * half, by - ny * half),
        w2s(bx + nx * half, by + ny * half),
      ]
      if (edge) {
        ctx.fillStyle = edge
        ctx.beginPath()
        const corners2 = [
          w2s(ax + nx * (half + 2), ay + ny * (half + 2)),
          w2s(ax - nx * (half + 2), ay - ny * (half + 2)),
          w2s(bx - nx * (half + 2), by - ny * (half + 2)),
          w2s(bx + nx * (half + 2), by + ny * (half + 2)),
        ]
        ctx.moveTo(corners2[0].sx, corners2[0].sy)
        for (let i = 1; i < 4; i++) ctx.lineTo(corners2[i].sx, corners2[i].sy)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(corners[0].sx, corners[0].sy)
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy)
      ctx.closePath()
      ctx.fill()
    }
    ZONES.forEach(z => {
      const tx = z.x + z.w/2, ty = z.y + z.h - 30
      drawIsoPath(cx, cy, tx, ty, 28, '#d6b988', '#a08868')
    })

    // ─── Plaza: rombo iso de adoquines (cobble tile pattern) ────────────────
    // Plaza is an ellipse in world coords (PLAZA.rx × PLAZA.ry). In iso it
    // becomes an oblique ellipse — clip to its world ellipse projected, then
    // tile cobble inside.
    ctx.save()
    ctx.beginPath()
    const PLAZA_VERTS = 32
    for (let i = 0; i < PLAZA_VERTS; i++) {
      const a = (i / PLAZA_VERTS) * Math.PI * 2
      const wx = cx + Math.cos(a) * PLAZA.rx
      const wy = cy + Math.sin(a) * PLAZA.ry
      const { sx, sy } = w2s(wx, wy)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    ctx.clip()
    // Inside the clip, paint cobble-shaped iso tiles (smaller than grass)
    const COBBLE = 32
    for (let wy = cy - PLAZA.ry - COBBLE; wy < cy + PLAZA.ry + COBBLE; wy += COBBLE) {
      for (let wx = cx - PLAZA.rx - COBBLE; wx < cx + PLAZA.rx + COBBLE; wx += COBBLE) {
        const tone = (((wx/COBBLE)|0) + ((wy/COBBLE)|0)) & 1
        ctx.fillStyle = tone ? '#d8c8a0' : '#c8b890'
        const { sx, sy } = w2s(wx + COBBLE/2, wy + COBBLE/2)
        ctx.beginPath()
        ctx.moveTo(sx, sy - COBBLE/2)
        ctx.lineTo(sx + COBBLE, sy)
        ctx.lineTo(sx, sy + COBBLE/2)
        ctx.lineTo(sx - COBBLE, sy)
        ctx.closePath()
        ctx.fill()
      }
    }
    // Inner shading band along the rim
    ctx.strokeStyle = 'rgba(120,90,60,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i < PLAZA_VERTS; i++) {
      const a = (i / PLAZA_VERTS) * Math.PI * 2
      const wx = cx + Math.cos(a) * (PLAZA.rx - 4)
      const wy = cy + Math.sin(a) * (PLAZA.ry - 4)
      const { sx, sy } = w2s(wx, wy)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.restore()

    // Bushes / flower patches as billboarded sprites at their iso position
    if (sp) {
      const decoSpots = [
        { kind: 'bush',   x: 60,   y: 380, i: 0 },
        { kind: 'bush',   x: 670,  y: 700, i: 1 },
        { kind: 'bush',   x: 1220, y: 660, i: 2 },
        { kind: 'bush',   x: 220,  y: 700, i: 3 },
        { kind: 'flower', x: 350,  y: 80,  i: 0 },
        { kind: 'flower', x: 850,  y: 700, i: 1 },
        { kind: 'flower', x: 1100, y: 80,  i: 2 },
        { kind: 'flower', x: 60,   y: 500, i: 0 },
      ]
      for (const d of decoSpots) {
        const img = d.kind === 'bush' ? sp.bushes[d.i % sp.bushes.length] : sp.flowers[d.i % sp.flowers.length]
        if (img) {
          const { sx, sy } = w2s(d.x, d.y)
          ctx.drawImage(img, sx - img.width/2, sy - img.height)
        }
      }
    }
  }

  City.drawBuilding = function (ctx, z, now) {
    // Iso-positioned pixel-art house sprite + animated overlays (smoke, sign,
    // mascot bob). The sprite stays "billboarded" — drawn frontally — but
    // its anchor (the doormat in front of the door) lives in iso screen-space.
    const sp = City.sprites
    const cx = z.x + z.w/2
    const my = z.y + z.h - 30                    // doormat / mascot world pos
    const anchor = w2s(cx, my)                   // iso screen anchor
    const renderW = 180, renderH = 180
    const bx = anchor.sx - renderW/2
    const by = anchor.sy - renderH + 8           // sprite base sits at iso anchor

    // Iso ground shadow under the building
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath(); ctx.ellipse(anchor.sx, anchor.sy + 4, 70, 18, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // House sprite (frontal, anchored at iso position).
    // Prefer the loaded PNG asset when available; fall back to the procedural
    // sprite from sprites.js, then to a colored rect as last resort.
    const useAssetForZone = City.useImageAssets &&
      (!City._assetWhitelist || City._assetWhitelist.has(z.id))
    const assetImg = useAssetForZone && window.Assets ? Assets.get('building:' + z.id) : null
    const houseImg = assetImg || (sp && sp.house && sp.house[z.id])
    ctx.imageSmoothingEnabled = false
    if (houseImg) ctx.drawImage(houseImg, bx, by, renderW, renderH)
    else { ctx.fillStyle = z.roof; ctx.fillRect(bx + 30, by + 40, renderW - 60, renderH - 50) }

    // Per-zone animated overlays (smoke, blink, glow) — drawn in iso screen coords
    City.drawHouseOverlay(ctx, z, bx, by, renderW, renderH, now)

    // Hanging sign over the rooftop
    const swayS = Math.sin(now/1500 + z.x*0.01) * 2
    const sxSign = anchor.sx
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

    // Doormat aura + progress ring (in iso position)
    const distToMat = Math.hypot(City.player.x - cx, City.player.y - my)
    const isOnMat = City._matZoneId === z.id
    ctx.save()
    if (distToMat < 100) {
      const t = Math.max(0, 1 - distToMat / 100)
      const pulse = (Math.sin(now/600) + 1) * 0.5
      ctx.fillStyle = `rgba(255,236,168,${(0.10 + pulse * 0.15) * t})`
      ctx.beginPath(); ctx.ellipse(anchor.sx, anchor.sy + 4, 40, 18, 0, 0, Math.PI * 2); ctx.fill()
    }
    if (isOnMat && City._matEnterTime) {
      const prog = Math.min(1, (performance.now() - City._matEnterTime) / 420)
      ctx.strokeStyle = z.color
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(anchor.sx, anchor.sy + 4, 32, 14, 0, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2); ctx.stroke()
    }
    ctx.restore()

    // Mascot poporing standing at the doormat (sprite billboarded, bobbing)
    const mascot = City.mascots[z.id]
    const bob = Math.sin(now/600 + z.x*0.01) * 4
    if (mascot) {
      const size = 56
      ctx.save()
      ctx.shadowColor = z.color
      ctx.shadowBlur = 14
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(mascot, anchor.sx - size/2, anchor.sy - size + bob, size, size)
      ctx.restore()
    } else {
      ctx.fillStyle = z.color
      ctx.beginPath(); ctx.arc(anchor.sx, anchor.sy - 20 + bob, 20, 0, Math.PI * 2); ctx.fill()
    }

    // Nameplate under the mascot
    ctx.save()
    ctx.font = '700 13px "Pixelify Sans", monospace'
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.strokeText(z.name, anchor.sx, anchor.sy + 24)
    ctx.fillText(z.name, anchor.sx, anchor.sy + 24)
    ctx.restore()
  }

  City.drawDecoBuilding = function (ctx, d, img, now) {
    // Decorative buildings render at d.x (center) with their footprint base at d.y.
    // d.h is the desired rendered height; width keeps the sprite's aspect ratio.
    const sp = City.sprites
    // Prefer PNG asset (deco:<kind>:<seed%4+1> for cottage/stall, deco:<kind> otherwise)
    const useAssetForKind = City.useImageAssets &&
      (!City._assetWhitelist || City._assetWhitelist.has(d.kind))
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
  }

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
  }

  City.drawLamp = function (ctx, x, y, now) {
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

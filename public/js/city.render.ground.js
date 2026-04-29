// City — drawGround: top-down grass tiles + plaza cobble + paths + bushes/flowers.
// Extends window.City with: drawGround. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, ZONES, PLAZA, SPAWN, GRASS_TILE_RECT } = window.CityConfig

  // Spawn portal — runa pulsante donde aparecen los recién llegados.
  // Top-down circular runic disc with rotating cross + 4 compass dots + sparkles.
  City.drawSpawnPortal = function (ctx, now) {
    const px = SPAWN.x, py = SPAWN.y
    const pulse = (Math.sin(now / 720) + 1) * 0.5
    const rot = now * 0.0006

    // Outer warm halo
    ctx.fillStyle = `rgba(255, 220, 130, ${0.10 + pulse * 0.10})`
    ctx.beginPath(); ctx.arc(px, py, 48, 0, Math.PI * 2); ctx.fill()
    // Mid ring
    ctx.fillStyle = `rgba(220, 170, 80, ${0.32 + pulse * 0.18})`
    ctx.beginPath(); ctx.arc(px, py, 32, 0, Math.PI * 2); ctx.fill()
    // Inner disc
    ctx.fillStyle = `rgba(255, 245, 200, ${0.55 + pulse * 0.20})`
    ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill()

    // Rune cross at the center
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rot)
    ctx.strokeStyle = `rgba(160, 100, 40, ${0.55 + pulse * 0.25})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-14, 0); ctx.lineTo(14, 0)
    ctx.moveTo(0, -14); ctx.lineTo(0, 14)
    ctx.stroke()
    ctx.strokeStyle = `rgba(160, 100, 40, ${0.30 + pulse * 0.15})`
    ctx.beginPath()
    ctx.moveTo(-10, -10); ctx.lineTo(10, 10)
    ctx.moveTo(-10, 10);  ctx.lineTo(10, -10)
    ctx.stroke()
    ctx.restore()

    // 4 outer rune dots at compass points (counter-rotating)
    const dotRot = -rot
    const dotR = 28
    for (let i = 0; i < 4; i++) {
      const a = dotRot + (i * Math.PI / 2)
      const dx = px + Math.cos(a) * dotR
      const dy = py + Math.sin(a) * dotR
      ctx.fillStyle = `rgba(255, 200, 100, ${0.70 + pulse * 0.30})`
      ctx.beginPath(); ctx.arc(dx, dy, 1.8, 0, Math.PI * 2); ctx.fill()
    }

    // Floating sparkle particles rising
    for (let i = 0; i < 4; i++) {
      const t = ((now / 1700) + i * 0.25) % 1
      const angle = (i * 1.57) + t * 0.6
      const spx = px + Math.cos(angle) * (10 + t * 10)
      const spy = py - 4 - t * 22
      ctx.fillStyle = `rgba(255, 240, 180, ${0.65 - t * 0.65})`
      ctx.fillRect(spx | 0, spy | 0, 2, 2)
    }
  }

  City.drawGround = function (ctx, now, visL, visT, visR, visB) {
    visL = visL ?? 0; visT = visT ?? 0; visR = visR ?? W; visB = visB ?? H
    const sp = City.sprites
    ctx.imageSmoothingEnabled = false

    // ─── Grass tiles ────────────────────────────────────────────────────────
    // Prefer the Sprout Lands grass tile (16-px source rendered at 32-px world)
    // when the asset has loaded. Fall back to two-tone procedural fillRect
    // before the sheet arrives or if the asset failed to load.
    const grassSheet = window.Assets && Assets.get('tile:grass_sheet')
    if (grassSheet && GRASS_TILE_RECT) {
      const TILE = 32  // 16px source × 2 zoom = 32px world per tile
      const startWX = Math.floor(visL / TILE) * TILE - TILE
      const endWX   = Math.ceil(visR / TILE) * TILE + TILE
      const startWY = Math.floor(visT / TILE) * TILE - TILE
      const endWY   = Math.ceil(visB / TILE) * TILE + TILE
      const { sx, sy, sw, sh } = GRASS_TILE_RECT
      for (let wy = startWY; wy < endWY; wy += TILE) {
        for (let wx = startWX; wx < endWX; wx += TILE) {
          ctx.drawImage(grassSheet, sx, sy, sw, sh, wx, wy, TILE, TILE)
        }
      }
    } else {
      // Procedural fallback: two grass tones in a checkerboard.
      const TILE = 64
      const startWX = Math.floor(visL / TILE) * TILE - TILE
      const endWX   = Math.ceil(visR / TILE) * TILE + TILE
      const startWY = Math.floor(visT / TILE) * TILE - TILE
      const endWY   = Math.ceil(visB / TILE) * TILE + TILE
      const colA = '#a8d8a0', colB = '#9bd095'
      for (let wy = startWY; wy < endWY; wy += TILE) {
        for (let wx = startWX; wx < endWX; wx += TILE) {
          const inWorld = wx >= 0 && wy >= 0 && wx < W && wy < H
          const c = (((wx/TILE) + (wy/TILE)) & 1) ? colB : colA
          ctx.fillStyle = inWorld ? c : '#90c890'
          ctx.fillRect(wx, wy, TILE, TILE)
        }
      }
      ctx.fillStyle = 'rgba(120,170,90,0.45)'
      for (let i = 0; i < 220; i++) {
        const wx = (i * 53) % W, wy = ((i * 97) + 17) % H
        ctx.fillRect(wx|0, wy|0, 2, 2)
      }
    }

    // ─── Paths (plaza → each zone) ──────────────────────────────────────────
    const cx = PLAZA.x, cy = PLAZA.y
    const drawPath = (ax, ay, bx, by, width, color, edge) => {
      const dx = bx - ax, dy = by - ay
      const angle = Math.atan2(dy, dx)
      const len = Math.hypot(dx, dy)
      ctx.save()
      ctx.translate(ax, ay)
      ctx.rotate(angle)
      if (edge) {
        ctx.fillStyle = edge
        ctx.fillRect(0, -width/2 - 2, len, width + 4)
      }
      ctx.fillStyle = color
      ctx.fillRect(0, -width/2, len, width)
      ctx.restore()
    }
    ZONES.forEach(z => {
      const tx = z.x + z.w/2, ty = z.y + z.h - 30
      drawPath(cx, cy, tx, ty, 28, '#d6b988', '#a08868')
    })

    // ─── Plaza: cobble ellipse ──────────────────────────────────────────────
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, PLAZA.rx, PLAZA.ry, 0, 0, Math.PI * 2)
    ctx.clip()
    const COBBLE = 32
    for (let wy = cy - PLAZA.ry - COBBLE; wy < cy + PLAZA.ry + COBBLE; wy += COBBLE) {
      for (let wx = cx - PLAZA.rx - COBBLE; wx < cx + PLAZA.rx + COBBLE; wx += COBBLE) {
        const tone = (((wx/COBBLE)|0) + ((wy/COBBLE)|0)) & 1
        ctx.fillStyle = tone ? '#d8c8a0' : '#c8b890'
        ctx.fillRect(wx, wy, COBBLE, COBBLE)
      }
    }
    // Inner shading band along the rim
    ctx.strokeStyle = 'rgba(120,90,60,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(cx, cy, PLAZA.rx - 4, PLAZA.ry - 4, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // ─── Spawn portal ────────────────────────────────────────────────────────
    City.drawSpawnPortal(ctx, now)

    // Bushes / flower patches — sprite anchored at (d.x, d.y) base.
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
        if (img) ctx.drawImage(img, d.x - img.width/2, d.y - img.height)
      }
    }
  }
})()

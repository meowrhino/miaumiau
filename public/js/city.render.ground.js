// City — drawGround: iso grass tiles + plaza cobble + paths + bushes/flowers.
// Extends window.City with: drawGround. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, ISO_BBOX_W, ISO_BBOX_H, w2s, s2w, ZONES, PLAZA, SPAWN } = window.CityConfig

  // Spawn portal — runa pulsante donde aparecen los recién llegados.
  // Dibujada en iso, sobre el suelo (después del plaza cobble pero antes
  // de las entidades depth-sorted). Es parte de la "decoración del suelo".
  City.drawSpawnPortal = function (ctx, now) {
    const { sx: px, sy: py } = w2s(SPAWN.x, SPAWN.y)
    const pulse = (Math.sin(now / 720) + 1) * 0.5            // 0..1
    const rot = now * 0.0006                                  // slow spin for the rune ring

    // Outer warm halo (big soft ellipse, very faint)
    ctx.fillStyle = `rgba(255, 220, 130, ${0.10 + pulse * 0.10})`
    ctx.beginPath(); ctx.ellipse(px, py, 56, 26, 0, 0, Math.PI * 2); ctx.fill()

    // Mid ring (gold tint)
    ctx.fillStyle = `rgba(220, 170, 80, ${0.32 + pulse * 0.18})`
    ctx.beginPath(); ctx.ellipse(px, py, 38, 18, 0, 0, Math.PI * 2); ctx.fill()

    // Inner disc (warm cream)
    ctx.fillStyle = `rgba(255, 245, 200, ${0.55 + pulse * 0.20})`
    ctx.beginPath(); ctx.ellipse(px, py, 24, 11, 0, 0, Math.PI * 2); ctx.fill()

    // Rune cross at the center
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rot)
    ctx.strokeStyle = `rgba(160, 100, 40, ${0.55 + pulse * 0.25})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-16, 0); ctx.lineTo(16, 0)
    ctx.moveTo(0, -8);  ctx.lineTo(0, 8)
    ctx.stroke()
    // Diagonal accent strokes (like a 8-point compass)
    ctx.strokeStyle = `rgba(160, 100, 40, ${0.30 + pulse * 0.15})`
    ctx.beginPath()
    ctx.moveTo(-11, -5); ctx.lineTo(11, 5)
    ctx.moveTo(-11, 5);  ctx.lineTo(11, -5)
    ctx.stroke()
    ctx.restore()

    // 4 outer rune dots at compass points (counter-rotating for sparkle)
    const dotRot = -rot
    const dotR = 32, dotY = 15
    for (let i = 0; i < 4; i++) {
      const a = dotRot + (i * Math.PI / 2)
      const dx = px + Math.cos(a) * dotR
      const dy = py + Math.sin(a) * dotY
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

    // ─── Spawn portal (runa pulsante en el plaza) ────────────────────────────
    City.drawSpawnPortal(ctx, now)

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
})()

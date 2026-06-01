// City — drawGround: top-down grass tiles + plaza cobble + paths + bushes/flowers.
// Extends window.City with: drawGround. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, ZONES, PLAZA, SPAWN, ISLANDS, ISLAND_R, BRIDGES, GRASS_TILE_RECT } = window.CityConfig

  // Build the land mask path (3 islands + plaza ellipse + bridges).
  // Used both as a clip for grass tiles and as the shape for the sandy
  // shoreline ring. Centralised so render and shoreline stay in sync.
  function tracePath(ctx, inflate) {
    inflate = inflate || 0
    ctx.beginPath()
    for (const isl of ISLANDS) {
      const r = (isl.r || ISLAND_R) + inflate
      if (ctx.roundRect) {
        ctx.roundRect(isl.x - inflate, isl.y - inflate, isl.w + inflate * 2, isl.h + inflate * 2, r)
      } else {
        ctx.rect(isl.x - inflate, isl.y - inflate, isl.w + inflate * 2, isl.h + inflate * 2)
      }
    }
    // Plaza is an ellipse, inflated radially.
    ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx + inflate, PLAZA.ry + inflate, 0, 0, Math.PI * 2)
    // Bridges: rotated rectangles between (ax,ay)→(bx,by). Compute the four
    // corners in world coords (perpendicular offset = ±halfW; longitudinal
    // overshoot = inflate so the bridge merges seamlessly into the islands).
    if (BRIDGES) {
      for (const br of BRIDGES) {
        const dx = br.bx - br.ax, dy = br.by - br.ay
        const len = Math.hypot(dx, dy) || 1
        const halfW = (br.w + inflate * 2) / 2
        const nx = -dy / len, ny = dx / len           // perpendicular unit
        const ex = (dx / len) * inflate, ey = (dy / len) * inflate  // longitudinal extension
        const corners = [
          [br.ax - ex + nx * halfW, br.ay - ey + ny * halfW],
          [br.bx + ex + nx * halfW, br.by + ey + ny * halfW],
          [br.bx + ex - nx * halfW, br.by + ey - ny * halfW],
          [br.ax - ex - nx * halfW, br.ay - ey - ny * halfW],
        ]
        ctx.moveTo(corners[0][0], corners[0][1])
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1])
        ctx.closePath()
      }
    }
  }
  // Cache the path for reuse (Path2D would be cleaner but breaks transforms).
  City._traceLandPath = tracePath

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

    // ─── Water ocean (everything outside the world rect is sea) ─────────────
    // Animated soft blue water + drifting sparkles. The land mask further
    // down clips grass to the world rect; the band between sea and grass
    // gets a sandy shoreline for that island vibe.
    City.drawWater(ctx, now, visL, visT, visR, visB)
    // Sandy shoreline ring just outside the world rect (the "beach edge")
    City.drawShoreline(ctx)

    // ─── Grass tiles (clipped to the land mask: 3 islands + plaza + bridges) ──
    // Prefer the Sprout Lands grass tile (16-px source rendered at 32-px world)
    // when the asset has loaded. Fall back to two-tone procedural fillRect.
    ctx.save()
    tracePath(ctx, 0)
    ctx.clip('evenodd')
    // ── Césped estilo Ragnarok (procedural; ignora el tile Sprout Lands) ──
    // Campo verde con variación de tono por tile + briznas de hierba pixel y
    // alguna florecilla. Todo determinista (no parpadea entre frames).
    const TILE = 48
    const TONES = ['#6aa838', '#74b340', '#62a033', '#6fae3c']
    const gsx = Math.floor(visL / TILE) * TILE - TILE
    const gex = Math.ceil(visR / TILE) * TILE + TILE
    const gsy = Math.floor(visT / TILE) * TILE - TILE
    const gey = Math.ceil(visB / TILE) * TILE + TILE
    for (let wy = gsy; wy < gey; wy += TILE) {
      for (let wx = gsx; wx < gex; wx += TILE) {
        const inWorld = wx >= 0 && wy >= 0 && wx < W && wy < H
        const hsh = (((wx * 73856093) ^ (wy * 19349663)) >>> 0)
        ctx.fillStyle = inWorld ? TONES[hsh % TONES.length] : '#4f8a2a'
        ctx.fillRect(wx, wy, TILE, TILE)
      }
    }
    // briznas de hierba (tufts) + florecillas — patrón pseudo-aleatorio fijo
    for (let i = 0; i < 900; i++) {
      const wx = (i * 137 + i * i * 7) % W
      const wy = (i * 89 + 31) % H
      ctx.fillStyle = (i & 1) ? 'rgba(158,206,96,0.55)' : 'rgba(38,86,28,0.5)'
      ctx.fillRect(wx, wy, 1, 2)
      ctx.fillRect(wx + 1, wy - 1, 1, 2)
      if (i % 23 === 0) { ctx.fillStyle = 'rgba(255,238,90,0.7)'; ctx.fillRect(wx, wy - 1, 1, 1) }
      else if (i % 37 === 0) { ctx.fillStyle = 'rgba(240,240,255,0.75)'; ctx.fillRect(wx, wy - 1, 1, 1) }
    }
    ctx.restore() // end grass clip

    // ─── Wooden bridges (planks on top of bridge grass) ─────────────────────
    City.drawBridges(ctx)

    // ─── Plaza: cobble ellipse ──────────────────────────────────────────────
    const cx = PLAZA.x, cy = PLAZA.y
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, PLAZA.rx, PLAZA.ry, 0, 0, Math.PI * 2)
    ctx.clip()
    const COBBLE = 32
    for (let wy = cy - PLAZA.ry - COBBLE; wy < cy + PLAZA.ry + COBBLE; wy += COBBLE) {
      for (let wx = cx - PLAZA.rx - COBBLE; wx < cx + PLAZA.rx + COBBLE; wx += COBBLE) {
        const tone = (((wx/COBBLE)|0) + ((wy/COBBLE)|0)) & 1
        ctx.fillStyle = tone ? '#e4d8b4' : '#d0c198'
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

    // ─── Land-only decorations from here on ─────────────────────────────────

    // Bushes / flower patches — placed within the island bounds so they're
    // not floating on water after the island reorg.
    if (sp) {
      const decoSpots = [
        // ISLA NW
        { kind: 'bush',   x: 200, y: 330, i: 0 },
        { kind: 'flower', x: 350, y: 90,  i: 0 },
        // ISLA NE
        { kind: 'bush',   x: 1100, y: 340, i: 1 },
        { kind: 'flower', x: 870,  y: 350, i: 2 },
        // ISLA SE
        { kind: 'bush',   x: 1220, y: 670, i: 2 },
        { kind: 'bush',   x: 870,  y: 670, i: 3 },
        { kind: 'flower', x: 1100, y: 690, i: 1 },
        // PLAZA edges
        { kind: 'flower', x: 510, y: 530, i: 0 },
      ]
      for (const d of decoSpots) {
        const img = d.kind === 'bush' ? sp.bushes[d.i % sp.bushes.length] : sp.flowers[d.i % sp.flowers.length]
        if (img) ctx.drawImage(img, d.x - img.width/2, d.y - img.height)
      }
    }
  }

  // Animated ocean. Painted under everything else (called first by drawGround).
  // Two-tone blue base + slow-drifting wave bands + occasional sparkle pixels.
  City.drawWater = function (ctx, now, visL, visT, visR, visB) {
    // Base sea fill
    ctx.fillStyle = '#4f9fc4'
    ctx.fillRect(visL, visT, visR - visL, visB - visT)
    // Soft horizontal wave bands (slow vertical drift)
    const drift = (now / 60) % 24
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (let y = (Math.floor(visT / 24) * 24) - drift; y < visB; y += 24) {
      ctx.fillRect(visL, y, visR - visL, 2)
    }
    // Sparkle pixels (deterministic positions, twinkle by time)
    const cellW = visR - visL, cellH = visB - visT
    const baseAlpha = 0.45
    for (let i = 0; i < 60; i++) {
      const sx = visL + ((i * 137) % Math.max(1, cellW))
      const sy = visT + (((i * 191) + 47) % Math.max(1, cellH))
      const tw = (Math.sin(now / 800 + i * 1.7) + 1) * 0.5
      ctx.fillStyle = `rgba(255,255,255,${baseAlpha * tw})`
      ctx.fillRect(sx | 0, sy | 0, 2, 2)
    }
  }

  // Sandy shoreline ring around every land mass (3 islands + plaza + bridges).
  // Drawn AFTER water and BEFORE grass so the band shows on the sea side.
  // Two passes (sand band + wet-sand inner) using the shared land path
  // inflated by different amounts; even-odd fill carves the band shape.
  City.drawShoreline = function (ctx) {
    const sandWidth = 18
    ctx.save()
    // Outer sand band
    ctx.fillStyle = '#f0d8a0'
    tracePath(ctx, sandWidth)
    tracePath(ctx, 0)
    ctx.fill('evenodd')
    // Inner wet-sand seam
    ctx.fillStyle = '#dcc080'
    tracePath(ctx, 2)
    tracePath(ctx, 0)
    ctx.fill('evenodd')
    ctx.restore()
  }

  // Wooden bridge fill (planks). Drawn AFTER grass tiles so the wood sits on
  // top of the underlying island grass where bridge meets island, but BEFORE
  // entities so trees/buildings render on top.
  City.drawBridges = function (ctx) {
    if (!BRIDGES) return
    ctx.save()
    for (const br of BRIDGES) {
      const dx = br.bx - br.ax, dy = br.by - br.ay
      const len = Math.hypot(dx, dy) || 1
      const angle = Math.atan2(dy, dx)
      ctx.save()
      ctx.translate((br.ax + br.bx) / 2, (br.ay + br.by) / 2)
      ctx.rotate(angle)
      const w = br.w
      // Rope-edge (darker plank trim)
      ctx.fillStyle = '#7a4d2a'
      ctx.fillRect(-len/2 - 4, -w/2 - 2, len + 8, w + 4)
      // Planks (alternating wood tones, perpendicular to bridge axis)
      const plankW = 6
      for (let x = -len/2; x < len/2; x += plankW) {
        ctx.fillStyle = ((x / plankW) | 0) % 2 ? '#c89a68' : '#b88858'
        ctx.fillRect(x, -w/2, plankW - 1, w)
      }
      // Plank seams (subtle dark lines)
      ctx.fillStyle = 'rgba(80,55,30,0.35)'
      for (let x = -len/2; x < len/2; x += plankW) {
        ctx.fillRect(x + plankW - 1, -w/2, 1, w)
      }
      ctx.restore()
    }
    ctx.restore()
  }
})()

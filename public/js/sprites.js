// Pixel-art sprites for the city — procedural offscreen canvases, generated once at City.enter().
// Same spirit as poporing.js (deterministic on seed, palette derived from a base color), but bigger
// targets (houses, trees, fountain, decoration). Each generator returns a <canvas> ready for drawImage.
;(function () {
  // ─── Color helpers (mirror of poporing.js) ─────────────────────────────────
  const h2r = h => { const c = h.replace('#',''); return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)] }
  const r2h = (r,g,b) => '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')
  const lt = (h,a) => { const [r,g,b] = h2r(h); return r2h(r+(255-r)*a, g+(255-g)*a, b+(255-b)*a) }
  const dk = (h,a) => { const [r,g,b] = h2r(h); return r2h(r*(1-a), g*(1-a), b*(1-a)) }
  const mix = (h1, h2, a) => { const [r1,g1,b1] = h2r(h1); const [r2,g2,b2] = h2r(h2); return r2h(r1+(r2-r1)*a, g1+(g2-g1)*a, b1+(b2-b1)*a) }

  // ─── RNG (deterministic on seed) ────────────────────────────────────────────
  function rng(seed) {
    let s = (seed | 0) || 1
    return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 0xFFFFFFFF }
  }

  // ─── Canvas + paint helpers ─────────────────────────────────────────────────
  function mkc(w, h) {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    return { c, ctx }
  }
  function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x|0, y|0, w|0, h|0) }
  function px(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x|0, y|0, 1, 1) }
  function paintBlocks(ctx, blocks, ox=0, oy=0) {
    for (const [x, y, w, h, c] of blocks) { ctx.fillStyle = c; ctx.fillRect((x+ox)|0, (y+oy)|0, w|0, h|0) }
  }
  // Draw a triangle filled by horizontal scanlines (pixel-art chunky look).
  function tri(ctx, x0, y0, x1, y1, color) {
    // y0 = apex top; y1 = base. x0 = apex x; x1 = half-base width
    ctx.fillStyle = color
    const h = Math.max(1, y1 - y0)
    for (let i = 0; i <= h; i++) {
      const t = i / h
      const w = Math.round(x1 * t)
      ctx.fillRect(x0 - w, y0 + i, w*2 + 1, 1)
    }
  }
  // Outline a rectangle (1px) — useful for windows/doors.
  function outline(ctx, x, y, w, h, color) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, 1)
    ctx.fillRect(x, y+h-1, w, 1)
    ctx.fillRect(x, y, 1, h)
    ctx.fillRect(x+w-1, y, 1, h)
  }

  // ─── HOUSE PALETTE (Ragnarok town) ───────────────────────────────────────────
  // Warm sandstone walls + timber framing + saturated terracotta-style tiled roof.
  // The roof keeps each zone's identity HUE (café orange, tablón blue, …) but is
  // rendered as a steep, shingled, ridged roof — that shape is what reads as "RO".
  // opts: { wall, stroke, trim, door, win, stone, beam } — any override defaults below.
  function housePalette(roofColor, accentColor, opts) {
    opts = opts || {}
    const wall = opts.wall || '#ecdcb4'    // sandstone (RO town wall)
    const wallS = dk(wall, 0.12)
    const wallD = dk(wall, 0.24)
    const stone = opts.stone || '#cdb98e'  // foundation sillería
    const stoneD = dk(stone, 0.28)
    const beam = opts.beam || '#6f4a27'    // timber framing
    const beamD = dk(beam, 0.32)
    const trim = opts.trim || beam
    const trimD = dk(trim, 0.30)
    const door = opts.door || '#7a4a24'
    const doorD = dk(door, 0.30)
    const doorL = lt(door, 0.15)
    const win = opts.win || '#ffe9a8'      // warm window glow
    const winD = dk(win, 0.30)
    const winFrame = '#4a2f18'
    const roof = roofColor
    const roofS = dk(roofColor, 0.28)
    const roofL = lt(roofColor, 0.22)
    const roofE = dk(roofColor, 0.45)      // eave / deep shadow
    const ridge = '#fff0cf'                // warm ridge highlight
    const stroke = opts.stroke || '#2e2114'
    const groundShadow = 'rgba(40,25,15,0.32)'
    const accent = accentColor || lt(roofColor, 0.4)
    return { wall, wallS, wallD, stone, stoneD, beam, beamD, trim, trimD, door, doorD, doorL, win, winD, winFrame, roof, roofS, roofL, roofE, ridge, stroke, groundShadow, accent }
  }

  // ─── HOUSE BUILDER (shared base) ───────────────────────────────────────────
  // Produces a 96×96 logical sprite. The body is roughly 70×52 centered horizontally,
  // sitting at the bottom of the canvas. Variant features get layered on top.
  function paintHouseBase(ctx, p, opts) {
    const W = 96, H = 96
    const bw = opts.bw ?? 60
    const bh = opts.bh ?? 38
    const bx = (W - bw) / 2
    const by = H - bh - 8

    // Ground shadow under the building
    rect(ctx, bx - 6, H - 8, bw + 12, 4, p.groundShadow)
    rect(ctx, bx - 4, H - 4, bw + 8, 2, 'rgba(40,25,15,0.18)')

    // Sandstone wall body
    rect(ctx, bx, by, bw, bh, p.wall)
    rect(ctx, bx + bw - 3, by, 3, bh, p.wallS)             // right shade
    rect(ctx, bx, by, 1, bh, p.wallD)                      // left edge accent
    // Faint ashlar (stone-block) courses
    for (let yy = by + 7; yy < by + bh - 3; yy += 7) {
      rect(ctx, bx + 1, yy, bw - 4, 1, p.wallS)
      for (let xx = bx + ((yy & 7) ? 8 : 15); xx < bx + bw - 3; xx += 14) px(ctx, xx, yy + 1, p.wallS)
    }
    // Timber corner posts + top plate (Geffen-ish framing)
    rect(ctx, bx, by, 2, bh, p.beam)
    rect(ctx, bx + bw - 2, by, 2, bh, p.beam)
    rect(ctx, bx, by, bw, 2, p.beam)
    rect(ctx, bx, by, 1, bh, p.beamD)
    outline(ctx, bx, by, bw, bh, p.stroke)

    // Stone foundation course (sillería)
    rect(ctx, bx - 1, H - 9, bw + 2, 5, p.stone)
    for (let i = 0; i < bw + 2; i += 7) {
      px(ctx, bx - 1 + i, H - 9, p.stoneD)
      rect(ctx, bx - 1 + i, H - 6, 1, 2, p.stoneD)
    }
    rect(ctx, bx - 1, H - 4, bw + 2, 1, p.stroke)
  }

  // ─── ROOF: steep terracotta-style tiled gable (the signature RO silhouette) ──
  // Horizontal shingle banding + bright ridge + overhanging eaves with a little
  // pagoda upturn at the corners. Colours derive from the zone roof hue.
  function paintRoofTiled(ctx, p, opts) {
    opts = opts || {}
    const cx = opts.cx ?? 48
    const apex = opts.apexY ?? 14
    const baseY = opts.baseY ?? 50
    const halfBase = opts.halfBase ?? 40          // overhangs the wall (eaves)
    const h = Math.max(1, baseY - apex)

    // Eave shadow cast on the wall just under the roof
    rect(ctx, cx - halfBase + 3, baseY, (halfBase - 3) * 2, 2, p.roofE)

    // Roof triangle with horizontal shingle banding
    for (let i = 0; i <= h; i++) {
      const w = Math.round(halfBase * (i / h))
      const band = (i % 4 === 3)
      ctx.fillStyle = band ? p.roofS : p.roof
      ctx.fillRect(cx - w, apex + i, w * 2 + 1, 1)
      if (i % 2 === 0) px(ctx, cx - w + 1, apex + i, p.roofL)   // left-slope sheen
      if (band) for (let xx = cx - w + 3; xx < cx + w - 1; xx += 5) px(ctx, xx, apex + i, p.roofE)
    }
    // Slope outlines
    for (let i = 0; i <= h; i++) {
      const w = Math.round(halfBase * (i / h))
      px(ctx, cx - w, apex + i, p.stroke)
      px(ctx, cx + w, apex + i, p.stroke)
    }
    // Bright ridge down the centre
    for (let i = 0; i < h; i++) px(ctx, cx, apex + i + 1, (i % 3) ? p.roofL : p.ridge)
    // Eave lip + base outline
    rect(ctx, cx - halfBase, baseY - 2, halfBase * 2 + 1, 2, p.roofS)
    rect(ctx, cx - halfBase, baseY, halfBase * 2 + 1, 1, p.stroke)
    // Upturned eave tips (pagoda kick)
    paintBlocks(ctx, [
      [cx - halfBase - 2, baseY - 4, 2, 2, p.roofS],
      [cx - halfBase - 1, baseY - 3, 2, 2, p.roof],
      [cx + halfBase,     baseY - 3, 2, 2, p.roof],
      [cx + halfBase + 1, baseY - 4, 2, 2, p.roofS],
    ])
    // Finial knob at the apex
    paintBlocks(ctx, [
      [cx - 1, apex - 4, 2, 1, p.ridge],
      [cx - 1, apex - 3, 2, 4, p.beam],
    ])
  }

  // Small hanging pennant in an accent colour — extra RO flavour + zone identity
  // even when two zones share a roof hue. Anchored at (x,y) = hook top.
  function paintBannerRO(ctx, x, y, color) {
    const cD = dk(color, 0.30), cL = lt(color, 0.25)
    rect(ctx, x, y, 1, 3, '#4a2f18')              // hook
    rect(ctx, x - 3, y + 2, 7, 7, color)
    rect(ctx, x - 3, y + 2, 7, 1, cL)
    rect(ctx, x - 3, y + 8, 7, 1, cD)
    px(ctx, x - 1, y + 9, color); px(ctx, x + 1, y + 9, color)   // V-notch tip
    outline(ctx, x - 3, y + 2, 7, 7, '#3a2412')
  }

  // ─── HOUSE: el café ☕ (mansard roof + chimney + chalkboard hint baked in fascia) ──
  function houseCafe(roofColor, opts) {
    const p = housePalette(roofColor, '#c97a3a', opts)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 44 })
    paintRoofTiled(ctx, p, { apexY: 12, baseY: 50, halfBase: 40 })

    // Chimney with smoke pot (smoke is animated in city.js as overlay)
    paintBlocks(ctx, [
      [62, 8, 8, 22, p.trim],
      [62, 8, 8, 3, p.trimD],
      [60, 30, 12, 2, p.trimD],
    ])
    outline(ctx, 62, 8, 8, 22, p.stroke)

    // Awning over door (striped)
    paintBlocks(ctx, [
      [30, 56, 36, 4, '#cf3a2a'],
      [30, 56, 36, 1, lt('#cf3a2a', 0.25)],
    ])
    for (let x = 32; x < 64; x += 4) rect(ctx, x, 57, 2, 3, '#fff5e0')
    rect(ctx, 30, 60, 36, 2, dk('#cf3a2a', 0.30))

    // Door (arched, dark)
    paintBlocks(ctx, [
      [42, 64, 12, 22, p.door],
      [42, 64, 12, 2, p.doorL],
      [42, 84, 12, 2, p.doorD],
      [50, 74, 1, 1, '#ffd86a'],
    ])
    outline(ctx, 42, 64, 12, 22, p.stroke)
    px(ctx, 47, 64, p.stroke); px(ctx, 48, 64, p.stroke); px(ctx, 49, 64, p.stroke)

    // Big window with warm glow (left of door)
    paintBlocks(ctx, [
      [22, 66, 14, 14, p.win],
      [22, 66, 14, 2, p.winD],
    ])
    outline(ctx, 22, 66, 14, 14, p.winFrame)
    rect(ctx, 28, 66, 1, 14, p.winFrame)
    rect(ctx, 22, 72, 14, 1, p.winFrame)

    // Window flowerbox under window
    paintBlocks(ctx, [
      [20, 80, 18, 4, p.trimD],
      [22, 78, 2, 2, '#d04060'], [25, 78, 2, 2, '#f0c020'], [28, 78, 2, 2, '#d04060'], [31, 78, 2, 2, '#f0c020'], [34, 78, 2, 2, '#d04060'],
    ])

    // Sign post on wall: small "café" board (just the dark frame; emoji painted live)
    paintBlocks(ctx, [
      [60, 64, 12, 8, '#fff7e8'],
    ])
    outline(ctx, 60, 64, 12, 8, p.stroke)
    return c
  }

  // ─── HOUSE: el tablón 📌 (gable + flag + bulletin board on side) ─────────────
  function houseBoard(roofColor, opts) {
    const p = housePalette(roofColor, '#d4a83c', opts)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 60, bh: 40 })
    paintRoofTiled(ctx, p, { apexY: 14, baseY: 52, halfBase: 40 })

    // Flag on roof apex
    paintBlocks(ctx, [
      [47, 4, 2, 12, p.trim],   // pole
      [49, 5, 10, 6, '#cf3a2a'],
      [49, 5, 10, 1, lt('#cf3a2a', 0.3)],
      [49, 10, 10, 1, dk('#cf3a2a', 0.3)],
    ])

    // Door (sturdy, double panel hint)
    paintBlocks(ctx, [
      [42, 64, 14, 22, p.door],
      [42, 64, 14, 2, p.doorL],
      [42, 84, 14, 2, p.doorD],
      [49, 64, 1, 22, p.doorD],
      [54, 74, 1, 1, '#ffd86a'],
    ])
    outline(ctx, 42, 64, 14, 22, p.stroke)

    // Window left (cross-pane)
    paintBlocks(ctx, [
      [22, 60, 12, 12, p.win],
      [22, 60, 12, 2, p.winD],
    ])
    outline(ctx, 22, 60, 12, 12, p.winFrame)
    rect(ctx, 27, 60, 1, 12, p.winFrame)
    rect(ctx, 22, 65, 12, 1, p.winFrame)

    // Bulletin board attached to the right wall (cork with post-its)
    paintBlocks(ctx, [
      [62, 56, 16, 22, '#c89868'],     // cork
      [62, 56, 16, 1, '#a07848'],
      [62, 77, 16, 1, '#806038'],
    ])
    outline(ctx, 62, 56, 16, 22, p.stroke)
    // Post-its
    paintBlocks(ctx, [
      [64, 58, 5, 5, '#fff5a0'], [70, 60, 5, 4, '#a0e0c0'],
      [64, 65, 4, 5, '#f0a0c0'], [70, 67, 5, 4, '#a0d0f0'],
      [64, 72, 5, 4, '#fff5a0'], [70, 73, 4, 4, '#f0c080'],
    ])

    return c
  }

  // ─── HOUSE: el miradero 🌙 (compact observatory: normal house + small dome on top) ──
  // No taller than the other functional houses — just a regular gable with a tiny
  // dome+telescope perched on the apex.
  function houseObservatory(roofColor, opts) {
    const p = housePalette(roofColor, '#b890d8', opts)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 60, bh: 40 })
    paintRoofTiled(ctx, p, { apexY: 20, baseY: 52, halfBase: 40 })

    // Small dome perched on the roof apex
    const dcx = 48, dcy = 22
    for (let dy = -7; dy <= 0; dy++) {
      const r = Math.sqrt(49 - dy*dy)
      const xL = Math.round(dcx - r * 0.85)
      const xR = Math.round(dcx + r * 0.85)
      rect(ctx, xL, dcy + dy, xR - xL + 1, 1, dy < -5 ? p.roofL : p.roof)
    }
    // Dome outline
    for (let a = 0; a < Math.PI; a += 0.08) {
      const ex = Math.round(dcx + Math.cos(a) * 7 * 0.85)
      const ey = Math.round(dcy + Math.sin(a - Math.PI) * 7)
      px(ctx, ex, ey, p.stroke)
    }
    // Telescope slit (small)
    rect(ctx, dcx - 1, dcy - 6, 2, 7, '#0a0814')

    // A few stars next to the dome
    paintBlocks(ctx, [
      [14, 14, 1, 1, '#fff5d2'], [82, 12, 1, 1, '#fff5d2'],
      [22, 28, 1, 1, '#fff5d2'], [78, 28, 1, 1, '#fff5d2'],
    ])

    // Door (centered, normal)
    paintBlocks(ctx, [
      [42, 64, 12, 22, p.door],
      [42, 64, 12, 2, p.doorL],
      [50, 74, 1, 1, '#ffd86a'],
    ])
    outline(ctx, 42, 64, 12, 22, p.stroke)

    // Round porthole window (left)
    paintBlocks(ctx, [
      [22, 62, 12, 12, p.win],
    ])
    for (let yy = 62; yy < 74; yy++) for (let xx = 22; xx < 34; xx++) {
      const dx = xx - 27.5, dy = yy - 67.5
      if (dx*dx + dy*dy > 32) px(ctx, xx, yy, p.wall)
    }
    outline(ctx, 22, 62, 12, 12, p.winFrame)

    // Square window (right)
    paintBlocks(ctx, [
      [60, 62, 10, 10, p.win],
    ])
    outline(ctx, 60, 62, 10, 10, p.winFrame)
    rect(ctx, 65, 62, 1, 10, p.winFrame); rect(ctx, 60, 67, 10, 1, p.winFrame)

    return c
  }

  // ─── HOUSE: el banquito 🪑 (low porch + hanging plants + sleeping cat) ────────
  function houseBench(roofColor, opts) {
    const p = housePalette(roofColor, '#5fb070', opts)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 38 })
    paintRoofTiled(ctx, p, { apexY: 18, baseY: 54, halfBase: 40 })

    // Porch beam over door
    rect(ctx, 30, 56, 36, 3, p.trim)
    rect(ctx, 30, 56, 36, 1, lt(p.trim, 0.15))
    // Porch posts
    rect(ctx, 31, 58, 2, 28, p.trim)
    rect(ctx, 63, 58, 2, 28, p.trim)

    // Door (open, warm glow inside)
    paintBlocks(ctx, [
      [44, 64, 10, 22, p.door],
      [44, 64, 10, 2, p.doorL],
      [44, 64, 5, 22, mix(p.door, p.win, 0.3)],   // half-open hint
    ])
    outline(ctx, 44, 64, 10, 22, p.stroke)

    // Window
    paintBlocks(ctx, [
      [34, 60, 8, 8, p.win],
    ])
    outline(ctx, 34, 60, 8, 8, p.winFrame)
    rect(ctx, 38, 60, 1, 8, p.winFrame); rect(ctx, 34, 64, 8, 1, p.winFrame)
    paintBlocks(ctx, [
      [56, 60, 8, 8, p.win],
    ])
    outline(ctx, 56, 60, 8, 8, p.winFrame)
    rect(ctx, 60, 60, 1, 8, p.winFrame); rect(ctx, 56, 64, 8, 1, p.winFrame)

    // Hanging plants from porch beam
    paintBlocks(ctx, [
      [26, 56, 4, 6, '#a07848'],
      [25, 60, 6, 4, '#5fb070'], [26, 64, 4, 2, '#3d7a3a'],
      [66, 56, 4, 6, '#a07848'],
      [65, 60, 6, 4, '#5fb070'], [66, 64, 4, 2, '#3d7a3a'],
    ])

    // Cat sleeping on porch step (small sleeping shape)
    paintBlocks(ctx, [
      [56, 84, 8, 3, '#d8b888'],     // body
      [62, 83, 3, 2, '#d8b888'],     // head
      [55, 86, 1, 1, '#a07848'],     // tail tip
    ])
    px(ctx, 63, 83, '#3a2010')          // closed eye
    return c
  }

  // ─── HOUSE: la polaroid 📷 (studio + huge camera on roof + photo wall) ────────
  function housePolaroid(roofColor, opts) {
    const p = housePalette(roofColor, '#ff8a3c', opts)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 42 })
    paintRoofTiled(ctx, p, { apexY: 18, baseY: 50, halfBase: 40 })

    // Big camera mounted on flat roof
    paintBlocks(ctx, [
      [34, 18, 28, 14, '#3a3530'],
      [34, 18, 28, 2, '#5a554e'],
      [34, 30, 28, 2, '#1a1612'],
      [38, 14, 8, 4, '#3a3530'],            // viewfinder hump
    ])
    outline(ctx, 34, 18, 28, 14, '#0a0806')
    // Lens
    const lcx = 48, lcy = 25
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const r = Math.hypot(dx, dy)
      if (r <= 5) {
        const c2 = r > 4 ? '#1a1612' : (r > 2.5 ? '#5a554e' : (r > 1 ? '#7fc6e8' : '#fff5e0'))
        px(ctx, lcx + dx, lcy + dy, c2)
      }
    }
    px(ctx, 56, 20, '#ff5050') // shutter button red dot

    // Door
    paintBlocks(ctx, [
      [42, 64, 12, 22, p.door],
      [42, 64, 12, 2, p.doorL],
      [50, 74, 1, 1, '#ffd86a'],
    ])
    outline(ctx, 42, 64, 12, 22, p.stroke)

    // Photo wall on left (mini polaroids hanging)
    const photoStrip = [
      [16, 56, 12, 14, '#fff5e0'],
      [18, 58, 8, 8, '#7fc6e8'],
      [16, 56, 12, 1, '#d0b89a'],
    ]
    paintBlocks(ctx, photoStrip)
    paintBlocks(ctx, [
      [14, 70, 12, 14, '#fff5e0'],
      [16, 72, 8, 8, '#a8d8a0'],
      [14, 70, 12, 1, '#d0b89a'],
    ])
    paintBlocks(ctx, [
      [60, 56, 12, 14, '#fff5e0'],
      [62, 58, 8, 8, '#f0a0c0'],
      [60, 56, 12, 1, '#d0b89a'],
    ])
    return c
  }

  // ─── HOUSE: tu casa 🏠 (cozy home + mailbox + cat in window) ─────────────────
  function houseHome(roofColor, ownerColor, opts) {
    const p = housePalette(roofColor, '#a87dd8', opts)
    const cat = ownerColor || '#FFB800'
    const catL = lt(cat, 0.3)
    const catD = dk(cat, 0.25)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 40 })
    paintRoofTiled(ctx, p, { apexY: 14, baseY: 52, halfBase: 40 })

    // Heart-shape decoration above door (mini gable accent)
    paintBlocks(ctx, [
      [46, 52, 2, 2, '#d04060'], [49, 52, 2, 2, '#d04060'],
      [45, 54, 6, 2, '#d04060'],
      [46, 56, 4, 2, '#d04060'],
      [47, 58, 2, 1, '#d04060'],
    ])

    // Door
    paintBlocks(ctx, [
      [42, 64, 12, 22, p.door],
      [42, 64, 12, 2, p.doorL],
      [50, 74, 1, 1, '#ffd86a'],
    ])
    outline(ctx, 42, 64, 12, 22, p.stroke)

    // Window with cat peeking out (left)
    paintBlocks(ctx, [
      [22, 60, 14, 14, p.win],
      [22, 60, 14, 2, p.winD],
    ])
    outline(ctx, 22, 60, 14, 14, p.winFrame)
    rect(ctx, 28, 60, 1, 14, p.winFrame); rect(ctx, 22, 66, 14, 1, p.winFrame)
    // Cat in lower-right pane
    paintBlocks(ctx, [
      [29, 67, 6, 6, cat],
      [29, 67, 1, 6, catD], [34, 67, 1, 6, catD], [29, 72, 6, 1, catD],
      [29, 67, 1, 1, catD], [31, 67, 1, 1, catD], [33, 67, 1, 1, catD], // ear hints
    ])
    px(ctx, 31, 70, '#1a0f08'); px(ctx, 33, 70, '#1a0f08') // eyes

    // Mailbox in front of the house
    paintBlocks(ctx, [
      [60, 80, 2, 8, p.trim],            // post
      [56, 74, 12, 8, '#cf3a2a'],
      [56, 74, 12, 1, lt('#cf3a2a', 0.3)],
      [56, 81, 12, 1, dk('#cf3a2a', 0.3)],
    ])
    px(ctx, 67, 76, '#ffd86a') // flag
    rect(ctx, 67, 76, 1, 4, '#ffd86a')

    // Right window
    paintBlocks(ctx, [
      [56, 60, 8, 8, p.win],
    ])
    outline(ctx, 56, 60, 8, 8, p.winFrame)
    rect(ctx, 60, 60, 1, 8, p.winFrame); rect(ctx, 56, 64, 8, 1, p.winFrame)

    return c
  }

  // ─── EXPERIMENTAL — café "deluxe" pixel-art a mano (option 6 example) ─────────
  // Misma silueta base pero MUCHO más detalle: tejas individuales, persianas,
  // vidriera con muchos paneles, escalones, lámpara colgante, marquesina con
  // flecos, plantas, cartel pintado a mano. ~300 ops vs ~40 del baseline.
  function houseCafeDeluxe() {
    const W = 96, H = 96
    const { c, ctx } = mkc(W, H)
    // Custom palette — wood-brown façade en lugar de cream cream
    const wall = '#dcb98a', wallS = '#c69e6c', wallD = '#a07a48'
    const woodBeam = '#7a4d2a', woodBeamD = '#5a341c'
    const trim = '#7a4d2a', trimD = '#5a341c'
    const roof = '#a45032', roofL = '#c47050', roofS = '#7a3d24', roofD = '#5e2c1a'
    const tileLine = '#6f2e18'
    const win = '#fff0b8', winL = '#fff7d8', winFrame = '#3a2010'
    const door = '#4d2a14', doorL = '#7a4d2a', doorH = '#ffd86a'
    const stroke = '#3a2010'
    const gold = '#d4a83c', red = '#cf3a2a', redD = '#922a1c', cream = '#fff5e0'
    const groundShadow = 'rgba(40,25,15,0.32)'

    // Ground shadow (ellipse-ish via thin stripes)
    rect(ctx, 16, H - 6, 64, 3, groundShadow)
    rect(ctx, 14, H - 4, 68, 2, 'rgba(40,25,15,0.20)')

    // Foundation (stone slabs, varied tones)
    const stones = ['#8c7a5a', '#a0917a', '#7a6850', '#968360', '#a89878']
    for (let i = 0; i < 60; i += 6) {
      const s = stones[(i / 6) | 0 % stones.length] || stones[0]
      rect(ctx, 18 + i, H - 9, 5, 5, s)
      px(ctx, 18 + i + 4, H - 8, dk(s, 0.30))
      px(ctx, 18 + i, H - 5, dk(s, 0.30))
    }
    rect(ctx, 18, H - 5, 60, 1, '#3a2010')

    // Wall body
    rect(ctx, 18, 50, 60, 36, wall)
    // Wood corner beams (timber framing)
    rect(ctx, 18, 50, 3, 36, woodBeam)
    rect(ctx, 75, 50, 3, 36, woodBeam)
    rect(ctx, 18, 50, 60, 2, woodBeamD)        // top beam
    rect(ctx, 18, 84, 60, 2, woodBeamD)        // bottom beam
    rect(ctx, 18, 67, 60, 2, woodBeam)         // mid beam (timber framing line)
    // Vertical timbers (3 columns of decorative beams)
    rect(ctx, 36, 52, 1, 33, woodBeam)
    rect(ctx, 60, 52, 1, 33, woodBeam)
    // Subtle wall texture stipple
    for (let yy = 53; yy < 84; yy += 3) {
      for (let xx = 22; xx < 75; xx += 5) {
        if (((xx + yy) & 1) === 0) px(ctx, xx, yy, wallS)
      }
    }

    // Mansard roof — lower flare with VISIBLE TILES
    rect(ctx, 16, 38, 64, 10, roof)
    rect(ctx, 16, 38, 64, 2, roofL)
    rect(ctx, 16, 46, 64, 2, roofS)
    rect(ctx, 16, 48, 64, 2, roofD)
    // Individual tile lines (rounded shingles vibe)
    for (let x = 18; x < 80; x += 4) {
      px(ctx, x, 41, tileLine)
      px(ctx, x, 41 + 1, tileLine)
      px(ctx, x + 2, 44, tileLine)
      px(ctx, x + 2, 45, tileLine)
    }
    // Eave shadow under roof
    rect(ctx, 16, 50, 64, 1, '#3a2010')

    // Upper roof (mini mansard / trim)
    tri(ctx, 48, 18, 28, 38, roof)
    for (let i = 0; i <= 20; i++) {
      const w = Math.round(28 * i / 20)
      px(ctx, 48 - w, 18 + i, stroke)
      px(ctx, 48 + w, 18 + i, stroke)
    }
    // Tile rows on upper roof
    for (let row = 22; row < 38; row += 3) {
      const w = Math.round(28 * (row - 18) / 20)
      for (let xx = 48 - w + 1; xx <= 48 + w - 1; xx += 3) px(ctx, xx, row, tileLine)
    }
    // Roof ridge highlight
    for (let i = 0; i < 22; i += 1) px(ctx, 48, 17 + i, roofL)

    // Chimney (brick pattern)
    rect(ctx, 62, 8, 8, 22, '#a04020')
    rect(ctx, 62, 8, 8, 2, '#c45838')
    rect(ctx, 62, 28, 8, 2, '#7a2a18')
    // Brick lines
    for (let by = 11; by < 28; by += 4) {
      rect(ctx, 62, by, 8, 1, '#6a1c10')
      px(ctx, 65 + (by % 8 ? 0 : 2), by + 2, '#6a1c10')
    }
    rect(ctx, 60, 30, 12, 2, '#7a2a18')   // chimney cap
    outline(ctx, 60, 30, 12, 2, '#3a1408')
    outline(ctx, 62, 8, 8, 22, '#3a1408')

    // Awning over the door (striped + scalloped fringe)
    rect(ctx, 28, 56, 40, 5, red)
    rect(ctx, 28, 56, 40, 1, lt(red, 0.30))
    rect(ctx, 28, 60, 40, 1, redD)
    for (let x = 30; x < 68; x += 4) rect(ctx, x, 57, 2, 3, cream)
    // Scalloped fringe (dots)
    for (let x = 28; x <= 68; x += 4) {
      px(ctx, x, 62, redD)
      px(ctx, x + 1, 62, redD)
      px(ctx, x, 63, redD)
    }
    // Awning brackets
    rect(ctx, 27, 56, 1, 4, woodBeamD)
    rect(ctx, 68, 56, 1, 4, woodBeamD)

    // Door (paneled, with knob, glass strip at top)
    rect(ctx, 42, 64, 12, 22, door)
    rect(ctx, 42, 64, 12, 2, doorL)
    rect(ctx, 42, 84, 12, 2, '#1a0e08')
    rect(ctx, 47, 64, 1, 22, doorL)               // central groove
    // Glass insets at top of door
    rect(ctx, 44, 66, 3, 4, win)
    rect(ctx, 49, 66, 3, 4, win)
    px(ctx, 44, 66, winFrame); px(ctx, 47, 66, winFrame); px(ctx, 49, 66, winFrame); px(ctx, 52, 66, winFrame)
    rect(ctx, 44, 70, 8, 1, winFrame)
    // Doorknob
    px(ctx, 51, 75, gold); px(ctx, 51, 76, dk(gold, 0.3))
    outline(ctx, 42, 64, 12, 22, stroke)
    // Door step
    rect(ctx, 38, 86, 20, 2, '#7a6a50')
    rect(ctx, 38, 86, 20, 1, '#a09078')

    // Big window (left) — 3×3 lattice with curtains
    rect(ctx, 22, 64, 16, 16, win)
    rect(ctx, 22, 64, 16, 2, winL)               // top highlight
    // Lattice lines (creates 3x3 panes)
    rect(ctx, 22, 69, 16, 1, winFrame)
    rect(ctx, 22, 74, 16, 1, winFrame)
    rect(ctx, 27, 64, 1, 16, winFrame)
    rect(ctx, 32, 64, 1, 16, winFrame)
    outline(ctx, 22, 64, 16, 16, winFrame)
    // Curtains at sides (red + cream tied)
    rect(ctx, 22, 64, 2, 8, red)
    rect(ctx, 36, 64, 2, 8, red)
    px(ctx, 23, 71, redD); px(ctx, 36, 71, redD)
    // Window box with flowers
    rect(ctx, 20, 80, 20, 4, woodBeamD)
    rect(ctx, 20, 80, 20, 1, woodBeam)
    paintBlocks(ctx, [
      [22, 78, 2, 2, '#d04060'], [25, 78, 2, 2, '#f0c020'], [28, 78, 2, 2, '#d04060'],
      [31, 78, 2, 2, '#a8d0a0'], [34, 78, 2, 2, '#f0c020'], [37, 78, 2, 2, '#d04060'],
    ])
    // Tiny leaves
    px(ctx, 23, 79, '#5fa850'); px(ctx, 30, 79, '#5fa850'); px(ctx, 35, 79, '#5fa850')

    // Hanging café sign (right of door)
    rect(ctx, 60, 64, 14, 10, cream)
    outline(ctx, 60, 64, 14, 10, stroke)
    // Sign hanging chain
    rect(ctx, 66, 60, 1, 4, woodBeamD)
    rect(ctx, 67, 60, 1, 4, woodBeamD)
    // Painted "café" hint (a stylized C-shape via two arcs of pixels)
    paintBlocks(ctx, [
      [62, 66, 4, 1, woodBeam], [62, 67, 1, 4, woodBeam], [62, 71, 4, 1, woodBeam],
      [68, 66, 4, 1, woodBeam], [68, 70, 4, 1, woodBeam], [71, 67, 1, 3, woodBeam],
    ])

    // Hanging lantern (left of door)
    rect(ctx, 16, 56, 1, 4, woodBeamD)
    rect(ctx, 14, 60, 5, 6, '#3a2010')
    rect(ctx, 15, 61, 3, 4, '#ffd86a')             // glow
    px(ctx, 16, 62, '#fff5e0'); px(ctx, 17, 63, '#fff5e0')
    rect(ctx, 14, 66, 5, 1, '#3a2010')
    px(ctx, 16, 67, '#3a2010')

    // Cobblestone path stub at the very bottom
    paintBlocks(ctx, [
      [40, 88, 4, 3, '#a89878'], [44, 88, 4, 3, '#9a8868'],
      [48, 88, 4, 3, '#b09886'], [52, 88, 4, 3, '#a89878'],
    ])
    px(ctx, 41, 89, '#7a6a50'); px(ctx, 49, 90, '#7a6a50'); px(ctx, 54, 89, '#7a6a50')

    return c
  }

  // ─── EXPERIMENTAL — café SVG vector (option 7 example) ────────────────────────
  // Returns an SVG string (not a canvas). Render with new Image() + blob.
  // Look más "ilustración" — limpio, stroke fino, sin pixel-art.
  function houseCafeSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7e6c4"/><stop offset="1" stop-color="#dcc69a"/>
    </linearGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8704a"/><stop offset="1" stop-color="#a04030"/>
    </linearGradient>
    <linearGradient id="awning" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e74c3c"/><stop offset="1" stop-color="#a02818"/>
    </linearGradient>
    <pattern id="stripe" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="2" height="4" fill="#f4ede0"/>
    </pattern>
  </defs>

  <!-- ground shadow -->
  <ellipse cx="48" cy="89" rx="34" ry="3" fill="rgba(40,25,15,0.30)"/>

  <!-- main wall -->
  <rect x="18" y="50" width="60" height="36" rx="2" fill="url(#wall)" stroke="#5a3d20" stroke-width="0.8"/>

  <!-- mansard lower roof (curved) -->
  <path d="M 14 50 Q 14 38 28 38 L 68 38 Q 82 38 82 50 Z" fill="url(#roof)" stroke="#5a2818" stroke-width="0.8"/>
  <!-- visible roof tile lines -->
  <path d="M 16 44 H 80 M 18 47 H 78" stroke="#7a3018" stroke-width="0.4" fill="none" opacity="0.6"/>

  <!-- upper roof triangle -->
  <path d="M 28 38 L 48 18 L 68 38 Z" fill="url(#roof)" stroke="#5a2818" stroke-width="0.8" stroke-linejoin="round"/>
  <!-- ridge highlight -->
  <line x1="48" y1="18" x2="48" y2="38" stroke="#e88860" stroke-width="0.5"/>

  <!-- chimney -->
  <rect x="60" y="10" width="9" height="22" fill="#a85540" stroke="#5a2818" stroke-width="0.6" rx="0.5"/>
  <rect x="58" y="30" width="13" height="3" fill="#7a3525" stroke="#5a2818" stroke-width="0.6" rx="0.5"/>

  <!-- striped awning over door -->
  <path d="M 28 56 L 28 62 Q 48 64 68 62 L 68 56 Z" fill="url(#awning)" stroke="#7a1c10" stroke-width="0.5"/>
  <path d="M 34 62 Q 34 64 32 64 M 38 63 Q 38 65 36 65 M 42 63 Q 42 65 40 65 M 48 63 Q 48 65 46 65 M 54 63 Q 54 65 52 65 M 60 62 Q 60 64 58 64 M 64 62 Q 64 64 62 64" stroke="#7a1c10" stroke-width="0.4" fill="none"/>

  <!-- door -->
  <rect x="42" y="64" width="12" height="22" fill="#5a3320" stroke="#3a2010" stroke-width="0.6" rx="1"/>
  <line x1="48" y1="66" x2="48" y2="84" stroke="#7a4d2a" stroke-width="0.5"/>
  <rect x="44" y="66" width="3" height="4" fill="#fff0b8" stroke="#3a2010" stroke-width="0.4"/>
  <rect x="49" y="66" width="3" height="4" fill="#fff0b8" stroke="#3a2010" stroke-width="0.4"/>
  <circle cx="51" cy="76" r="0.6" fill="#d4a83c"/>

  <!-- left window with lattice -->
  <rect x="22" y="64" width="16" height="16" fill="#fff0b8" stroke="#3a2010" stroke-width="0.6" rx="1"/>
  <line x1="22" y1="69" x2="38" y2="69" stroke="#3a2010" stroke-width="0.5"/>
  <line x1="22" y1="74" x2="38" y2="74" stroke="#3a2010" stroke-width="0.5"/>
  <line x1="27" y1="64" x2="27" y2="80" stroke="#3a2010" stroke-width="0.5"/>
  <line x1="32" y1="64" x2="32" y2="80" stroke="#3a2010" stroke-width="0.5"/>
  <!-- curtains -->
  <path d="M 22 64 L 22 72 L 24 72 L 24 64 Z" fill="#cf3a2a"/>
  <path d="M 38 64 L 38 72 L 36 72 L 36 64 Z" fill="#cf3a2a"/>
  <!-- flowerbox -->
  <rect x="20" y="80" width="20" height="4" fill="#5a341c" stroke="#3a2010" stroke-width="0.5" rx="1"/>
  <circle cx="23" cy="79.5" r="1" fill="#d04060"/>
  <circle cx="27" cy="79" r="1" fill="#f0c020"/>
  <circle cx="31" cy="79.5" r="1" fill="#d04060"/>
  <circle cx="35" cy="79" r="1" fill="#f0c020"/>

  <!-- hanging sign -->
  <line x1="66" y1="60" x2="66" y2="64" stroke="#3a2010" stroke-width="0.6"/>
  <rect x="58" y="64" width="16" height="10" fill="#fff5e0" stroke="#3a2010" stroke-width="0.6" rx="1"/>
  <text x="66" y="72" font-family="serif" font-size="6" text-anchor="middle" fill="#5a341c" font-weight="700">café</text>

  <!-- foundation stones -->
  <rect x="18" y="86" width="60" height="3" fill="#7a6a50" stroke="#3a2010" stroke-width="0.5"/>
  <line x1="24" y1="86" x2="24" y2="89" stroke="#3a2010" stroke-width="0.4"/>
  <line x1="34" y1="86" x2="34" y2="89" stroke="#3a2010" stroke-width="0.4"/>
  <line x1="46" y1="86" x2="46" y2="89" stroke="#3a2010" stroke-width="0.4"/>
  <line x1="58" y1="86" x2="58" y2="89" stroke="#3a2010" stroke-width="0.4"/>
  <line x1="68" y1="86" x2="68" y2="89" stroke="#3a2010" stroke-width="0.4"/>
</svg>`
  }

  // ─── HOUSE DISPATCHER ──────────────────────────────────────────────────────
  // opts: { wall, stroke, trim, door, win } — palette overrides applied to housePalette.
  function paintHouse(zoneId, roofColor, ownerColor, opts) {
    if (zoneId === 'tweets')  return houseCafe(roofColor, opts)
    if (zoneId === 'posts')   return houseBoard(roofColor, opts)
    if (zoneId === 'stories') return houseObservatory(roofColor, opts)
    if (zoneId === 'chat')    return houseBench(roofColor, opts)
    if (zoneId === 'bereal')  return housePolaroid(roofColor, opts)
    if (zoneId === 'profile') return houseHome(roofColor, ownerColor, opts)
    return houseBench(roofColor, opts)
  }

  // ─── TREES (3 variants — RO) ─────────────────────────────────────────────────
  function treePine(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(40, 56)
    // Shadow
    rect(ctx, 12, 50, 16, 4, 'rgba(40,25,15,0.30)')
    // Trunk
    rect(ctx, 18, 42, 4, 12, '#5a3a1c')
    rect(ctx, 18, 42, 1, 12, dk('#5a3a1c', 0.30))
    rect(ctx, 21, 42, 1, 12, dk('#5a3a1c', 0.45))
    // Layered canopy (3 deep-green cones, RO conifer)
    const edge = '#173a1f'
    const layers = [
      { y: 32, hw: 15, h: 13, color: '#2c6a34' },
      { y: 21, hw: 12, h: 11, color: '#357c3d' },
      { y: 11, hw: 8,  h: 9,  color: '#479249' },
    ]
    for (const L of layers) {
      tri(ctx, 20, L.y, L.hw, L.y + L.h, L.color)
      // dark edges for a crisp pixel silhouette
      for (let i = 0; i <= L.h; i++) {
        const w = Math.round(L.hw * i / L.h)
        px(ctx, 20 - w, L.y + i, edge)
        px(ctx, 20 + w, L.y + i, edge)
      }
      // left-slope highlight
      for (let i = 0; i < L.h; i += 2) {
        const w = Math.round(L.hw * i / L.h)
        px(ctx, 20 - w + 1, L.y + i, lt(L.color, 0.22))
      }
    }
    // Tiny tip highlight
    px(ctx, 20, 11, '#7fc06a')
    return c
  }

  function treeLush(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(48, 56)
    rect(ctx, 14, 50, 20, 4, 'rgba(40,25,15,0.30)')
    // Trunk (runs up under the canopy so there's no gap between them)
    rect(ctx, 22, 30, 4, 24, '#5a3a1c')
    rect(ctx, 22, 30, 1, 24, dk('#5a3a1c', 0.30))
    // Big rounded foliage (deep RO greens, dark pixel border)
    const cx = 24, edge = '#1d4a26'
    const blobs = [
      { x: cx,    y: 16, r: 15, c: '#2f6b34' },
      { x: cx-10, y: 22, r: 11, c: '#357c3d' },
      { x: cx+10, y: 22, r: 11, c: '#357c3d' },
      { x: cx-4,  y: 12, r: 9,  c: '#46924a' },
    ]
    for (const b of blobs) {
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) {
        if (dx*dx + dy*dy <= b.r * b.r) {
          const xx = b.x + dx, yy = b.y + dy
          if (xx >= 0 && yy >= 0 && xx < 48 && yy < 56) {
            const onEdge = dx*dx + dy*dy >= (b.r-1)*(b.r-1)
            px(ctx, xx, yy, onEdge ? edge : b.c)
          }
        }
      }
    }
    // Sun-side highlight clump (top-left)
    for (let i = 0; i < 10; i++) {
      const sx = cx - 12 + Math.floor(r() * 14)
      const sy = 10 + Math.floor(r() * 12)
      px(ctx, sx, sy, '#6fb357')
    }
    // A few darker leaf gaps for texture
    for (let i = 0; i < 5; i++) {
      const sx = cx - 8 + Math.floor(r() * 18)
      const sy = 16 + Math.floor(r() * 14)
      px(ctx, sx, sy, '#244f29')
    }
    return c
  }

  // Payon-style autumn tree — warm amber/gold canopy for RO variety.
  function treeAutumn(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(44, 56)
    rect(ctx, 12, 50, 20, 4, 'rgba(40,25,15,0.30)')
    // Trunk (runs up under the canopy so there's no gap between them)
    rect(ctx, 20, 30, 4, 24, '#5a3a1c')
    rect(ctx, 20, 30, 1, 24, dk('#5a3a1c', 0.30))
    // Amber/gold canopy with a dark pixel border
    const cx = 22, edge = '#7a3f17'
    const blobs = [
      { x: cx, y: 18, r: 13, c: '#c2742a' },
      { x: cx-8, y: 22, r: 9, c: '#d8923a' },
      { x: cx+8, y: 22, r: 9, c: '#cf7f30' },
    ]
    for (const b of blobs) {
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) {
        if (dx*dx + dy*dy <= b.r * b.r) {
          const xx = b.x + dx, yy = b.y + dy
          if (xx >= 0 && yy >= 0 && xx < 44 && yy < 56) {
            const onEdge = dx*dx + dy*dy >= (b.r-1)*(b.r-1)
            px(ctx, xx, yy, onEdge ? edge : b.c)
          }
        }
      }
    }
    // Gold highlight specks
    for (let i = 0; i < 8; i++) {
      const sx = cx - 11 + Math.floor(r() * 22)
      const sy = 12 + Math.floor(r() * 14)
      px(ctx, sx, sy, '#e8b24a')
    }
    // Falling leaves
    for (let i = 0; i < 4; i++) {
      const fx = cx - 14 + Math.floor(r() * 28)
      const fy = 38 + Math.floor(r() * 14)
      px(ctx, fx, fy, '#cf7f30')
    }
    return c
  }

  function bush(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(28, 24)
    rect(ctx, 4, 20, 20, 3, 'rgba(40,25,15,0.30)')
    const cx = 14, cy = 14, rr = 10
    for (let dy = -rr; dy <= 4; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx*dx + dy*dy <= rr*rr) {
        const onEdge = dx*dx + dy*dy >= (rr-1)*(rr-1)
        px(ctx, cx + dx, cy + dy, onEdge ? '#1d4a26' : '#357c3d')
      }
    }
    // Highlight
    for (let i = 0; i < 5; i++) {
      px(ctx, cx - 6 + Math.floor(r()*12), cy - 4 + Math.floor(r()*4), '#6fb357')
    }
    // Tiny berries
    if (r() > 0.5) {
      px(ctx, cx-3, cy, '#d04060'); px(ctx, cx+4, cy-2, '#d04060')
    }
    return c
  }

  function flowerPatch(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(24, 16)
    const colors = ['#d04060', '#f0c020', '#7fc6e8', '#f5b0d0', '#a87dd8']
    for (let i = 0; i < 6; i++) {
      const fx = 2 + Math.floor(r() * 20)
      const fy = 4 + Math.floor(r() * 10)
      const cl = colors[Math.floor(r() * colors.length)]
      px(ctx, fx, fy, cl)
      px(ctx, fx-1, fy, dk(cl, 0.25))
      px(ctx, fx+1, fy, dk(cl, 0.25))
      px(ctx, fx, fy-1, lt(cl, 0.20))
      px(ctx, fx, fy+1, '#3a7a3a')        // stem
    }
    return c
  }

  // ─── FOUNTAIN ───────────────────────────────────────────────────────────────
  function fountain() {
    const { c, ctx } = mkc(72, 56)
    const stone = '#c6b89a', stoneD = dk(stone, 0.30), stoneL = lt(stone, 0.18)
    const water = '#3f86ab', waterD = dk(water, 0.34)
    // Shadow
    rect(ctx, 8, 48, 56, 6, 'rgba(40,25,15,0.30)')
    // Outer basin (octagonal-ish)
    paintBlocks(ctx, [
      [8, 36, 56, 12, stone],
      [8, 36, 56, 2, stoneL],
      [8, 46, 56, 2, stoneD],
      [4, 38, 4, 8, stoneD],
      [64, 38, 4, 8, stoneD],
    ])
    outline(ctx, 8, 36, 56, 12, '#2e2114')
    // Stone segments (bricks)
    for (let x = 12; x < 64; x += 8) px(ctx, x, 42, stoneD)
    // Inner water surface (ellipse)
    const cx = 36, cy = 42
    for (let dy = -4; dy <= 4; dy++) for (let dx = -22; dx <= 22; dx++) {
      if ((dx*dx)/484 + (dy*dy)/16 <= 1) {
        const xx = cx + dx, yy = cy + dy
        const cc = (Math.abs(dy) > 2) ? waterD : (Math.abs(dx) > 18 ? waterD : water)
        px(ctx, xx, yy, cc)
      }
    }
    // Water shimmer
    for (let i = 0; i < 5; i++) {
      const sx = cx - 14 + i * 5
      px(ctx, sx, cy - 2, 'rgba(255,255,255,0.65)')
    }
    // Pedestal in middle
    paintBlocks(ctx, [
      [32, 28, 8, 14, stone],
      [32, 28, 8, 2, stoneL],
      [32, 40, 8, 2, stoneD],
    ])
    outline(ctx, 32, 28, 8, 14, '#3a2613')
    // Top bowl
    paintBlocks(ctx, [
      [28, 22, 16, 6, stone],
      [28, 22, 16, 1, stoneL],
      [28, 27, 16, 1, stoneD],
    ])
    outline(ctx, 28, 22, 16, 6, '#3a2613')
    // Small finial on the bowl
    rect(ctx, 35, 18, 2, 4, stone); px(ctx, 35, 17, stoneL)
    // Tiny moss on pedestal
    px(ctx, 33, 38, '#5fb070'); px(ctx, 38, 39, '#5fb070'); px(ctx, 35, 41, '#5fb070')
    return c
  }

  // ─── LAMP POST ──────────────────────────────────────────────────────────────
  function lampPost() {
    const { c, ctx } = mkc(20, 60)
    const metal = '#3a3530', metalD = dk(metal, 0.30), metalL = lt(metal, 0.30)
    // Shadow
    rect(ctx, 6, 56, 8, 3, 'rgba(40,25,15,0.30)')
    // Base
    paintBlocks(ctx, [
      [7, 50, 6, 6, metal],
      [7, 50, 6, 1, metalL],
      [7, 55, 6, 1, metalD],
    ])
    // Post
    rect(ctx, 9, 14, 2, 36, metal)
    rect(ctx, 9, 14, 1, 36, metalL)
    // Decorative ring midway
    rect(ctx, 7, 28, 6, 2, metal)
    px(ctx, 7, 28, metalL); px(ctx, 12, 28, metalD)
    // Lamp head (lantern)
    paintBlocks(ctx, [
      [5, 4, 10, 12, metal],
      [5, 4, 10, 2, metalL],
      [5, 14, 10, 2, metalD],
      [4, 4, 1, 12, metalD],
      [15, 4, 1, 12, metalD],
    ])
    outline(ctx, 5, 4, 10, 12, '#0a0806')
    // Glass with warm glow inside
    paintBlocks(ctx, [
      [7, 6, 6, 8, '#ffe6a3'],
      [7, 6, 6, 2, '#fff5d2'],
    ])
    // Top finial
    rect(ctx, 8, 0, 4, 4, metal)
    px(ctx, 9, 0, metalL)
    return c
  }

  // ─── DECORATION (small props) ───────────────────────────────────────────────
  function bench() {
    const { c, ctx } = mkc(28, 16)
    const w = '#7a4d2a', wL = lt(w, 0.20), wD = dk(w, 0.30)
    rect(ctx, 4, 14, 20, 2, 'rgba(40,25,15,0.30)')
    paintBlocks(ctx, [
      [2, 6, 24, 3, w],         // seat
      [2, 6, 24, 1, wL],
      [3, 9, 2, 6, wD],         // legs
      [23, 9, 2, 6, wD],
      [2, 2, 24, 2, w],         // backrest
      [2, 2, 24, 1, wL],
      [2, 2, 1, 6, w],          // back posts
      [25, 2, 1, 6, w],
    ])
    return c
  }

  function fence() {
    const { c, ctx } = mkc(32, 18)
    const w = '#fff5e0', wD = dk(w, 0.20), wO = '#7a4d2a'
    // Horizontal rails
    rect(ctx, 0, 6, 32, 2, w)
    rect(ctx, 0, 12, 32, 2, w)
    rect(ctx, 0, 7, 32, 1, wD)
    rect(ctx, 0, 13, 32, 1, wD)
    // Vertical posts (pointed top)
    for (let x = 2; x < 32; x += 6) {
      rect(ctx, x, 2, 2, 14, w)
      rect(ctx, x, 2, 1, 14, wD)
      px(ctx, x, 2, wO); px(ctx, x+1, 2, wO)
    }
    return c
  }

  // ─── GROUND TILES ───────────────────────────────────────────────────────────
  function grassTile(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(32, 32)
    // Base
    rect(ctx, 0, 0, 32, 32, '#a8d8a0')
    // Variation patches
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(r() * 32), y = Math.floor(r() * 32)
      px(ctx, x, y, '#90c890')
    }
    // Brighter blades
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(r() * 32), y = Math.floor(r() * 32)
      px(ctx, x, y, '#bce0ac')
    }
    // Tiny dark seed dots
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(r() * 32), y = Math.floor(r() * 32)
      px(ctx, x, y, 'rgba(60,90,40,0.4)')
    }
    return c
  }

  function cobbleTile() {
    const { c, ctx } = mkc(16, 16)
    rect(ctx, 0, 0, 16, 16, '#c8b890')
    // Cobble outlines
    const cobbles = [
      [0, 0, 6, 5, '#d8c8a0'],
      [6, 0, 5, 4, '#c0b088'],
      [11, 0, 5, 5, '#d0c098'],
      [0, 5, 5, 5, '#c0b088'],
      [5, 4, 6, 6, '#d4c498'],
      [11, 5, 5, 5, '#c8b890'],
      [0, 10, 4, 6, '#d8c8a0'],
      [4, 10, 7, 6, '#c0b088'],
      [11, 10, 5, 6, '#d4c498'],
    ]
    for (const [x, y, w, h, c2] of cobbles) {
      rect(ctx, x, y, w, h, c2)
      // Edge shadows
      rect(ctx, x, y+h-1, w, 1, '#a09068')
      rect(ctx, x+w-1, y, 1, h, '#a09068')
    }
    return c
  }

  function dirtPathTile() {
    const { c, ctx } = mkc(24, 24)
    rect(ctx, 0, 0, 24, 24, '#d6b988')
    // Small pebbles
    const pebbles = [[3, 5], [16, 8], [9, 15], [20, 18], [6, 20]]
    for (const [x, y] of pebbles) {
      rect(ctx, x, y, 2, 2, '#a08868')
      px(ctx, x, y, '#c0a888')
    }
    // Dirt speckles
    for (let i = 0; i < 8; i++) {
      const x = (i * 7) % 24, y = (i * 11) % 24
      px(ctx, x, y, '#c0a888')
    }
    return c
  }

  // ─── CLOUDS (sky) ──────────────────────────────────────────────────────────
  function cloud(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(56, 20)
    const main = '#fff8e8'
    const shade = '#e0d8c8'
    const blobs = [
      { x: 14, y: 12, w: 14, h: 8 },
      { x: 26, y: 10, w: 16, h: 10 },
      { x: 38, y: 12, w: 12, h: 8 },
      { x: 8,  y: 14, w: 10, h: 6 },
    ]
    for (const b of blobs) {
      const cx = b.x, cy = b.y
      for (let dy = -b.h/2; dy <= b.h/2; dy++) for (let dx = -b.w/2; dx <= b.w/2; dx++) {
        if ((dx*dx)/((b.w/2)*(b.w/2)) + (dy*dy)/((b.h/2)*(b.h/2)) <= 1) {
          const xx = (cx + dx)|0, yy = (cy + dy)|0
          if (xx >= 0 && yy >= 0 && xx < 56 && yy < 20) {
            px(ctx, xx, yy, dy > 1 ? shade : main)
          }
        }
      }
    }
    return c
  }

  // ─── DECORATIVE BUILDINGS ──────────────────────────────────────────────────
  // Smaller "you can't enter these" buildings that fill the village. Same pixel-art
  // style family as the 6 functional houses but visibly different roles.

  // Cottage — tiny neighbour house, 64×64. RO sandstone + tiled roof; roof hue
  // seeded from an RO-town palette so they don't all match.
  function cottage(seed, roofColor) {
    const r = rng(seed)
    const c = mkc(64, 64)
    const ctx = c.ctx
    const wall = '#ecdcb4', wallS = dk(wall, 0.12)
    const stone = '#cdb98e', stoneD = dk(stone, 0.28), beam = '#6f4a27'
    const roof = roofColor || ['#c75b34', '#3f86b0', '#5a9a52', '#9a5a86', '#caa23a'][Math.floor(r() * 5)]
    const rp = { roof, roofS: dk(roof, 0.28), roofL: lt(roof, 0.22), roofE: dk(roof, 0.45), ridge: '#fff0cf', stroke: '#2e2114', beam }
    const stroke = '#2e2114', door = '#7a4a24', win = '#ffe9a8', winFrame = '#4a2f18'
    // Shadow
    rect(ctx, 6, 60, 52, 3, 'rgba(40,25,15,0.30)')
    // Walls (sandstone) with timber posts + ashlar courses
    const bx = 12, by = 30, bw = 40, bh = 25
    rect(ctx, bx, by, bw, bh, wall)
    rect(ctx, bx + bw - 3, by, 3, bh, wallS)
    for (let yy = by + 7; yy < by + bh - 3; yy += 7) rect(ctx, bx + 1, yy, bw - 4, 1, wallS)
    rect(ctx, bx, by, 2, bh, beam); rect(ctx, bx + bw - 2, by, 2, bh, beam); rect(ctx, bx, by, bw, 2, beam)
    outline(ctx, bx, by, bw, bh, stroke)
    // Stone foundation course
    rect(ctx, bx - 1, 55, bw + 2, 4, stone)
    for (let i = 0; i < bw + 2; i += 7) px(ctx, bx - 1 + i, 55, stoneD)
    rect(ctx, bx - 1, 59, bw + 2, 1, stroke)
    // Tiled roof
    paintRoofTiled(ctx, rp, { cx: 32, apexY: 8, baseY: 32, halfBase: 26 })
    // Door
    rect(ctx, 28, 42, 8, 16, door)
    rect(ctx, 28, 42, 8, 1, lt(door, 0.20))
    outline(ctx, 28, 42, 8, 16, stroke)
    px(ctx, 34, 50, '#ffd86a')
    // Window (one or two depending on seed)
    rect(ctx, 16, 40, 8, 8, win)
    outline(ctx, 16, 40, 8, 8, winFrame)
    rect(ctx, 20, 40, 1, 8, winFrame); rect(ctx, 16, 44, 8, 1, winFrame)
    if (r() > 0.5) {
      rect(ctx, 40, 40, 8, 8, win)
      outline(ctx, 40, 40, 8, 8, winFrame)
      rect(ctx, 44, 40, 1, 8, winFrame); rect(ctx, 40, 44, 8, 1, winFrame)
    }
    // Optional stone chimney with seed
    if (r() > 0.4) {
      rect(ctx, 42, 10, 6, 12, stone)
      rect(ctx, 42, 10, 6, 2, stoneD)
      outline(ctx, 42, 10, 6, 12, stroke)
    }
    return c.c
  }

  // Bakery — comercio RO: arenisca + tejado de tejas terracota + toldo + escaparate
  function bakery() {
    const c = mkc(88, 80)
    const ctx = c.ctx
    const wall = '#ecdcb4', wallS = dk(wall, 0.12)
    const stone = '#cdb98e', stoneD = dk(stone, 0.28), beam = '#6f4a27'
    const roof = '#c75b34'
    const rp = { roof, roofS: dk(roof, 0.28), roofL: lt(roof, 0.22), roofE: dk(roof, 0.45), ridge: '#fff0cf', stroke: '#2e2114', beam }
    const stroke = '#2e2114', door = '#5a3a20', win = '#fff1c8', winFrame = '#4a2f18'
    const awn = '#c0392b', awnL = lt(awn, 0.25), awnD = dk(awn, 0.30)
    rect(ctx, 8, 76, 72, 3, 'rgba(40,25,15,0.30)')
    // Walls (sandstone) + timber posts + ashlar courses
    const bx = 12, by = 36, bw = 64, bh = 38
    rect(ctx, bx, by, bw, bh, wall)
    rect(ctx, bx + bw - 3, by, 3, bh, wallS)
    for (let yy = by + 8; yy < by + bh - 4; yy += 8) rect(ctx, bx + 1, yy, bw - 4, 1, wallS)
    rect(ctx, bx, by, 2, bh, beam); rect(ctx, bx + bw - 2, by, 2, bh, beam)
    outline(ctx, bx, by, bw, bh, stroke)
    // Stone foundation
    rect(ctx, bx - 1, 71, bw + 2, 4, stone)
    for (let i = 0; i < bw + 2; i += 7) px(ctx, bx - 1 + i, 71, stoneD)
    rect(ctx, bx - 1, 75, bw + 2, 1, stroke)
    // Tiled roof
    paintRoofTiled(ctx, rp, { cx: 44, apexY: 8, baseY: 36, halfBase: 38 })
    // Striped awning over the storefront
    rect(ctx, 14, 44, 32, 5, awn)
    rect(ctx, 14, 44, 32, 1, awnL)
    rect(ctx, 14, 48, 32, 1, awnD)
    for (let x = 16; x < 46; x += 4) rect(ctx, x, 45, 2, 3, '#fff5e0')
    for (let x = 14; x <= 46; x += 4) { px(ctx, x, 50, awnD); px(ctx, x + 1, 50, awnD) }
    // Big shop window (left, under awning)
    rect(ctx, 18, 52, 24, 14, win)
    outline(ctx, 18, 52, 24, 14, winFrame)
    rect(ctx, 30, 52, 1, 14, winFrame); rect(ctx, 18, 59, 24, 1, winFrame)
    // Bread loaves in window
    paintBlocks(ctx, [
      [21, 60, 6, 4, '#c89858'], [21, 60, 6, 1, '#e8b878'],
      [29, 60, 5, 4, '#d8a868'], [29, 60, 5, 1, '#f0c888'],
      [36, 60, 4, 4, '#c89858'], [36, 60, 4, 1, '#e8b878'],
    ])
    // Door (right side)
    rect(ctx, 52, 50, 14, 24, door)
    rect(ctx, 52, 50, 14, 2, lt(door, 0.20))
    outline(ctx, 52, 50, 14, 24, stroke)
    rect(ctx, 56, 54, 6, 6, win)
    outline(ctx, 56, 54, 6, 6, winFrame)
    px(ctx, 64, 64, '#ffd86a')
    // Small wall plaque with a baguette (under the eave, above the door)
    rect(ctx, 50, 38, 18, 8, '#fff5e0')
    outline(ctx, 50, 38, 18, 8, stroke)
    rect(ctx, 53, 40, 12, 4, '#c89858')
    px(ctx, 56, 41, '#3a1810'); px(ctx, 60, 41, '#3a1810')
    return c.c
  }

  // Workshop / herrería RO — muro de sillería + tejado de pizarra + fragua
  function workshop() {
    const c = mkc(80, 80)
    const ctx = c.ctx
    const wall = '#b6ab98', wallS = dk(wall, 0.20)
    const stone = '#9c8f78', stoneD = dk(stone, 0.30), beam = '#5a4128'
    const roof = '#5a4632'
    const rp = { roof, roofS: dk(roof, 0.28), roofL: lt(roof, 0.22), roofE: dk(roof, 0.45), ridge: '#d8c9a8', stroke: '#1a0e08', beam }
    const stroke = '#1a0e08', door = '#4a2c14', win = '#ffd070'
    rect(ctx, 6, 76, 68, 3, 'rgba(40,25,15,0.35)')
    // Stone wall (ashlar)
    const bx = 10, by = 38, bw = 60, bh = 36
    rect(ctx, bx, by, bw, bh, wall)
    rect(ctx, bx + bw - 3, by, 3, bh, wallS)
    for (let y = by + 6; y < by + bh - 3; y += 6) {
      rect(ctx, bx + 1, y, bw - 4, 1, stoneD)
      for (let x = bx + ((y % 12) ? 6 : 13); x < bx + bw - 3; x += 13) px(ctx, x, y + 1, stoneD)
    }
    rect(ctx, bx, by, 2, bh, beam); rect(ctx, bx + bw - 2, by, 2, bh, beam)
    outline(ctx, bx, by, bw, bh, stroke)
    // Stone foundation
    rect(ctx, bx - 1, 71, bw + 2, 4, stone)
    for (let i = 0; i < bw + 2; i += 7) px(ctx, bx - 1 + i, 71, stoneD)
    rect(ctx, bx - 1, 75, bw + 2, 1, stroke)
    // Tiled (slate) roof
    paintRoofTiled(ctx, rp, { cx: 40, apexY: 10, baseY: 38, halfBase: 36 })
    // Open forge window with red glow (overlay adds flicker)
    rect(ctx, 16, 44, 14, 14, win)
    rect(ctx, 16, 44, 14, 4, '#ff7838')
    rect(ctx, 16, 56, 14, 2, '#a82010')
    outline(ctx, 16, 44, 14, 14, stroke)
    // Door (big, double)
    rect(ctx, 38, 46, 18, 28, door)
    rect(ctx, 38, 46, 18, 2, lt(door, 0.20))
    rect(ctx, 47, 46, 1, 28, lt(door, 0.10))
    outline(ctx, 38, 46, 18, 28, stroke)
    // Anvil + hammer outside
    paintBlocks(ctx, [
      [62, 60, 10, 6, '#3a3a3a'],
      [60, 66, 14, 4, '#3a3a3a'],
      [62, 60, 10, 1, '#5a5a5a'],
      [60, 70, 14, 2, '#1a1a1a'],
    ])
    rect(ctx, 64, 50, 2, 12, '#7a4d2a')   // hammer handle
    rect(ctx, 62, 48, 6, 4, '#3a3a3a')    // hammer head
    return c.c
  }

  // Storehouse / almacén RO — sillería + tejado de tejas + portón + cajas
  function barn() {
    const c = mkc(80, 72)
    const ctx = c.ctx
    const wall = '#ecdcb4', wallS = dk(wall, 0.12)
    const stone = '#cdb98e', stoneD = dk(stone, 0.28), beam = '#6f4a27'
    const roof = '#b8702e'
    const rp = { roof, roofS: dk(roof, 0.28), roofL: lt(roof, 0.22), roofE: dk(roof, 0.45), ridge: '#fff0cf', stroke: '#2e2114', beam }
    const stroke = '#2e2114', wood = '#7a4a24', crate = '#b98a4a'
    rect(ctx, 6, 68, 68, 3, 'rgba(40,25,15,0.35)')
    // Walls (sandstone) + timber posts + ashlar courses
    const bx = 10, by = 30, bw = 60, bh = 36
    rect(ctx, bx, by, bw, bh, wall)
    rect(ctx, bx + bw - 3, by, 3, bh, wallS)
    for (let yy = by + 8; yy < by + bh - 4; yy += 8) rect(ctx, bx + 1, yy, bw - 4, 1, wallS)
    rect(ctx, bx, by, 2, bh, beam); rect(ctx, bx + bw - 2, by, 2, bh, beam)
    outline(ctx, bx, by, bw, bh, stroke)
    // Stone foundation
    rect(ctx, bx - 1, 63, bw + 2, 4, stone)
    for (let i = 0; i < bw + 2; i += 7) px(ctx, bx - 1 + i, 63, stoneD)
    rect(ctx, bx - 1, 67, bw + 2, 1, stroke)
    // Tiled roof (wide, low — a long storehouse)
    paintRoofTiled(ctx, rp, { cx: 40, apexY: 6, baseY: 30, halfBase: 38 })
    // Loft hatch (timber) high on the gable
    rect(ctx, 34, 14, 12, 8, wood)
    rect(ctx, 34, 14, 12, 1, lt(wood, 0.20))
    rect(ctx, 40, 14, 1, 8, dk(wood, 0.25))
    outline(ctx, 34, 14, 12, 8, stroke)
    // Big wooden double doors with iron bands
    rect(ctx, 28, 44, 24, 22, wood)
    rect(ctx, 28, 44, 12, 22, dk(wood, 0.15))
    rect(ctx, 28, 44, 24, 1, lt(wood, 0.20))
    rect(ctx, 28, 49, 24, 1, dk(wood, 0.30))     // iron band
    rect(ctx, 28, 60, 24, 1, dk(wood, 0.30))
    outline(ctx, 28, 44, 24, 22, stroke)
    rect(ctx, 39, 44, 2, 22, stroke)             // gap between doors
    px(ctx, 37, 55, '#3a2412'); px(ctx, 43, 55, '#3a2412')  // ring handles
    // Crates stacked outside
    paintBlocks(ctx, [
      [56, 58, 12, 8, crate], [56, 58, 12, 1, lt(crate, 0.20)], [56, 65, 12, 1, dk(crate, 0.30)],
      [58, 50, 8, 8, crate], [58, 50, 8, 1, lt(crate, 0.20)], [58, 57, 8, 1, dk(crate, 0.30)],
    ])
    outline(ctx, 56, 58, 12, 8, stroke); outline(ctx, 58, 50, 8, 8, stroke)
    px(ctx, 62, 54, dk(crate, 0.30)); px(ctx, 62, 62, dk(crate, 0.30))  // cross-slat hints
    return c.c
  }

  // Mill — torre con base de piedra. Las aspas se renderizan dinámicamente desde city.js
  function mill() {
    const c = mkc(80, 120)
    const ctx = c.ctx
    const stone = '#bdb1a3', stoneD = dk(stone, 0.30), stoneL = lt(stone, 0.18)
    const cap = '#c75b34', capL = lt('#c75b34', 0.22), capS = dk('#c75b34', 0.28)
    const stroke = '#3a2613'
    // Shadow
    rect(ctx, 14, 116, 52, 3, 'rgba(40,25,15,0.35)')
    // Round body (tapering tower)
    for (let y = 116; y > 32; y--) {
      const t = (116 - y) / (116 - 32)
      const wHalf = 24 - t * 8
      const cx = 40
      // Stone color with shading on right side
      for (let x = -wHalf; x <= wHalf; x++) {
        const xx = cx + x
        const isEdge = Math.abs(x) >= wHalf - 1
        const onShadeSide = x > wHalf - 8
        const col = isEdge ? stroke : (onShadeSide ? stoneD : stone)
        px(ctx, xx, y, col)
      }
    }
    // Stone block lines
    for (let y = 50; y < 110; y += 8) {
      for (let x = 22; x < 58; x += 6) {
        const yy = y + (x % 12 ? 0 : 3)
        px(ctx, x, yy, stoneD)
      }
    }
    // Door (small at bottom)
    rect(ctx, 34, 92, 12, 22, '#5a3018')
    outline(ctx, 34, 92, 12, 22, stroke)
    px(ctx, 44, 104, '#ffd86a')
    // Single small window
    rect(ctx, 36, 70, 8, 8, '#ffe9a8')
    outline(ctx, 36, 70, 8, 8, stroke)
    rect(ctx, 40, 70, 1, 8, stroke); rect(ctx, 36, 74, 8, 1, stroke)
    // Conical cap (terracotta tiles)
    tri(ctx, 40, 12, 22, 36, cap)
    for (let i = 0; i <= 24; i++) {
      const w = Math.round(22 * i / 24)
      px(ctx, 40 - w, 12 + i, stroke); px(ctx, 40 + w, 12 + i, stroke)
      if (i % 4 === 3) for (let xx = 40 - w + 2; xx < 40 + w - 1; xx += 4) px(ctx, xx, 12 + i, capS)
    }
    // Ridge highlight down the centre
    for (let i = 0; i < 24; i += 2) px(ctx, 40, 12 + i, capL)
    // Hub for blades (front)
    paintBlocks(ctx, [
      [36, 36, 8, 8, stroke],
      [38, 38, 4, 4, '#5a3018'],
    ])
    return c.c
  }

  // Well — pozo de piedra
  function well() {
    const c = mkc(40, 56)
    const ctx = c.ctx
    const stone = '#bdb1a3', stoneD = dk(stone, 0.30), stoneL = lt(stone, 0.18)
    const wood = '#7a4d2a', woodL = lt('#7a4d2a', 0.20)
    const stroke = '#3a2613', water = '#3f86ab'
    rect(ctx, 6, 52, 28, 4, 'rgba(40,25,15,0.30)')
    // Round stone base
    for (let y = 32; y < 52; y++) {
      for (let x = 8; x < 32; x++) {
        const dx = x - 20, dy = y - 42
        if (dx*dx + (dy*dy)*4 <= 144) {
          const onEdge = dx*dx + (dy*dy)*4 >= 130
          px(ctx, x, y, onEdge ? stroke : (x > 20 ? stoneD : stone))
        }
      }
    }
    // Stone blocks (radial lines)
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + i * 0.6
      const x = Math.round(20 + Math.cos(a) * 11)
      const y = Math.round(42 + Math.sin(a) * 6)
      px(ctx, x, y, stoneD)
    }
    // Water surface
    paintBlocks(ctx, [
      [10, 38, 20, 4, water],
      [10, 38, 20, 1, lt(water, 0.30)],
    ])
    // Frame poles
    rect(ctx, 12, 12, 3, 22, wood)
    rect(ctx, 25, 12, 3, 22, wood)
    rect(ctx, 12, 12, 3, 1, woodL); rect(ctx, 25, 12, 3, 1, woodL)
    // Cross beam
    rect(ctx, 10, 8, 20, 4, wood)
    rect(ctx, 10, 8, 20, 1, woodL)
    // Tiny roof (peaked, terracotta)
    tri(ctx, 20, 0, 12, 8, '#c75b34')
    for (let i = 0; i <= 8; i++) { const w = Math.round(12 * i / 8); px(ctx, 20 - w, i, '#2e2114'); px(ctx, 20 + w, i, '#2e2114') }
    px(ctx, 20, 1, '#fff0cf')
    // Bucket hanging
    paintBlocks(ctx, [
      [18, 18, 4, 6, wood],
      [18, 18, 4, 1, woodL],
      [18, 23, 4, 1, '#3a2010'],
    ])
    rect(ctx, 19, 13, 2, 6, '#3a2010') // rope
    return c.c
  }

  // Market stall — puesto colorido, varía por seed
  function marketStall(seed) {
    const r = rng(seed)
    const c = mkc(56, 56)
    const ctx = c.ctx
    const tarpColors = ['#b5352b', '#3a78a8', '#caa23a', '#3f7a44', '#7a4f9a']
    const tarp = tarpColors[Math.floor(r() * tarpColors.length)]
    const tarpD = dk(tarp, 0.25), tarpL = lt(tarp, 0.20)
    const wood = '#7a4d2a', woodD = dk(wood, 0.30)
    const stroke = '#3a2613'
    rect(ctx, 4, 52, 48, 3, 'rgba(40,25,15,0.30)')
    // Posts
    rect(ctx, 8, 16, 3, 36, wood)
    rect(ctx, 45, 16, 3, 36, wood)
    rect(ctx, 8, 16, 3, 1, lt(wood, 0.25))
    rect(ctx, 45, 16, 3, 1, lt(wood, 0.25))
    // Striped tarp top (curved/scalloped edge)
    for (let x = 6; x < 50; x++) {
      const stripe = (Math.floor((x - 6) / 4) % 2 === 0)
      const top = 6 + ((x % 8 < 4) ? 0 : 1)
      for (let y = top; y < 18; y++) {
        const col = stripe ? tarp : '#fff5e0'
        px(ctx, x, y, col)
        if (y === top) px(ctx, x, y, dk(col, 0.25))
      }
    }
    // Scalloped fringe
    for (let i = 0; i < 12; i++) {
      const x = 6 + i * 4
      px(ctx, x, 19, tarp); px(ctx, x + 1, 19, tarp)
      px(ctx, x + 2, 20, tarpD); px(ctx, x + 3, 20, tarpD)
    }
    // Counter (table)
    rect(ctx, 6, 32, 44, 5, wood)
    rect(ctx, 6, 32, 44, 1, lt(wood, 0.20))
    rect(ctx, 6, 36, 44, 1, woodD)
    // Goods on counter (varied by seed)
    const items = Math.floor(r() * 3) + 2
    for (let i = 0; i < items; i++) {
      const x = 10 + i * 10
      const cx = ['#c44030', '#e8c060', '#5a8830', '#a050b0'][i]
      paintBlocks(ctx, [
        [x, 28, 6, 4, cx],
        [x, 28, 6, 1, lt(cx, 0.25)],
      ])
    }
    return c.c
  }

  // Stage — pequeño escenario con cortina
  function stage() {
    const c = mkc(80, 48)
    const ctx = c.ctx
    const wood = '#7a4a24', woodD = dk(wood, 0.30), woodL = lt(wood, 0.20)
    const curtain = '#a82038', curtainD = dk(curtain, 0.30), curtainL = lt(curtain, 0.20)
    const stroke = '#3a2010'
    rect(ctx, 6, 44, 68, 3, 'rgba(40,25,15,0.30)')
    // Platform (planks)
    rect(ctx, 6, 32, 68, 12, wood)
    rect(ctx, 6, 32, 68, 1, woodL)
    rect(ctx, 6, 42, 68, 2, woodD)
    for (let x = 14; x < 74; x += 8) rect(ctx, x, 33, 1, 9, woodD)
    outline(ctx, 6, 32, 68, 12, stroke)
    // Posts at sides
    rect(ctx, 6, 8, 4, 24, wood)
    rect(ctx, 70, 8, 4, 24, wood)
    rect(ctx, 6, 8, 4, 1, woodL); rect(ctx, 70, 8, 4, 1, woodL)
    // Top beam
    rect(ctx, 6, 4, 68, 4, wood)
    rect(ctx, 6, 4, 68, 1, woodL)
    // Curtains (drawn open, framing the stage)
    for (let y = 8; y < 30; y++) {
      for (let x = 10; x < 22; x++) {
        const stripe = (x - 10) % 2 === 0
        px(ctx, x, y, stripe ? curtain : curtainD)
      }
      for (let x = 58; x < 70; x++) {
        const stripe = (x - 58) % 2 === 0
        px(ctx, x, y, stripe ? curtain : curtainD)
      }
    }
    // Curtain top swag
    for (let x = 22; x < 58; x += 4) {
      rect(ctx, x, 8, 4, 3, curtain)
      rect(ctx, x, 11, 4, 1, curtainD)
    }
    // Tassels
    px(ctx, 22, 12, '#f0c020'); px(ctx, 30, 12, '#f0c020'); px(ctx, 38, 12, '#f0c020'); px(ctx, 46, 12, '#f0c020'); px(ctx, 54, 12, '#f0c020')
    return c.c
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  window.MiauSprites = {
    house: paintHouse,
    cottage, bakery, workshop, barn, mill, well, marketStall, stage,
    treePine, treeLush, treeAutumn, bush, flowerPatch,
    fountain, lampPost, bench, fence,
    grassTile, cobbleTile, dirtPathTile, cloud,
    // experimental — only used by /cafe-options.html
    houseCafeDeluxe, houseCafeSvg,
  }
})()

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

  // ─── HOUSE PALETTE ──────────────────────────────────────────────────────────
  // Each house shares a "cozy cabin" wall family but the roof, accents and decoration vary by zone.
  function housePalette(roofColor, accentColor) {
    const wall = '#f7ead0'                 // warm cream
    const wallS = dk(wall, 0.10)
    const wallD = dk(wall, 0.22)
    const trim = '#7a4d2a'                 // wood trim
    const trimD = dk(trim, 0.30)
    const door = '#8a5a32'
    const doorD = dk(door, 0.30)
    const doorL = lt(door, 0.15)
    const win = '#ffe9a8'                  // warm window glow
    const winD = dk(win, 0.30)
    const winFrame = '#5a3a20'
    const roof = roofColor
    const roofS = dk(roofColor, 0.25)
    const roofL = lt(roofColor, 0.18)
    const stroke = '#3a2613'
    const groundShadow = 'rgba(40,25,15,0.30)'
    const accent = accentColor || lt(roofColor, 0.4)
    return { wall, wallS, wallD, trim, trimD, door, doorD, doorL, win, winD, winFrame, roof, roofS, roofL, stroke, groundShadow, accent }
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

    // Walls
    rect(ctx, bx, by, bw, bh, p.wall)
    rect(ctx, bx, by + bh - 4, bw, 4, p.wallS)             // bottom shade band
    rect(ctx, bx + bw - 3, by, 3, bh, p.wallS)             // right shade
    rect(ctx, bx, by, 1, bh, p.wallD)                      // left edge accent
    outline(ctx, bx, by, bw, bh, p.stroke)

    // Foundation stones
    for (let i = 0; i < bw; i += 6) {
      rect(ctx, bx + i, H - 8, 5, 4, p.trimD)
      px(ctx, bx + i + 1, H - 7, p.trim)
    }
  }

  function paintRoofGable(ctx, p, opts) {
    // Gable (triangular) roof
    const W = 96
    const apex = opts.apexY ?? 16
    const baseY = opts.baseY ?? 50
    const cx = W / 2
    const halfBase = opts.halfBase ?? 38
    // Roof shadow under eaves
    rect(ctx, cx - halfBase, baseY, halfBase * 2, 3, p.roofS)
    // Triangle body (scanlines)
    tri(ctx, cx, apex, halfBase, baseY, p.roof)
    // Highlight on left slope
    for (let i = 0; i < (baseY - apex); i += 1) {
      const t = i / (baseY - apex)
      const w = Math.round(halfBase * t)
      if (i % 2 === 0) px(ctx, cx - w + 1, apex + i, p.roofL)
    }
    // Outline (left + right edge)
    for (let i = 0; i <= (baseY - apex); i++) {
      const t = i / (baseY - apex)
      const w = Math.round(halfBase * t)
      px(ctx, cx - w, apex + i, p.stroke)
      px(ctx, cx + w, apex + i, p.stroke)
    }
    // Eave shadow on wall top
    rect(ctx, cx - halfBase, baseY, halfBase * 2, 1, p.stroke)
  }

  function paintRoofMansard(ctx, p) {
    // Two-tier mansard (café look). Lower steeper, upper flatter.
    const W = 96
    const cx = W / 2
    // Lower flare (wide)
    paintBlocks(ctx, [
      [cx - 36, 38, 72, 12, p.roof],
      [cx - 36, 38, 72, 2, p.roofL],
      [cx - 36, 48, 72, 2, p.roofS],
    ])
    // Tile lines
    for (let x = cx - 34; x < cx + 36; x += 4) px(ctx, x, 44, p.roofS)
    // Upper roof (smaller triangle)
    tri(ctx, cx, 18, 28, 38, p.roof)
    for (let i = 0; i <= 20; i++) {
      const w = Math.round(28 * i / 20)
      px(ctx, cx - w, 18 + i, p.stroke)
      px(ctx, cx + w, 18 + i, p.stroke)
    }
    rect(ctx, cx - 36, 50, 72, 1, p.stroke)
  }

  function paintRoofPyramid(ctx, p) {
    // Pyramid (observatory tower). Tall + narrow.
    const cx = 48
    paintBlocks(ctx, [
      [cx - 18, 38, 36, 4, p.roof],
      [cx - 18, 38, 36, 1, p.roofL],
      [cx - 18, 41, 36, 1, p.roofS],
    ])
    tri(ctx, cx, 14, 18, 38, p.roof)
    for (let i = 0; i <= 24; i++) {
      const w = Math.round(18 * i / 24)
      px(ctx, cx - w, 14 + i, p.stroke)
      px(ctx, cx + w, 14 + i, p.stroke)
    }
    // Ridge highlight
    for (let i = 0; i < 24; i += 2) px(ctx, cx, 14 + i, p.roofL)
  }

  function paintRoofFlat(ctx, p) {
    // Studio flat roof with a small parapet.
    const cx = 48
    paintBlocks(ctx, [
      [cx - 34, 32, 68, 18, p.roof],
      [cx - 34, 32, 68, 2, p.roofL],
      [cx - 34, 48, 68, 2, p.roofS],
      [cx - 36, 30, 72, 4, p.roofS],          // parapet
      [cx - 36, 30, 72, 2, p.roof],
    ])
    outline(ctx, cx - 34, 32, 68, 18, p.stroke)
    outline(ctx, cx - 36, 30, 72, 4, p.stroke)
  }

  // ─── HOUSE: el café ☕ (mansard roof + chimney + chalkboard hint baked in fascia) ──
  function houseCafe(roofColor) {
    const p = housePalette(roofColor, '#c97a3a')
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 44 })
    paintRoofMansard(ctx, p)

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
  function houseBoard(roofColor) {
    const p = housePalette(roofColor, '#d4a83c')
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 60, bh: 40 })
    paintRoofGable(ctx, p, { apexY: 14, baseY: 50, halfBase: 36 })

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

  // ─── HOUSE: el miradero 🌙 (observatory with dome + telescope) ────────────────
  function houseObservatory(roofColor) {
    const p = housePalette(roofColor, '#b890d8')
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 56, bh: 50 })

    // Tower body (taller, narrower)
    paintBlocks(ctx, [
      [38, 32, 20, 6, p.wall],
      [38, 32, 20, 2, p.wallD],
    ])
    outline(ctx, 38, 32, 20, 6, p.stroke)

    // Dome on top
    const cx = 48, cy = 32
    for (let dy = -14; dy <= 0; dy++) {
      const r = Math.sqrt(196 - dy*dy)
      const xL = Math.round(cx - r * 0.7)
      const xR = Math.round(cx + r * 0.7)
      rect(ctx, xL, cy + dy, xR - xL + 1, 1, dy < -8 ? p.roofL : p.roof)
    }
    // Dome outline (top half ellipse)
    for (let a = 0; a < Math.PI; a += 0.05) {
      const ex = Math.round(cx + Math.cos(a) * 14 * 0.7)
      const ey = Math.round(cy + Math.sin(a-Math.PI) * 14)
      px(ctx, ex, ey, p.stroke)
    }
    // Telescope slit (dark vertical)
    rect(ctx, cx - 1, cy - 12, 2, 12, '#0a0814')

    // Stars sprinkled around the upper body
    paintBlocks(ctx, [
      [12, 18, 1, 1, '#fff5d2'], [82, 12, 1, 1, '#fff5d2'], [16, 30, 1, 1, '#fff5d2'],
      [78, 28, 1, 1, '#fff5d2'], [10, 8, 1, 1, '#fff5d2'],
    ])

    // Round window (porthole) on the lower body
    paintBlocks(ctx, [
      [44, 60, 8, 8, p.win],
    ])
    for (let yy = 60; yy < 68; yy++) for (let xx = 44; xx < 52; xx++) {
      const dx = xx - 47.5, dy = yy - 63.5
      if (dx*dx + dy*dy > 14) px(ctx, xx, yy, p.wall)
    }
    outline(ctx, 44, 60, 8, 8, p.winFrame)

    // Door
    paintBlocks(ctx, [
      [30, 70, 12, 16, p.door],
      [30, 70, 12, 2, p.doorL],
      [38, 78, 1, 1, '#ffd86a'],
    ])
    outline(ctx, 30, 70, 12, 16, p.stroke)

    // Spiral stair hint on the side
    paintBlocks(ctx, [
      [60, 72, 14, 2, p.trim], [62, 76, 12, 2, p.trim], [64, 80, 10, 2, p.trim],
    ])
    return c
  }

  // ─── HOUSE: el banquito 🪑 (low porch + hanging plants + sleeping cat) ────────
  function houseBench(roofColor) {
    const p = housePalette(roofColor, '#5fb070')
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 38 })
    paintRoofGable(ctx, p, { apexY: 18, baseY: 50, halfBase: 38 })

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
  function housePolaroid(roofColor) {
    const p = housePalette(roofColor, '#ff8a3c')
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 42 })
    paintRoofFlat(ctx, p)

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
  function houseHome(roofColor, ownerColor) {
    const p = housePalette(roofColor, '#a87dd8')
    const cat = ownerColor || '#FFB800'
    const catL = lt(cat, 0.3)
    const catD = dk(cat, 0.25)
    const { c, ctx } = mkc(96, 96)
    paintHouseBase(ctx, p, { bw: 64, bh: 40 })
    paintRoofGable(ctx, p, { apexY: 14, baseY: 50, halfBase: 38 })

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

  // ─── HOUSE DISPATCHER ──────────────────────────────────────────────────────
  function paintHouse(zoneId, roofColor, ownerColor) {
    if (zoneId === 'tweets')  return houseCafe(roofColor)
    if (zoneId === 'posts')   return houseBoard(roofColor)
    if (zoneId === 'stories') return houseObservatory(roofColor)
    if (zoneId === 'chat')    return houseBench(roofColor)
    if (zoneId === 'bereal')  return housePolaroid(roofColor)
    if (zoneId === 'profile') return houseHome(roofColor, ownerColor)
    return houseBench(roofColor)
  }

  // ─── TREES (5 variants) ──────────────────────────────────────────────────────
  function treePine(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(40, 56)
    // Shadow
    rect(ctx, 12, 50, 16, 4, 'rgba(40,25,15,0.30)')
    // Trunk
    rect(ctx, 18, 42, 4, 12, '#5a3a1c')
    rect(ctx, 18, 42, 1, 12, dk('#5a3a1c', 0.30))
    // Layered canopy (3 cones)
    const layers = [
      { y: 32, hw: 14, h: 12, color: '#3a7a3a' },
      { y: 22, hw: 11, h: 10, color: '#4a8a48' },
      { y: 12, hw: 8,  h: 8,  color: '#5fa050' },
    ]
    for (const L of layers) {
      tri(ctx, 20, L.y, L.hw, L.y + L.h, L.color)
      // Highlight
      for (let i = 0; i < L.h; i += 2) {
        const w = Math.round(L.hw * i / L.h)
        px(ctx, 20 - w + 1, L.y + i, lt(L.color, 0.20))
      }
    }
    // Snow/light on top tip
    px(ctx, 20, 12, '#e8f8d8')
    return c
  }

  function treeLush(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(48, 56)
    rect(ctx, 14, 50, 20, 4, 'rgba(40,25,15,0.30)')
    // Trunk
    rect(ctx, 22, 38, 4, 16, '#5a3a1c')
    rect(ctx, 22, 38, 1, 16, dk('#5a3a1c', 0.30))
    // Big rounded foliage (multi-blob with pixel border)
    const cx = 24
    const blobs = [
      { x: cx,    y: 16, r: 14, c: '#3a8a4a' },
      { x: cx-9,  y: 22, r: 10, c: '#4a9a58' },
      { x: cx+9,  y: 22, r: 10, c: '#4a9a58' },
      { x: cx-4,  y: 12, r: 8,  c: '#5faa68' },
    ]
    for (const b of blobs) {
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) {
        if (dx*dx + dy*dy <= b.r * b.r) {
          const xx = b.x + dx, yy = b.y + dy
          if (xx >= 0 && yy >= 0 && xx < 48 && yy < 56) {
            const onEdge = dx*dx + dy*dy >= (b.r-1)*(b.r-1)
            px(ctx, xx, yy, onEdge ? dk(b.c, 0.30) : b.c)
          }
        }
      }
    }
    // Highlight specks
    const speckN = 6 + Math.floor(r() * 4)
    for (let i = 0; i < speckN; i++) {
      const sx = cx - 10 + Math.floor(r() * 20)
      const sy = 12 + Math.floor(r() * 16)
      px(ctx, sx, sy, '#80c068')
    }
    return c
  }

  function treeSakura(seed) {
    const r = rng(seed)
    const { c, ctx } = mkc(44, 56)
    rect(ctx, 12, 50, 20, 4, 'rgba(40,25,15,0.30)')
    rect(ctx, 20, 38, 4, 16, '#6a4828')
    rect(ctx, 20, 38, 1, 16, dk('#6a4828', 0.30))
    // Pink blossom canopy
    const cx = 22
    const blobs = [
      { x: cx, y: 18, r: 13, c: '#f0a0c0' },
      { x: cx-8, y: 22, r: 9, c: '#f5b0d0' },
      { x: cx+8, y: 22, r: 9, c: '#f5b0d0' },
    ]
    for (const b of blobs) {
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) {
        if (dx*dx + dy*dy <= b.r * b.r) {
          const xx = b.x + dx, yy = b.y + dy
          if (xx >= 0 && yy >= 0 && xx < 44 && yy < 56) {
            const onEdge = dx*dx + dy*dy >= (b.r-1)*(b.r-1)
            px(ctx, xx, yy, onEdge ? dk(b.c, 0.20) : b.c)
          }
        }
      }
    }
    // Bright petals
    for (let i = 0; i < 8; i++) {
      const sx = cx - 12 + Math.floor(r() * 24)
      const sy = 12 + Math.floor(r() * 16)
      px(ctx, sx, sy, '#fff0f5')
    }
    // Petals falling
    for (let i = 0; i < 4; i++) {
      const fx = cx - 14 + Math.floor(r() * 28)
      const fy = 38 + Math.floor(r() * 14)
      px(ctx, fx, fy, '#f5b0d0')
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
        px(ctx, cx + dx, cy + dy, onEdge ? '#3a8a4a' : '#4a9a58')
      }
    }
    // Highlight
    for (let i = 0; i < 5; i++) {
      px(ctx, cx - 6 + Math.floor(r()*12), cy - 4 + Math.floor(r()*4), '#5fb070')
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
    const stone = '#bdb1a3', stoneD = dk(stone, 0.30), stoneL = lt(stone, 0.18)
    const water = '#7fc6e8', waterD = dk(water, 0.30)
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

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  window.MiauSprites = {
    house: paintHouse,
    treePine, treeLush, treeSakura, bush, flowerPatch,
    fountain, lampPost, bench, fence,
    grassTile, cobbleTile, dirtPathTile, cloud,
  }
})()

// Poporing-style avatar generator (tiny + cat ears = "poporings que maullan")
// Mirror of src/poporing.ts. Deterministic on seed.

;(function () {
  const W = 32, H = 32

  function seedRng(seed) {
    let state = seed | 0
    const next = () => { state = (Math.imul(state, 1664525) + 1013904223) | 0; return (state >>> 0) / 0xFFFFFFFF }
    const int = n => Math.floor(next() * n)
    return { next, int }
  }

  const h2r = h => { const c = h.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)] }
  const r2h = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  const lt = (h, a) => { const [r, g, b] = h2r(h); return r2h(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a) }
  const dk = (h, a) => { const [r, g, b] = h2r(h); return r2h(r * (1 - a), g * (1 - a), b * (1 - a)) }
  const mkOL = h => { const [r, g, b] = h2r(h); return r2h(r * 0.95 + 10, g * 0.75 + 10, b * 0.8 + 15) }

  const EYE = {
    classic: [[0,0,'eye'],[1,0,'eyeW'],[0,1,'eye'],[1,1,'eye']],
    round:   [[0,0,'eye'],[1,0,'eye'],[0,1,'eye'],[1,1,'eyeW']],
    dot:     [[0,0,'eye']],
    sleepy:  [[0,0,'eye'],[1,0,'eye'],[2,0,'eye']],
    star:    [[1,0,'eye'],[0,1,'eye'],[1,1,'eye'],[2,1,'eye'],[1,2,'eye']],
    heart:   [[0,0,'heart'],[2,0,'heart'],[0,1,'heart'],[1,1,'heart'],[2,1,'heart'],[1,2,'heart']],
    sparkle: [[0,0,'eyeW'],[1,0,'eye'],[0,1,'eye'],[1,1,'eyeW']],
  }
  const EYE_KEYS = Object.keys(EYE)

  const MO = {
    smile:  [[-1,0,'mouth'],[0,1,'mouth'],[1,1,'mouth'],[2,0,'mouth']],
    open:   [[0,0,'mouth'],[1,0,'mouth'],[0,1,'mouthIn'],[1,1,'tongue'],[0,2,'mouth'],[1,2,'mouth']],
    smirk:  [[-1,1,'mouth'],[0,0,'mouth'],[1,0,'mouth'],[2,-1,'mouth']],
    o:      [[0,0,'mouth'],[1,0,'mouth'],[0,1,'mouth'],[1,1,'mouth']],
    cat:    [[-1,0,'mouth'],[0,1,'mouth'],[1,0,'mouth'],[2,1,'mouth'],[3,0,'mouth']],
    tongue: [[-1,0,'mouth'],[0,1,'mouth'],[1,1,'mouth'],[2,0,'mouth'],[0,2,'tongue'],[1,2,'tongue']],
  }
  const MO_KEYS = Object.keys(MO)

  const HEADTOP_KEYS = ['none', 'leaf', 'droplet', 'spike', 'antenna']
  const CHEEK_KEYS = ['none', 'blush', 'freckles']

  const px = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c }

  function pickTraits(seed) {
    const r = seedRng(seed)
    return {
      eyes:    EYE_KEYS[r.int(EYE_KEYS.length)],
      mouth:   MO_KEYS[r.int(MO_KEYS.length)],
      cheeks:  CHEEK_KEYS[r.int(CHEEK_KEYS.length)],
      headTop: HEADTOP_KEYS[r.int(HEADTOP_KEYS.length)],
    }
  }

  function pal(c) {
    return {
      outline: mkOL(c),
      s1: dk(c, .32), s2: dk(c, .16), s3: c, s4: lt(c, .26), s5: lt(c, .5), shine: lt(c, .78),
      eye: '#1a1a22', eyeW: '#fff', heart: '#d84050',
      mouth: '#1a1a22', mouthIn: '#6a2838', tongue: '#d07088',
      cheek: '#e89098', freckle: dk(c, .35),
      leaf: '#7ac06a', leafD: '#3d7a3a',
      droplet: lt(c, .5), dropletW: '#fff',
      spike: dk(c, .45), spikeW: lt(c, .2),
      antenna: '#808080', antennaT: '#f0e060',
      earA: dk(c, .25), earB: dk(c, .45),
      shadow: 'rgba(0,0,0,.2)',
    }
  }

  // Body size variants. Mascots use non-default sizes so they read as
  // distinct creatures rather than copies of user poporings.
  const SIZES = {
    tiny:   { rx: 5,  ry: 5,  cy: 23 },  // chubby chibi
    small:  { rx: 6,  ry: 6,  cy: 22 },
    normal: { rx: 8,  ry: 7,  cy: 22 },  // default — matches user poporings
    big:    { rx: 10, ry: 9,  cy: 21 },  // tall + round
  }

  function buildGrid(traits, sizeKey) {
    const sz = SIZES[sizeKey] || SIZES.normal
    const cx = 16, cy = sz.cy, rx = sz.rx, ry = sz.ry, nT = 2, nB = 2.8
    const raw = Array.from({ length: H }, () => Array(W).fill(0))
    const clip = Math.min(cy + ry, H - 4)
    for (let y = 0; y < H; y++) {
      if (y > clip) continue
      for (let x = 0; x < W; x++) {
        const dx = Math.abs((x + 0.5 - cx) / rx), dy = (y + 0.5 - cy) / ry
        const n = dy < 0 ? nT : nB
        if (Math.pow(dx, n) + Math.pow(Math.abs(dy), n) < 1) raw[y][x] = 1
      }
    }
    let bL = W, bR = 0, bT = H, bB = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw[y][x]) {
      if (x < bL) bL = x; if (x > bR) bR = x; if (y < bT) bT = y; if (y > bB) bB = y
    }
    const bW = Math.max(1, bR - bL), bH2 = Math.max(1, bB - bT)

    const g = raw.map(r => r.map(v => v ? 's3' : null))
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!raw[y][x]) continue
      const br = 1 - ((x - bL) / bW * 0.55 + (y - bT) / bH2 * 0.45)
      g[y][x] = br > 0.78 ? 's5' : br > 0.58 ? 's4' : br > 0.38 ? 's3' : br > 0.2 ? 's2' : 's1'
    }

    const hlx = cx - rx * 0.3, hly = cy - ry * 0.35
    const hlr = Math.max(2, rx * 0.2), hlry = Math.max(2, ry * 0.18)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!g[y][x]) continue
      const d2 = (x + 0.5 - hlx) / hlr, d3 = (y + 0.5 - hly) / hlry
      if (d2 * d2 + d3 * d3 < 1) g[y][x] = 'shine'
    }

    const eyeY = Math.round(cy - ry * 0.18)
    const gap = Math.max(2, Math.round(rx * 0.28))
    const eL = { x: cx - gap - 1, y: eyeY }, eR = { x: cx + gap, y: eyeY }
    const mo = { x: cx, y: Math.round(cy + ry * 0.15) }

    const csp = Math.round(rx * 0.5), ccy = eyeY + 3
    if (traits.cheeks === 'blush') {
      px(g, cx - csp, ccy, 'cheek'); px(g, cx - csp + 1, ccy, 'cheek')
      px(g, cx + csp - 1, ccy, 'cheek'); px(g, cx + csp, ccy, 'cheek')
    } else if (traits.cheeks === 'freckles') {
      px(g, cx - csp, ccy, 'freckle'); px(g, cx - csp + 1, ccy + 1, 'freckle')
      px(g, cx + csp, ccy, 'freckle'); px(g, cx + csp - 1, ccy + 1, 'freckle')
    }

    const eSpec = EYE[traits.eyes] || EYE.classic
    for (const [dx, dy, c] of eSpec) { px(g, eL.x + dx, eL.y + dy, c); px(g, eR.x + dx, eR.y + dy, c) }
    const mSpec = MO[traits.mouth] || MO.smile
    for (const [dx, dy, c] of mSpec) px(g, mo.x + dx, mo.y + dy, c)

    const t = bT
    if (traits.headTop === 'leaf') {
      px(g, cx + 1, t - 4, 'leafD'); px(g, cx, t - 3, 'leaf'); px(g, cx + 1, t - 3, 'leafD')
      px(g, cx - 1, t - 2, 'leaf'); px(g, cx, t - 2, 'leaf'); px(g, cx, t - 1, 'leafD')
    } else if (traits.headTop === 'droplet') {
      px(g, cx - 2, t - 2, 'droplet'); px(g, cx, t - 3, 'dropletW'); px(g, cx + 2, t - 2, 'droplet')
    } else if (traits.headTop === 'spike') {
      px(g, cx, t - 4, 'spike'); px(g, cx, t - 3, 'spikeW')
      px(g, cx - 1, t - 2, 'spike'); px(g, cx, t - 2, 'spikeW'); px(g, cx + 1, t - 2, 'spike')
      px(g, cx, t - 1, 'spike')
    } else if (traits.headTop === 'antenna') {
      px(g, cx, t - 4, 'antennaT'); px(g, cx + 1, t - 4, 'antennaT')
      px(g, cx, t - 3, 'antenna'); px(g, cx, t - 2, 'antenna'); px(g, cx, t - 1, 'antenna')
    }

    // ears: ALWAYS cat (the "miau" identity)
    px(g, bL, t - 2, 'earA'); px(g, bL + 1, t - 2, 'earB')
    px(g, bL, t - 1, 'earA'); px(g, bL + 1, t - 1, 'earA')
    px(g, bR, t - 2, 'earB'); px(g, bR - 1, t - 2, 'earA')
    px(g, bR, t - 1, 'earA'); px(g, bR - 1, t - 1, 'earA')

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!g[y][x]) continue
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !raw[ny][nx]) {
          if (raw[y][x]) g[y][x] = 'outline'
          break
        }
      }
    }

    const shCy = cy + ry + 2, shRx = Math.round(rx * 0.65)
    for (let x = cx - shRx; x <= cx + shRx; x++) {
      if (x >= 0 && x < W && shCy < H && !g[shCy][x]) g[shCy][x] = 'shadow'
    }

    return g
  }

  function gridToSvg(g, p) {
    let body = ''
    for (let y = 0; y < H; y++) {
      let x = 0
      while (x < W) {
        const k = g[y][x]
        if (!k) { x++; continue }
        let run = 1
        while (x + run < W && g[y][x + run] === k) run++
        const fill = p[k] || k
        body += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill}"/>`
        x += run
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" style="image-rendering:pixelated">${body}</svg>`
  }

  // expose globally — replaces generateCatSvg from old avatar.js
  window.generateCatSvg = function (seed, colorName) {
    const traits = pickTraits(seed)
    const base = (typeof colorHex === 'function' ? colorHex(colorName) : null) || '#a6c081'
    const p = pal(base)
    const g = buildGrid(traits, 'normal')
    return gridToSvg(g, p)
  }

  // Build a poporing with explicit traits (for branded mascots per section).
  // Optional `size`: 'tiny' | 'small' | 'normal' | 'big'.
  window.generatePoporingFromTraits = function (traits, colorName, size) {
    const filledTraits = {
      eyes:    traits.eyes    || 'classic',
      mouth:   traits.mouth   || 'smile',
      cheeks:  traits.cheeks  || 'blush',
      headTop: traits.headTop || 'none',
    }
    const base = (typeof colorHex === 'function' ? colorHex(colorName) : null) || colorName || '#a6c081'
    const p = pal(base)
    const g = buildGrid(filledTraits, size)
    return gridToSvg(g, p)
  }
  window.POPORING_SIZES = Object.keys(SIZES)

  // trait metadata for a future poporing editor (replaces CAT_TRAITS)
  window.POPORING_TRAITS = {
    eyes:    { name: 'ojos',     options: EYE_KEYS,     labels: ['clásicos','redondos','punto','dormidos','estrella','corazón','brillo'] },
    mouth:   { name: 'boca',     options: MO_KEYS,      labels: ['sonrisa','abierta','sonrisilla','o','gato',':P'] },
    cheeks:  { name: 'mejillas', options: CHEEK_KEYS,   labels: ['sin','rojas','pecas'] },
    headTop: { name: 'cabeza',   options: HEADTOP_KEYS, labels: ['nada','hoja','gota','pincho','antena'] },
  }

  // shim for cat-editor: encode/decode traits ↔ seed
  window.seedToTraits = function (seed) {
    const r = seedRng(seed)
    return {
      eyes:    r.int(EYE_KEYS.length),
      mouth:   r.int(MO_KEYS.length),
      cheeks:  r.int(CHEEK_KEYS.length),
      headTop: r.int(HEADTOP_KEYS.length),
    }
  }

  window.traitsToSeed = function (traits) {
    // brute force search — small space
    for (let seed = 0; seed < 200000; seed++) {
      const r = seedRng(seed)
      if (r.int(EYE_KEYS.length) !== traits.eyes) continue
      if (r.int(MO_KEYS.length) !== traits.mouth) continue
      if (r.int(CHEEK_KEYS.length) !== traits.cheeks) continue
      if (r.int(HEADTOP_KEYS.length) !== traits.headTop) continue
      return seed
    }
    return Math.floor(Math.random() * 0xFFFFFFFF)
  }
})()

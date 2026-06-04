// City — drawGround (reskin "El Retiro"): césped dentro de la verja + paseos +
// estanque/aguas + explanada del Monumento + reja + warps. Sustituye el suelo de
// islas/mar/puentes. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, PLAZA, SPAWN, VERJA, WATER, PATH_GRID, PATH_SEGMENTS, GATES } = window.CityConfig

  const WATER_C = '#4f93b3', WATER_DK = '#3a7795', SHORE = '#bcb3a2'  // agua apagada + orilla de piedra (cohesión Cainos)

  // ── Texturas Cainos (suelo) → CanvasPattern desde una celda limpia del atlas.
  // Celdas (sx,sy) AJUSTABLES si el tile sale raro; destino 48px (tile del mundo).
  const GRASS_CELL = { sx: 32, sy: 40 }, STONE_CELL = { sx: 24, sy: 40 }, WALL_CELL = { sx: 48, sy: 80 }, CELL = 32, DST = 48
  function _mk(ctx, img, cell) {
    const c = document.createElement('canvas'); c.width = DST; c.height = DST
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false
    cx.drawImage(img, cell.sx, cell.sy, CELL, CELL, 0, 0, DST, DST)
    return ctx.createPattern(c, 'repeat')
  }
  let _pg = null, _ps = null, _pw = null   // cache perezosa por patrón (cada uno cuando carga su PNG)
  function cainosPatterns(ctx) {
    const A = window.Assets; if (!A) return null
    if (!_pg) { const g = A.get('cainos:grass'); if (g) _pg = _mk(ctx, g, GRASS_CELL) }
    if (!_ps) { const s = A.get('cainos:stone'); if (s) _ps = _mk(ctx, s, STONE_CELL) }
    if (!_pw) { const w = A.get('cainos:wall'); if (w) _pw = _mk(ctx, w, WALL_CELL) }
    if (!_pg || !_ps) return null
    return { grass: _pg, stone: _ps, wall: _pw }
  }

  // Traza el polígono de la verja (parque). Clip de césped + dibujo de la reja.
  function traceVerja(ctx) {
    ctx.beginPath()
    ctx.moveTo(VERJA[0].x, VERJA[0].y)
    for (let i = 1; i < VERJA.length; i++) ctx.lineTo(VERJA[i].x, VERJA[i].y)
    ctx.closePath()
  }
  City._traceLandPath = traceVerja

  // Curva suave por una polilínea (paseos / arroyo).
  function tracePaseo(ctx, pts) {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
  }

  // ── Suelo en REJILLA: adoquín texturizado + césped florido ────────────────
  // Cainos NO usa relleno gris liso: el suelo son BALDOSAS adoquín-sobre-césped
  // (grass.png cols 0-1 filas 4-7 → piedra con césped en las juntas, varias
  // variantes para que no se repita) y césped con FLORES/piedrecitas (grass.png
  // cols 4-7 filas 0-3) sprinkleado. Cada celda elige variante por hash (estable).
  const TS = 32  // tile nativo Cainos (32px)
  const COBBLE_SRC = [ [0,128],[32,128],[0,160],[32,160],[0,192],[32,192],[0,224],[32,224] ]
  const FLOWER_SRC = [ [128,0],[160,0],[192,0],[224,0],[128,32],[160,32],[192,32],[224,32],
                       [128,64],[160,64],[192,64],[224,64],[128,96],[160,96],[192,96],[224,96] ]
  function hashCell (c, r, salt) { return (((c * 73856093) ^ (r * 19349663) ^ (salt * 83492791)) >>> 0) }
  // PATH_SEGMENTS (avenidas rectas H/V) → set de celdas "camino" (cacheado).
  function buildPathCells () {
    if (City._pathCells) return City._pathCells
    const G = PATH_GRID, cells = new Set()
    const add = (c, r) => cells.add(c + ',' + r)
    for (const s of (PATH_SEGMENTS || [])) {
      if (s.y0 === s.y1) {                         // horizontal → 3 filas centradas en y
        const yc = Math.round((s.y0 - G / 2) / G)
        const ca = Math.floor(Math.min(s.x0, s.x1) / G), cb = Math.floor(Math.max(s.x0, s.x1) / G)
        for (let c = ca; c <= cb; c++) for (let r = yc - 1; r <= yc + 1; r++) add(c, r)
      } else {                                     // vertical → 3 columnas centradas en x
        const xc = Math.round((s.x0 - G / 2) / G)
        const ra = Math.floor(Math.min(s.y0, s.y1) / G), rb = Math.floor(Math.max(s.y0, s.y1) / G)
        for (let r = ra; r <= rb; r++) for (let c = xc - 1; c <= xc + 1; c++) add(c, r)
      }
    }
    City._pathCells = cells
    return cells
  }
  // Suelo: por cada celda visible, adoquín (si es camino) o, si no, flores de vez
  // en cuando sobre el césped base. Culling al viewport.
  City.drawPaths = function (ctx, visL, visT, visR, visB) {
    const A = window.Assets, grass = A && A.get('cainos:grass')
    if (!grass) return false
    const G = PATH_GRID, cells = buildPathCells()
    const has = (c, r) => cells.has(c + ',' + r)
    const c0 = Math.floor(visL / G) - 1, c1 = Math.ceil(visR / G) + 1
    const r0 = Math.floor(visT / G) - 1, r1 = Math.ceil(visB / G) + 1
    ctx.imageSmoothingEnabled = false
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (has(c, r)) {
          const v = COBBLE_SRC[hashCell(c, r, 4) % COBBLE_SRC.length]
          ctx.drawImage(grass, v[0], v[1], TS, TS, c * G, r * G, G, G)
        } else if ((hashCell(c, r, 1) % 100) < 13) {     // sprinkle de césped florido
          const f = FLOWER_SRC[hashCell(c, r, 2) % FLOWER_SRC.length]
          ctx.drawImage(grass, f[0], f[1], TS, TS, c * G, r * G, G, G)
        }
      }
    }
    return true
  }

  // Spawn portal — runa pulsante donde aparecen los recién llegados (Puerta de Alcalá).
  City.drawSpawnPortal = function (ctx, now) {
    const px = SPAWN.x, py = SPAWN.y
    const pulse = (Math.sin(now / 720) + 1) * 0.5
    const rot = now * 0.0006
    ctx.fillStyle = `rgba(255, 220, 130, ${0.10 + pulse * 0.10})`
    ctx.beginPath(); ctx.arc(px, py, 48, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(220, 170, 80, ${0.32 + pulse * 0.18})`
    ctx.beginPath(); ctx.arc(px, py, 32, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(255, 245, 200, ${0.55 + pulse * 0.20})`
    ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill()
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot)
    ctx.strokeStyle = `rgba(160, 100, 40, ${0.55 + pulse * 0.25})`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke()
    ctx.strokeStyle = `rgba(160, 100, 40, ${0.30 + pulse * 0.15})`
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(-10, 10); ctx.lineTo(10, -10); ctx.stroke()
    ctx.restore()
    for (let i = 0; i < 4; i++) {
      const a = -rot + (i * Math.PI / 2)
      ctx.fillStyle = `rgba(255, 200, 100, ${0.70 + pulse * 0.30})`
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * 28, py + Math.sin(a) * 28, 1.8, 0, Math.PI * 2); ctx.fill()
    }
  }

  City.drawGround = function (ctx, now, visL, visT, visR, visB) {
    visL = visL ?? 0; visT = visT ?? 0; visR = visR ?? W; visB = visB ?? H
    ctx.imageSmoothingEnabled = false

    // ── 0. "fuera del parque" (más allá de la verja): verde oscuro apagado ──
    ctx.fillStyle = '#3f6b2e'
    ctx.fillRect(visL, visT, visR - visL, visB - visT)

    // ── 1+2. Césped + paseos (clip a la verja). Cainos si cargó, si no procedural ──
    ctx.save()
    traceVerja(ctx); ctx.clip()
    const pat = cainosPatterns(ctx)
    if (pat) {
      ctx.fillStyle = pat.grass
      ctx.fillRect(visL, visT, visR - visL, visB - visT)
      City.drawPaths(ctx, visL, visT, visR, visB)   // caminos = autotile en rejilla
    } else {
      const TILE = 48
      const TONES = ['#6aa838', '#74b340', '#62a033', '#6fae3c']
      const gsx = Math.floor(visL / TILE) * TILE - TILE, gex = Math.ceil(visR / TILE) * TILE + TILE
      const gsy = Math.floor(visT / TILE) * TILE - TILE, gey = Math.ceil(visB / TILE) * TILE + TILE
      for (let wy = gsy; wy < gey; wy += TILE) {
        for (let wx = gsx; wx < gex; wx += TILE) {
          const hsh = (((wx * 73856093) ^ (wy * 19349663)) >>> 0)
          ctx.fillStyle = TONES[hsh % TONES.length]; ctx.fillRect(wx, wy, TILE, TILE)
        }
      }
      City.drawPaths(ctx, visL, visT, visR, visB)   // caminos = autotile en rejilla
    }
    ctx.restore() // end verja clip

    // ── 3. Aguas (encima del césped) ──
    City.drawWater(ctx, now, visL, visT, visR, visB)

    // ── 4. Explanada del Monumento (adoquín) = PLAZA ──
    ctx.save()
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, Math.PI * 2); ctx.clip()
    const pat2 = cainosPatterns(ctx)
    if (pat2) {
      ctx.fillStyle = pat2.stone
      ctx.fillRect(PLAZA.x - PLAZA.rx, PLAZA.y - PLAZA.ry, PLAZA.rx * 2, PLAZA.ry * 2)
    } else {
      const CB = 32
      for (let wy = PLAZA.y - PLAZA.ry - CB; wy < PLAZA.y + PLAZA.ry + CB; wy += CB) {
        for (let wx = PLAZA.x - PLAZA.rx - CB; wx < PLAZA.x + PLAZA.rx + CB; wx += CB) {
          const tone = (((wx / CB) | 0) + ((wy / CB) | 0)) & 1
          ctx.fillStyle = tone ? '#e4d8b4' : '#d0c198'; ctx.fillRect(wx, wy, CB, CB)
        }
      }
    }
    ctx.restore()
    ctx.strokeStyle = 'rgba(120,90,60,0.35)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 4, PLAZA.ry - 4, 0, 0, Math.PI * 2); ctx.stroke()

    // ── 5. Verja: muro de piedra Cainos (o reja procedural de fallback) ──
    const _vp = cainosPatterns(ctx)
    if (_vp && _vp.wall) {
      ctx.lineJoin = 'round'
      traceVerja(ctx); ctx.strokeStyle = 'rgba(28,22,14,0.55)'; ctx.lineWidth = 36; ctx.stroke()
      traceVerja(ctx); ctx.strokeStyle = _vp.wall; ctx.lineWidth = 28; ctx.stroke()
    } else {
      traceVerja(ctx); ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 10; ctx.stroke()
      ctx.save(); ctx.setLineDash([4, 30]); traceVerja(ctx); ctx.strokeStyle = '#9a9080'; ctx.lineWidth = 22; ctx.stroke(); ctx.restore()
    }

    // ── 6. Warps (remolino azul) en las puertas ──
    if (GATES) {
      const ph = now / 600
      for (const g of GATES) {
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = `rgba(120,180,255,${0.5 - k * 0.14})`; ctx.lineWidth = 4
          ctx.beginPath()
          for (let a = 0; a < 6.4; a += 0.4) {
            const rr = 8 + a * 5 + k * 8
            ctx.lineTo(g.x + Math.cos(a + ph + k) * rr, g.y + Math.sin(a + ph + k) * rr * 0.5)
          }
          ctx.stroke()
        }
      }
    }

    // ── 7. Spawn portal (Puerta de Alcalá) ──
    City.drawSpawnPortal(ctx, now)
  }

  // Aguas: estanque grande (rect), estanque del Cristal (ellipse), arroyo (stroke).
  City.drawWater = function (ctx, now, visL, visT, visR, visB) {
    for (const w of WATER) {
      if (w.type === 'rect') {
        // orilla de piedra
        ctx.fillStyle = SHORE; ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(w.x - 10, w.y - 10, w.w + 20, w.h + 20, (w.r || 0) + 10)
        else ctx.rect(w.x - 10, w.y - 10, w.w + 20, w.h + 20)
        ctx.fill()
        // agua (apagada) con bandas de oleaje suaves
        ctx.save(); ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(w.x, w.y, w.w, w.h, w.r || 0); else ctx.rect(w.x, w.y, w.w, w.h)
        ctx.fillStyle = WATER_C; ctx.fill(); ctx.clip()
        const drift = (now / 70) % 26
        ctx.fillStyle = 'rgba(30,70,95,0.18)'
        for (let y = w.y - drift; y < w.y + w.h; y += 26) ctx.fillRect(w.x, y, w.w, 3)
        for (let i = 0; i < 36; i++) {
          const sx = w.x + ((i * 137) % w.w), sy = w.y + (((i * 191) + 47) % w.h)
          const tw = (Math.sin(now / 900 + i * 1.7) + 1) * 0.5
          ctx.fillStyle = `rgba(210,235,245,${tw * 0.32})`
          ctx.fillRect(sx | 0, sy | 0, 2, 2)
        }
        ctx.restore()
      } else if (w.type === 'ellipse') {
        ctx.fillStyle = SHORE; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx + 10, w.ry + 10, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = WATER_C; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2); ctx.fill()
      } else if (w.type === 'stroke') {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        tracePaseo(ctx, w.pts); ctx.strokeStyle = SHORE; ctx.lineWidth = w.w + 12; ctx.stroke()
        tracePaseo(ctx, w.pts); ctx.strokeStyle = WATER_C; ctx.lineWidth = Math.max(2, w.w - 4); ctx.stroke()
      }
    }
  }

})()

// City — drawGround (reskin "El Retiro"): césped dentro de la verja + paseos +
// estanque/aguas + explanada del Monumento + reja + warps. Sustituye el suelo de
// islas/mar/puentes. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, PLAZA, SPAWN, VERJA, WATER, PASEOS, GATES } = window.CityConfig

  const COBBLE = '#d2c6ac', COBBLE_LN = '#ac9e80'
  const WATER_C = '#3fa3e0', WATER_DK = '#2f86c2'

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

    // ── 1. Césped (clip a la verja) — tonos por tile + briznas/florecillas ──
    ctx.save()
    traceVerja(ctx); ctx.clip()
    const TILE = 48
    const TONES = ['#6aa838', '#74b340', '#62a033', '#6fae3c']
    const gsx = Math.floor(visL / TILE) * TILE - TILE, gex = Math.ceil(visR / TILE) * TILE + TILE
    const gsy = Math.floor(visT / TILE) * TILE - TILE, gey = Math.ceil(visB / TILE) * TILE + TILE
    for (let wy = gsy; wy < gey; wy += TILE) {
      for (let wx = gsx; wx < gex; wx += TILE) {
        const hsh = (((wx * 73856093) ^ (wy * 19349663)) >>> 0)
        ctx.fillStyle = TONES[hsh % TONES.length]
        ctx.fillRect(wx, wy, TILE, TILE)
      }
    }
    for (let i = 0; i < 1400; i++) {
      const wx = (i * 137 + i * i * 7) % W
      const wy = (i * 89 + 31) % H
      ctx.fillStyle = (i & 1) ? 'rgba(158,206,96,0.55)' : 'rgba(38,86,28,0.5)'
      ctx.fillRect(wx, wy, 1, 2); ctx.fillRect(wx + 1, wy - 1, 1, 2)
      if (i % 23 === 0) { ctx.fillStyle = 'rgba(255,238,90,0.7)'; ctx.fillRect(wx, wy - 1, 1, 1) }
      else if (i % 37 === 0) { ctx.fillStyle = 'rgba(240,240,255,0.75)'; ctx.fillRect(wx, wy - 1, 1, 1) }
    }
    // ── 2. Paseos (adoquín serpenteante), dentro del clip de la verja ──
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const p of PASEOS) {
      tracePaseo(ctx, p); ctx.strokeStyle = COBBLE_LN; ctx.lineWidth = 64; ctx.stroke()
      tracePaseo(ctx, p); ctx.strokeStyle = COBBLE; ctx.lineWidth = 54; ctx.stroke()
    }
    ctx.restore() // end verja clip

    // ── 3. Aguas (encima del césped) ──
    City.drawWater(ctx, now, visL, visT, visR, visB)

    // ── 4. Explanada del Monumento (adoquín) = PLAZA ──
    ctx.save()
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, Math.PI * 2); ctx.clip()
    const CB = 32
    for (let wy = PLAZA.y - PLAZA.ry - CB; wy < PLAZA.y + PLAZA.ry + CB; wy += CB) {
      for (let wx = PLAZA.x - PLAZA.rx - CB; wx < PLAZA.x + PLAZA.rx + CB; wx += CB) {
        const tone = (((wx / CB) | 0) + ((wy / CB) | 0)) & 1
        ctx.fillStyle = tone ? '#e4d8b4' : '#d0c198'
        ctx.fillRect(wx, wy, CB, CB)
      }
    }
    ctx.restore()
    ctx.strokeStyle = 'rgba(120,90,60,0.35)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 4, PLAZA.ry - 4, 0, 0, Math.PI * 2); ctx.stroke()

    // ── 5. Verja (reja de hierro + pilares) ──
    traceVerja(ctx); ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 10; ctx.stroke()
    ctx.save(); ctx.setLineDash([4, 30]); traceVerja(ctx); ctx.strokeStyle = '#9a9080'; ctx.lineWidth = 22; ctx.stroke(); ctx.restore()

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
        ctx.save()
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(w.x, w.y, w.w, w.h, w.r || 0)
        else ctx.rect(w.x, w.y, w.w, w.h)
        ctx.fillStyle = WATER_C; ctx.fill()
        ctx.strokeStyle = WATER_DK; ctx.lineWidth = 8; ctx.stroke()
        ctx.clip()
        const drift = (now / 60) % 24
        ctx.fillStyle = 'rgba(26,74,110,0.20)'
        for (let y = w.y - drift; y < w.y + w.h; y += 24) ctx.fillRect(w.x, y, w.w, 3)
        for (let i = 0; i < 40; i++) {
          const sx = w.x + ((i * 137) % w.w), sy = w.y + (((i * 191) + 47) % w.h)
          const tw = (Math.sin(now / 800 + i * 1.7) + 1) * 0.5
          ctx.fillStyle = `rgba(220,245,255,${tw * 0.5})`
          ctx.fillRect(sx | 0, sy | 0, 2, 2)
        }
        ctx.restore()
      } else if (w.type === 'ellipse') {
        ctx.fillStyle = WATER_C; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = WATER_DK; ctx.lineWidth = 6; ctx.stroke()
      } else if (w.type === 'stroke') {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        tracePaseo(ctx, w.pts); ctx.strokeStyle = WATER_DK; ctx.lineWidth = w.w; ctx.stroke()
        tracePaseo(ctx, w.pts); ctx.strokeStyle = WATER_C; ctx.lineWidth = Math.max(2, w.w - 8); ctx.stroke()
      }
    }
  }

})()

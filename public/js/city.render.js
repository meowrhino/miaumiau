// City — render orchestrator. The actual draw* implementations live in:
//   · city.render.ground.js     — drawGround (iso tiles + plaza + paths + bushes)
//   · city.render.buildings.js  — drawBuilding + drawDecoBuilding + drawHouseOverlay
//   · city.render.entities.js   — drawFountain, drawTree, drawLamp, drawOther,
//                                  drawPlayer, drawHud
// Loads after city.js. The order of the other render.* files doesn't matter
// (each just attaches its draw* methods to City).
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, ZONES, FOUNTAIN, DECO_BUILDINGS, TREES, LAMPS } = window.CityConfig

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
})()

// City — building renderers (reskin Cainos):
//   · getZoneProps    — props/plant de cada modo, como lista para el y-sort
//   · drawProp        — pinta UN prop con base en (x,y) world (lo llama el y-sort)
//   · drawBuilding    — marcador del modo: sombra + aura + mascota + nameplate
//   · drawDecoBuilding— deco suelto (puestos del feed + molino)
// Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City

  // Reskin Cainos: cada modo = "feature de parque" hecho de props/plant del atlas.
  // getZoneProps devuelve la LISTA de props del modo y el render (city.render.js) mete
  // cada uno UNO A UNO en el y-sort de entidades por su base → walk-behind real: el
  // personaje pasa por delante/detrás de cada prop según dónde esté, en vez de que toda
  // la zona (árbol, estatua…) salte de golpe delante. Cada prop:
  //   { sheet:'props'|'plant', p:{sx,sy,sw,sh}, dx, dy, scale }  (dx/dy vs centro-base de la zona)
  const SIGN    = { sx: 96,  sy: 160, sw: 32,  sh: 42 }   // cartel de madera (props)
  const BENCH   = { sx: 292, sy: 19,  sw: 56,  sh: 41 }   // banco real (antes agarraba la lápida de al lado)
  const STATUE  = { sx: 445, sy: 21,  sw: 37,  sh: 72 }   // monumento/estatua (props)
  const BARREL  = { sx: 162, sy: 153, sw: 28,  sh: 36 }   // barril (props)
  const PILA    = { sx: 353, sy: 269, sw: 94,  sh: 72 }   // pila/altar redondo (placeholder bereal)
  const BIGTREE = { sx: 24,  sy: 14,  sw: 113, sh: 139 }  // árbol grande (plant)
  const BUSH = [                                           // arbustos (plant)
    { sx: 38, sy: 185, sw: 22, sh: 46 }, { sx: 98, sy: 185, sw: 27, sh: 46 },
    { sx: 156, sy: 185, sw: 38, sh: 46 }, { sx: 216, sy: 185, sw: 47, sh: 46 },
    { sx: 282, sy: 185, sw: 39, sh: 46 }, { sx: 346, sy: 185, sw: 40, sh: 46 },
  ]
  City.getZoneProps = function (z) {
    const out = []
    const P = (p, dx, dy, scale) => out.push({ sheet: 'props', p, dx, dy, scale })
    const L = (p, dx, dy, scale) => out.push({ sheet: 'plant', p, dx, dy, scale })
    if (z.id === 'posts') {                  // el tablón → carteles de madera
      P(SIGN, -44, -6, 1.5); P(SIGN, 6, 8, 1.8); P(SIGN, 52, -2, 1.5)
    } else if (z.id === 'chat') {            // la Rosaleda → setos / arbustos
      L(BUSH[3], -54, 8, 1.7); L(BUSH[4], 42, 6, 1.7)
      L(BUSH[2], -8, 16, 1.9); L(BUSH[1], 72, 14, 1.5); L(BUSH[0], -88, 14, 1.5)
    } else if (z.id === 'stories') {         // el Observatorio → monumento/estatua de piedra
      P(STATUE, 0, 2, 1.9)
    } else if (z.id === 'tweets') {          // el Parterre → árbol grande + bancos
      L(BIGTREE, -40, 2, 1.15); P(BENCH, 30, 16, 1.35); P(BENCH, -26, 22, 1.15)
    } else if (z.id === 'bereal') {          // Palacio de Cristal → pila de piedra (placeholder, asset propio luego)
      P(PILA, 0, 0, 1.3)
    } else if (z.id === 'profile') {         // la Casita → rincón con barriles + banco (placeholder, asset propio luego)
      P(BENCH, 8, 14, 1.25); P(BARREL, -36, 6, 1.4); P(BARREL, 50, 8, 1.3)
    }
    return out
  }
  // Dibuja UN prop con base-centro en (bx, by) world coords (lo invoca el y-sort).
  City.drawProp = function (ctx, bx, by, img, p, scale) {
    if (!img) return
    const rw = p.sw * scale, rh = p.sh * scale
    ctx.save(); ctx.imageSmoothingEnabled = false
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.beginPath(); ctx.ellipse(bx, by + 2, rw * 0.42, 6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, bx - rw / 2, by - rh, rw, rh)
    ctx.restore()
  }

  City.drawBuilding = function (ctx, z, now) {
    // El "edificio" del modo es solo su marcador interactivo: sombra + aura del felpudo
    // + mascota + nameplate. Los props del parque (árbol, bancos, estatua…) los pinta el
    // y-sort como entidades sueltas (getZoneProps / drawProp) para que hagan walk-behind
    // con el personaje. Ya NO hay casita procedural (reskin Cainos).
    const cx = z.x + z.w / 2
    const my = z.y + z.h - 30                    // felpudo / posición de la mascota

    // Sombra suave bajo la mascota
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath(); ctx.ellipse(cx, my + 6, 44, 12, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Doormat aura + progress ring (top-down)
    const distToMat = Math.hypot(City.player.x - cx, City.player.y - my)
    const isOnMat = City._matZoneId === z.id
    ctx.save()
    if (distToMat < 100) {
      const t = Math.max(0, 1 - distToMat / 100)
      const pulse = (Math.sin(now/600) + 1) * 0.5
      ctx.fillStyle = `rgba(255,236,168,${(0.10 + pulse * 0.15) * t})`
      ctx.beginPath(); ctx.ellipse(cx, my + 6, 32, 12, 0, 0, Math.PI * 2); ctx.fill()
    }
    if (isOnMat && City._matEnterTime) {
      const prog = Math.min(1, (performance.now() - City._matEnterTime) / 420)
      ctx.strokeStyle = z.color
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(cx, my + 6, 26, 10, 0, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2); ctx.stroke()
    }
    ctx.restore()

    // Mascot poporing standing at the doormat (bobbing)
    const mascot = City.mascots[z.id]
    const mascotSize = (City.mascotSizes && City.mascotSizes[z.id]) || 56
    const bob = Math.sin(now/600 + z.x*0.01) * 4
    if (mascot) {
      ctx.save()
      ctx.shadowColor = z.color
      ctx.shadowBlur = 14
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(mascot, cx - mascotSize/2, my - mascotSize + bob, mascotSize, mascotSize)
      ctx.restore()
    } else {
      ctx.fillStyle = z.color
      ctx.beginPath(); ctx.arc(cx, my - 20 + bob, 20, 0, Math.PI * 2); ctx.fill()
    }

    // Nameplate under the mascot
    ctx.save()
    ctx.font = '700 13px "Pixelify Sans", monospace'
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.strokeText(z.name, cx, my + 24)
    ctx.fillText(z.name, cx, my + 24)
    ctx.restore()
  }

  City.drawDecoBuilding = function (ctx, d, img, now) {
    // Decorative buildings render at d.x (center) with their footprint base at d.y.
    // d.h is the desired rendered height; width keeps the sprite's aspect ratio.
    const sp = City.sprites
    const useAssetForKind = City.useImageAssets &&
      (!City._assetWhitelist || City._assetWhitelist.has(d.kind))
    // RO reskin: every deco renders from its procedural RO sprite (sprites.js).
    // A dedicated hand-made PNG still overrides if one is dropped in later
    // (deco:<kind>[:variant]). The Sprout Lands sheets are no longer used.
    if (useAssetForKind && window.Assets) {
      const variant = (d.kind === 'stall') ? (((d.seed || 0) % 2) + 1) : null
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
          ctx.fillStyle = '#3a2613'
          ctx.fillRect(2, -bladeW/2 - 1, bladeLen + 2, bladeW + 2)
          ctx.fillStyle = '#fff5e0'
          ctx.fillRect(3, -bladeW/2, bladeLen, bladeW)
          ctx.fillStyle = '#e0d0a8'
          ctx.fillRect(3, -bladeW/2 + bladeW - 2, bladeLen, 2)
          ctx.fillStyle = 'rgba(80,55,30,0.6)'
          for (let s = 8; s < bladeLen; s += 8) ctx.fillRect(3 + s, -bladeW/2 + 1, 1, bladeW - 2)
          ctx.rotate(Math.PI / 2)
        }
        // Hub cap (brown)
        ctx.fillStyle = '#3a2010'; ctx.fillRect(-5, -5, 10, 10)
        ctx.fillStyle = '#7a4d2a'; ctx.fillRect(-3, -3, 6, 6)
        ctx.restore()
      }
    }
    ctx.restore()
  }

})()

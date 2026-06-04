// City — cargador de mapas TILED (mapeditor.org).
// Lee un JSON de Tiled (.tmj) y lo pinta en el canvas del parque. Soporta:
//   · tilesets de imagen (rejilla 32px: césped/piedra/muro) → capas de TILES
//   · tilesets de "colección de imágenes" (props/árboles/estructuras sueltos) →
//     capas de OBJETOS (cada objeto = un sprite colocado libremente)
// Es el flujo nuevo: manu diseña el mapa en Tiled (visual) y el juego lo carga aquí.
//
// Activación (de momento detrás de flag): miaumiauonline.com/?map=tiled
//
// Escala: el tile nativo es 32px (Cainos); se pinta a 48px en el mundo (RENDER),
// para encajar con la cámara/spawn actuales. Todo (tiles y objetos) se multiplica
// por SCALE = RENDER/tilewidth = 1.5.
;(function () {
  if (!window.City) return
  const City = window.City
  const RENDER = 48

  function tilesetFor (tiled, gid) {
    let best = null
    for (const ts of tiled.tilesets) {
      if (ts.firstgid <= gid && (!best || ts.firstgid > best.firstgid)) best = ts
    }
    return best
  }
  // URL web de una imagen del .tmj (las rutas se guardan relativas para Tiled).
  function webUrl (p) { return '/img/cainos/' + p.replace(/^.*\/img\/cainos\//, '') }
  function loadImg (src) {
    return new Promise(ok => {
      const im = new Image()
      im.onload = () => ok(im)
      im.onerror = () => { console.warn('[tiled] no carga', src); ok(null) }
      im.src = src
    })
  }

  City.loadTiledMap = async function (url) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const m = await res.json()
      const tilesets = []
      for (const t of (m.tilesets || [])) {
        const ts = { firstgid: t.firstgid, name: t.name, tw: t.tilewidth, th: t.tileheight }
        if (t.image) {                              // tileset de imagen (rejilla)
          ts.kind = 'grid'; ts.columns = t.columns
          ts.img = await loadImg(webUrl(t.image))
        } else if (t.tiles) {                       // colección de imágenes (props sueltos)
          ts.kind = 'collection'; ts.tiles = {}
          await Promise.all(t.tiles.map(async tile => {
            ts.tiles[tile.id] = { img: await loadImg(webUrl(tile.image)), w: tile.imagewidth, h: tile.imageheight }
          }))
        }
        tilesets.push(ts)
      }
      City.tiled = {
        w: m.width, h: m.height, tw: m.tilewidth, th: m.tileheight,
        scale: RENDER / m.tilewidth, layers: m.layers || [], tilesets, ready: true,
      }
      City.tiledWorld = { W: m.width * RENDER, H: m.height * RENDER }
      console.log('[tiled] mapa cargado:', m.width + 'x' + m.height, '·', tilesets.length, 'tilesets ·', (m.layers || []).length, 'capas')
      return true
    } catch (e) {
      console.warn('[tiled] no se pudo cargar el mapa:', e)
      return false
    }
  }

  // Pinta una capa de TILES (rejilla) con culling.
  function drawTileLayer (ctx, T, layer, c0, c1, r0, r1) {
    const R = RENDER, data = layer.data
    for (let r = r0; r <= r1; r++) {
      const rowBase = r * T.w
      for (let c = c0; c <= c1; c++) {
        const gid = data[rowBase + c]
        if (!gid) continue
        const ts = tilesetFor(T, gid)
        if (!ts || ts.kind !== 'grid' || !ts.img) continue
        const local = gid - ts.firstgid
        const sx = (local % ts.columns) * ts.tw
        const sy = ((local / ts.columns) | 0) * ts.th
        ctx.drawImage(ts.img, sx, sy, ts.tw, ts.th, c * R, r * R, R, R)
      }
    }
  }

  // Pinta una capa de OBJETOS (sprites sueltos), ordenados por y (los de abajo encima).
  function drawObjectLayer (ctx, T, layer) {
    const S = T.scale
    const objs = (layer.objects || []).filter(o => o.gid).slice().sort((a, b) => a.y - b.y)
    for (const o of objs) {
      const ts = tilesetFor(T, o.gid)
      if (!ts || ts.kind !== 'collection') continue
      const tile = ts.tiles[o.gid - ts.firstgid]
      if (!tile || !tile.img) continue
      const w = (o.width || tile.w) * S, h = (o.height || tile.h) * S
      // En Tiled (x,y) de un tile-objeto = esquina inferior izquierda.
      ctx.drawImage(tile.img, o.x * S, (o.y * S) - h, w, h)
    }
  }

  City.drawTiledMap = function (ctx, visL, visT, visR, visB) {
    const T = City.tiled
    if (!T || !T.ready) return false
    const R = RENDER
    ctx.imageSmoothingEnabled = false
    const c0 = Math.max(0, Math.floor(visL / R)), c1 = Math.min(T.w - 1, Math.ceil(visR / R))
    const r0 = Math.max(0, Math.floor(visT / R)), r1 = Math.min(T.h - 1, Math.ceil(visB / R))
    for (const layer of T.layers) {
      if (layer.visible === false) continue
      if (layer.type === 'tilelayer') drawTileLayer(ctx, T, layer, c0, c1, r0, r1)
      else if (layer.type === 'objectgroup') drawObjectLayer(ctx, T, layer)
    }
    return true
  }

  // Colisión desde el mapa: bloquea sobre muros / agua / colisión, y fuera del mapa.
  // Así las paredes (que dibuja manu en la capa 'muros'), el agua y el borde del
  // mirador (capa 'colision') son SÓLIDOS → el parque se vuelve navegable.
  const BLOCK_LAYERS = new Set(['muros', 'agua', 'colision'])
  City.tiledBlocked = function (wx, wy) {
    const T = City.tiled
    if (!T || !T.ready) return false
    const c = Math.floor(wx / RENDER), r = Math.floor(wy / RENDER)
    if (c < 0 || r < 0 || c >= T.w || r >= T.h) return true
    const i = r * T.w + c
    for (const layer of T.layers) {
      if (layer.type === 'tilelayer' && BLOCK_LAYERS.has(layer.name) && layer.data[i]) return true
    }
    return false
  }

  if (/[?&]map=tiled/.test(location.search)) {
    City.loadTiledMap('/data/park.tmj')
  }
})()

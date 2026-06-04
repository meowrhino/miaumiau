// City — cargador de mapas TILED (mapeditor.org).
// Lee un JSON de Tiled (.tmj/.json, con tilesets embebidos) y pinta sus capas de
// tiles en el canvas del parque. Es el primer paso del flujo nuevo: manu diseña el
// mapa en Tiled (visual) y el juego lo carga aquí — sin build, solo un fetch.
//
// Activación (de momento detrás de flag para no tocar el parque actual):
//   miaumiauonline.com/?map=tiled   → carga /data/park.tmj
//
// Render: cada tile de 32px (nativo Cainos) se pinta en una celda de 48px del mundo
// (RENDER), para encajar con la escala actual. Culling al viewport.
;(function () {
  if (!window.City) return
  const City = window.City
  const RENDER = 48

  // Tileset (por firstgid) al que pertenece un gid.
  function tilesetFor (tiled, gid) {
    let best = null
    for (const ts of tiled.tilesets) {
      if (ts.firstgid <= gid && (!best || ts.firstgid > best.firstgid)) best = ts
    }
    return best
  }

  City.loadTiledMap = async function (url) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const m = await res.json()
      const tilesets = (m.tilesets || []).map(t => ({
        firstgid: t.firstgid, columns: t.columns,
        tw: t.tilewidth, th: t.tileheight, image: t.image, img: null,
      }))
      // Cargar las imágenes de los tilesets (PNGs de Cainos en /img/cainos/).
      await Promise.all(tilesets.map(t => new Promise(ok => {
        if (!t.image) return ok()
        const im = new Image()
        im.onload = () => { t.img = im; ok() }
        im.onerror = () => { console.warn('[tiled] no carga', t.image); ok() }
        im.src = t.image
      })))
      City.tiled = {
        w: m.width, h: m.height, tw: m.tilewidth, th: m.tileheight,
        render: RENDER, layers: m.layers || [], tilesets, ready: true,
      }
      // Ajusta el tamaño del mundo al del mapa de Tiled (para cámara/clamp).
      City.tiledWorld = { W: m.width * RENDER, H: m.height * RENDER }
      console.log('[tiled] mapa cargado:', m.width + 'x' + m.height, 'tiles ·', tilesets.length, 'tilesets ·', (m.layers || []).length, 'capas')
      return true
    } catch (e) {
      console.warn('[tiled] no se pudo cargar el mapa:', e)
      return false
    }
  }

  // Pinta las capas de tiles del mapa de Tiled (culling al viewport).
  City.drawTiledMap = function (ctx, visL, visT, visR, visB) {
    const T = City.tiled
    if (!T || !T.ready) return false
    const R = T.render
    ctx.imageSmoothingEnabled = false
    const c0 = Math.max(0, Math.floor(visL / R)), c1 = Math.min(T.w - 1, Math.ceil(visR / R))
    const r0 = Math.max(0, Math.floor(visT / R)), r1 = Math.min(T.h - 1, Math.ceil(visB / R))
    for (const layer of T.layers) {
      if (layer.type !== 'tilelayer' || layer.visible === false) continue
      const data = layer.data
      for (let r = r0; r <= r1; r++) {
        const rowBase = r * T.w
        for (let c = c0; c <= c1; c++) {
          const gid = data[rowBase + c]
          if (!gid) continue
          const ts = tilesetFor(T, gid)
          if (!ts || !ts.img) continue
          const local = gid - ts.firstgid
          const sx = (local % ts.columns) * ts.tw
          const sy = ((local / ts.columns) | 0) * ts.th
          ctx.drawImage(ts.img, sx, sy, ts.tw, ts.th, c * R, r * R, R, R)
        }
      }
    }
    return true
  }

  // Flag: ?map=tiled → carga el mapa de ejemplo. Cuando esté, el render lo usará.
  if (/[?&]map=tiled/.test(location.search)) {
    City.loadTiledMap('/data/park.tmj')
  }
})()

// City — camera + viewport fit. Extends window.City with:
//   fitCanvas, detectCameraMode, applyCameraMode, clampCamera,
//   recenterCamera, updateRecenterButton.
// State (City.camera = {x, y, zoom, targetX, targetY, targetZoom, mode})
// is initialized in city.js. Loaded after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H } = window.CityConfig

  City.fitCanvas = function () {
    if (!City.canvas) return
    const wrap = City.canvas.parentElement
    if (!wrap) return
    // Resize backing store only when needed (avoids losing context state every frame).
    const vw = wrap.clientWidth
    const vh = wrap.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetW = Math.round(vw * dpr)
    const targetH = Math.round(vh * dpr)
    if (City.canvas.width !== targetW || City.canvas.height !== targetH) {
      City.canvas.width = targetW; City.canvas.height = targetH
      City.canvas.style.width = vw + 'px'; City.canvas.style.height = vh + 'px'
    }
    // Follow-cam (RO-style): follow modes use a fixed 1:1 pixel scale so a world
    // bigger than the viewport scrolls with the camera. 'overview' fits it all.
    const baseScale = (City.camera.mode === 'overview') ? Math.min(vw / W, vh / H) : 1
    const scale = baseScale * City.camera.zoom
    const ox = vw / 2 - City.camera.x * scale
    const oy = vh / 2 - City.camera.y * scale
    City._view = { scale, ox, oy, vw, vh, dpr, baseScale }
    City.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr, oy * dpr)
  }

  // Detect viewport mode for camera defaults.
  City.detectCameraMode = function () {
    const w = window.innerWidth
    const isCoarse = matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches
    return (w < 768 || isCoarse) ? 'mobile-follow' : 'desktop'
  }

  // Apply camera defaults for a given mode (zoom + target position).
  City.applyCameraMode = function (mode) {
    City.camera.mode = mode
    if (mode === 'desktop') {
      // Desktop now FOLLOWS the player (RO-style) at 1:1 instead of fitting the
      // whole world. With baseScale=1, zoom 1 shows ~one viewport of world.
      City.camera.targetZoom = 1
      City.camera.targetX = City.player.x
      City.camera.targetY = City.player.y
    } else if (mode === 'mobile-follow') {
      City.camera.targetZoom = 1.3
      City.camera.targetX = City.player.x
      City.camera.targetY = City.player.y
    } else if (mode === 'overview') {
      // Whole-world view (the centrar / zoom-out button).
      City.camera.targetZoom = 1
      City.camera.targetX = W / 2
      City.camera.targetY = H / 2
    }
    // mobile-free: leave target as-is (user is in control)
  }

  // Clamp camera so player roughly stays in world bounds. Slack lets the
  // grass spillover paint outside the world rect without revealing void.
  City.clampCamera = function () {
    City.camera.zoom = Math.max(0.4, Math.min(3, City.camera.zoom))
    City.camera.targetZoom = Math.max(0.4, Math.min(3, City.camera.targetZoom))
    // Keep the *view* inside the world so we never reveal void at the edges.
    // Uses last frame's scale (set by fitCanvas); fine frame-to-frame. When the
    // world is smaller than the view on an axis, just center on that axis.
    const v = City._view
    const scale = v ? v.scale : 1
    const vw = v ? v.vw : window.innerWidth
    const vh = v ? v.vh : window.innerHeight
    const halfW = (vw / 2) / scale, halfH = (vh / 2) / scale
    const cx = (val) => (halfW * 2 >= W) ? W / 2 : Math.max(halfW, Math.min(W - halfW, val))
    const cy = (val) => (halfH * 2 >= H) ? H / 2 : Math.max(halfH, Math.min(H - halfH, val))
    City.camera.x = cx(City.camera.x);  City.camera.targetX = cx(City.camera.targetX)
    City.camera.y = cy(City.camera.y);  City.camera.targetY = cy(City.camera.targetY)
  }

  // Reset camera to the default for the current viewport mode (used by the
  // centrar button). Desktop → centered on world; mobile → following player.
  City.recenterCamera = function () {
    City.applyCameraMode(City.detectCameraMode())
  }

  // Show the centrar button only when pressing it would actually change the view:
  // user broke out of follow (mobile-free), or zoom drifted from its mode default.
  City.updateRecenterButton = function () {
    const btn = document.getElementById('cityRecenterBtn')
    if (!btn) return
    const c = City.camera
    const defaultZoom = (c.mode === 'mobile-follow') ? 1.6 : 1
    const zoomedAway = Math.abs(c.zoom - defaultZoom) > 0.06
    const inFreeMode = c.mode === 'mobile-free'
    const active = inFreeMode || zoomedAway
    const cur = btn.dataset.active === 'true'
    if (active !== cur) btn.dataset.active = active ? 'true' : 'false'
  }
})()

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
    // Camera-aware composition: baseScale fits the world rect to viewport;
    // camera.zoom multiplies on top. Camera.x/y are world coords (top-down 1:1).
    const baseScale = Math.min(vw / W, vh / H)
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
      City.camera.targetZoom = 1
      City.camera.targetX = W / 2
      City.camera.targetY = H / 2
    } else if (mode === 'mobile-follow') {
      City.camera.targetZoom = 1.6
      City.camera.targetX = City.player.x
      City.camera.targetY = City.player.y
    }
    // mobile-free: leave target as-is (user is in control)
  }

  // Clamp camera so player roughly stays in world bounds. Slack lets the
  // grass spillover paint outside the world rect without revealing void.
  City.clampCamera = function () {
    const slack = 120
    const lo = -slack, hiX = W + slack, hiY = H + slack
    City.camera.x = Math.max(lo, Math.min(hiX, City.camera.x))
    City.camera.y = Math.max(lo, Math.min(hiY, City.camera.y))
    City.camera.targetX = Math.max(lo, Math.min(hiX, City.camera.targetX))
    City.camera.targetY = Math.max(lo, Math.min(hiY, City.camera.targetY))
    City.camera.zoom = Math.max(0.5, Math.min(3, City.camera.zoom))
    City.camera.targetZoom = Math.max(0.5, Math.min(3, City.camera.targetZoom))
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

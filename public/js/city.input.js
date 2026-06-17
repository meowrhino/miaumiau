// City — input pipeline (keyboard + pointer + wheel) and click resolution.
// Extends window.City with: bind, unbind, onPointerDown/Move/Up/Cancel,
// onWheel, onEsc, canvasCoords, findOtherAt, findZoneMascotAt, onMove,
// onLeave, isInputBlocked, onKey, onPointer, teleportToZone.
// Loads after city.js (extends the City object created there).
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { ZONES } = window.CityConfig
  // Tap-vs-drag threshold (CSS px). Touch needs a wider window because finger
  // jitter often nudges the pointer 8-12px even on a "still" tap.
  const TAP_PX = { mouse: 6, pen: 6, touch: 12 }

  City.bind = function () {
    window.addEventListener('keydown', City.onKey)
    window.addEventListener('keyup', City.onKey)
    City.canvas.addEventListener('pointerdown', City.onPointerDown)
    City.canvas.addEventListener('pointermove', City.onPointerMove)
    City.canvas.addEventListener('pointerup', City.onPointerUp)
    City.canvas.addEventListener('pointercancel', City.onPointerCancel)
    City.canvas.addEventListener('pointerleave', City.onLeave)
    City.canvas.addEventListener('wheel', City.onWheel, { passive: false })
    window.addEventListener('keydown', City.onEsc)
    const recenter = document.getElementById('cityRecenterBtn')
    if (recenter) recenter.addEventListener('click', City.recenterCamera)
  }

  City.unbind = function () {
    window.removeEventListener('keydown', City.onKey)
    window.removeEventListener('keyup', City.onKey)
    if (City.canvas) {
      City.canvas.removeEventListener('pointerdown', City.onPointerDown)
      City.canvas.removeEventListener('pointermove', City.onPointerMove)
      City.canvas.removeEventListener('pointerup', City.onPointerUp)
      City.canvas.removeEventListener('pointercancel', City.onPointerCancel)
      City.canvas.removeEventListener('pointerleave', City.onLeave)
      City.canvas.removeEventListener('wheel', City.onWheel)
    }
    const recenter = document.getElementById('cityRecenterBtn')
    if (recenter) recenter.removeEventListener('click', City.recenterCamera)
    window.removeEventListener('keydown', City.onEsc)
    City.hideOtherTooltip()
    City.closeOtherPopover()
  }

  // ─── Pointer pipeline (pan + pinch + tap-vs-drag) ───
  // 1 pointer drag → pan (any device); 2 pointers → pinch zoom; tap → click.
  // A "tap" = movement < 6px AND duration < 350ms. Otherwise it's a drag.
  City.onPointerDown = function (e) {
    if (City.isInputBlocked()) return
    try { City.canvas.setPointerCapture(e.pointerId) } catch (_) {}
    const p = {
      id: e.pointerId,
      x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      startTime: performance.now(),
      tapPx: TAP_PX[e.pointerType] || TAP_PX.mouse,
    }
    City.input.pointers.set(e.pointerId, p)
    const n = City.input.pointers.size
    if (n === 1) {
      City.input.panAnchorWorld = City.canvasCoords(e)
      City.input.hasMoved = false
      City.input.isPanning = false
      City.input.isPinching = false
    } else if (n === 2) {
      const arr = [...City.input.pointers.values()]
      const a = arr[0], b = arr[1]
      City.input.pinchDist0 = Math.hypot(b.x - a.x, b.y - a.y) || 1
      City.input.pinchZoom0 = City.camera.targetZoom
      City.input.isPinching = true
      City.input.isPanning = false
    }
  }

  City.onPointerMove = function (e) {
    const p = City.input.pointers.get(e.pointerId)
    if (!p) {
      // Not a captured pointer → hover (mouse without button down)
      City.onMove(e)
      return
    }
    p.x = e.clientX; p.y = e.clientY

    if (City.input.isPinching && City.input.pointers.size >= 2) {
      const arr = [...City.input.pointers.values()]
      const a = arr[0], b = arr[1]
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const ratio = dist / City.input.pinchDist0
      City.camera.targetZoom = Math.max(0.5, Math.min(3, City.input.pinchZoom0 * ratio))
      // Pinch counts as user-driven panning intent → break out of follow mode.
      if (City.camera.mode === 'mobile-follow') City.camera.mode = 'mobile-free'
      City.input.hasMoved = true
      return
    }

    if (City.input.pointers.size === 1) {
      const dx = p.x - p.startX, dy = p.y - p.startY
      if (!City.input.hasMoved && Math.hypot(dx, dy) > p.tapPx) City.input.hasMoved = true
      if (City.input.hasMoved) {
        City.input.isPanning = true
        if (City.camera.mode === 'mobile-follow') City.camera.mode = 'mobile-free'
        // Keep panAnchorWorld under the pointer: shift camera by (anchor - current).
        // canvasCoords inverts the current transform, so this delta works in top-down coords.
        const cur = City.canvasCoords(e)
        City.camera.x += City.input.panAnchorWorld.x - cur.x
        City.camera.y += City.input.panAnchorWorld.y - cur.y
        City.camera.targetX = City.camera.x
        City.camera.targetY = City.camera.y
        City.clampCamera()
      }
    }
  }

  City.onPointerUp = function (e) {
    const p = City.input.pointers.get(e.pointerId)
    if (!p) return
    City.input.pointers.delete(e.pointerId)
    if (City.input.pointers.size < 2) City.input.isPinching = false
    const wasTap = !City.input.hasMoved && (performance.now() - p.startTime) < 350
    if (wasTap && City.input.pointers.size === 0) {
      // Delegate to existing click logic (other-poporing popover, mascot teleport, click-to-walk).
      City.onPointer({ clientX: p.x, clientY: p.y })
    }
    if (City.input.pointers.size === 0) {
      City.input.isPanning = false
      City.input.hasMoved = false
    }
  }

  City.onPointerCancel = function (e) {
    City.input.pointers.delete(e.pointerId)
    if (City.input.pointers.size < 2) City.input.isPinching = false
    if (City.input.pointers.size === 0) {
      City.input.isPanning = false
      City.input.hasMoved = false
    }
  }

  City.onWheel = function (e) {
    if (City.isInputBlocked()) return
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.0015)
    const before = City.canvasCoords(e)
    City.camera.targetZoom = Math.max(0.5, Math.min(3, City.camera.targetZoom * factor))
    // Zoom-toward-cursor: nudge the camera target a bit toward the cursor so
    // the world point under the cursor stays roughly put across zoom changes.
    const k = (factor - 1) * 0.5
    City.camera.targetX += (before.x - City.camera.x) * k
    City.camera.targetY += (before.y - City.camera.y) * k
  }

  City.onEsc = function (e) {
    if (e.key !== 'Escape') return
    const pw = document.getElementById('photoWall')
    if (pw && !pw.hidden) { City.closePhotoWall(); return }
    if (City.activeOtherId) { City.closeOtherPopover(); return }
    City.closeSheet()
  }

  City.canvasCoords = function (e) {
    const r = City.canvas.getBoundingClientRect()
    const v = City._view || { scale: 1, ox: 0, oy: 0 }
    // CSS pixels relative to canvas → world coords (top-down 1:1).
    const x = (e.clientX - r.left - v.ox) / v.scale
    const y = (e.clientY - r.top  - v.oy) / v.scale
    return { x, y, rect: r }
  }

  City.findOtherAt = function (x, y) {
    // Return the closest other within the click radius, if any.
    let best = null, bestD = 999
    for (const o of City.others) {
      const d = Math.hypot(x - o.x, y - o.y)
      if (d < 28 && d < bestD) { best = o; bestD = d }
    }
    return best
  }

  City.findZoneMascotAt = function (x, y) {
    for (const z of ZONES) {
      const my = z.y + z.h - 30
      if (Math.hypot(x - (z.x + z.w/2), y - my) < 32) return z
    }
    return null
  }

  City.onMove = function (e) {
    const { x, y } = City.canvasCoords(e)
    const o = City.findOtherAt(x, y)
    const z = !o ? City.findZoneMascotAt(x, y) : null
    const npc = (!o && !z && City.findNpcAt) ? City.findNpcAt(x, y) : null
    const obj = (!o && !z && !npc) &&
      ((City.findBuzonAt && City.findBuzonAt(x, y)) || (City.findTablonAt && City.findTablonAt(x, y)))
    const newId = o ? o.user_id : null
    if (newId !== City.hoveredOtherId) {
      City.hoveredOtherId = newId
      if (o) City.showOtherTooltip(o, e.clientX, e.clientY)
      else   City.hideOtherTooltip()
    } else if (o) {
      City.moveOtherTooltip(e.clientX, e.clientY)
    }
    City.canvas.style.cursor = (o || z || npc || obj) ? 'pointer' : 'grab'
  }

  City.onLeave = function () {
    City.hoveredOtherId = null
    City.hideOtherTooltip()
  }

  // True when typing in an input/textarea OR a modal/sheet/overlay is open.
  // While blocked, WASD and click-to-walk are disabled so the player doesn't run off
  // while you're writing a post or reading a story.
  City.isInputBlocked = function () {
    const ae = document.activeElement
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true
    const open = document.querySelector('.modal:not([hidden]), .zone-sheet:not([hidden]), .story-viewer:not([hidden]), .story-editor:not([hidden]), .events-modal:not([hidden]), .pet-menu:not([hidden]), #zoneSheet:not([hidden]), .photo-wall:not([hidden])')
    return !!open
  }

  City.onKey = function (e) {
    const down = e.type === 'keydown'
    const k = e.key.toLowerCase()
    // Block WASD/arrows whenever a modal/sheet is open or you're typing — let Esc still work.
    if (City.isInputBlocked() && k !== 'escape') {
      // Also drop any keys held before the modal opened so the player doesn't keep walking
      City.keys.up = City.keys.down = City.keys.left = City.keys.right = false
      return
    }
    if (k === 'w' || k === 'arrowup')    { City.keys.up = down;    City.target = null }
    else if (k === 's' || k === 'arrowdown')  { City.keys.down = down;  City.target = null }
    else if (k === 'a' || k === 'arrowleft')  { City.keys.left = down;  City.target = null }
    else if (k === 'd' || k === 'arrowright') { City.keys.right = down; City.target = null }
    else return
    if (down) e.preventDefault()
  }

  City.onPointer = function (e) {
    // While a modal/sheet is open, the canvas is non-interactive (the overlay owns the
    // input). Don't let stray clicks send the player walking under the modal.
    if (City.isInputBlocked()) return
    const { x, y } = City.canvasCoords(e)
    // 0. Vecino (NPC) → conversar / dar o entregar recado
    if (City.findNpcAt) {
      const npc = City.findNpcAt(x, y)
      if (npc) { City.talkToNpc(npc); return }
    }
    // 0b. Buzón de un vecino → entregar foto
    if (City.findBuzonAt) {
      const owner = City.findBuzonAt(x, y)
      if (owner) { City.deliverToBuzon(owner); return }
    }
    // 0c. Tablón del barrio → abrir el muro de fotos
    if (City.findTablonAt && City.findTablonAt(x, y)) { City.openPhotoWall(); return }
    // 1. Other player → open interaction popover (sesión 8)
    const other = City.findOtherAt(x, y)
    if (other) {
      City.openOtherPopover(other, e.clientX, e.clientY)
      return
    }
    // 2. Zone mascot → teleport + open sheet
    const zone = City.findZoneMascotAt(x, y)
    if (zone) { City.teleportToZone(zone.id); return }
    // 3. Empty ground → click-to-walk (routes via plaza if cross-island)
    if (City.setWalkTarget) City.setWalkTarget(x, y)
    else City.target = { x, y }
    City.closeOtherPopover()
  }

  City.teleportToZone = function (zoneId) {
    const z = ZONES.find(zz => zz.id === zoneId)
    if (!z) return
    // Walk-in to entrance (just below mascot)
    City.player.x = z.x + z.w/2
    City.player.y = z.y + z.h - 30
    City.target = null
    City.checkZone()
    // Open the zone's section as a bottom sheet on top of the city (Phase 4)
    setTimeout(() => City.openSheet(z), 280)
  }
})()

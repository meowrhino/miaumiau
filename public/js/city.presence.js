// City — multi-player presence: writePresence, fetchOthers, fetchWaves,
// MASCOT_COORDS, writePresenceForMode. Extends window.City. Loads after city.js.
//
// State (lastPresenceWrite, lastPresenceState, _wavesSeen, pollTimer,
// wavesTimer, others, otherSprites) lives on the City object itself —
// declared in city.js at construction. The lifecycle of the polling intervals
// (clearInterval / setInterval inside enter()/leave()) also stays in city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { ZONES } = window.CityConfig

  City.writePresence = async function (immediate) {
    if (!App.user) return
    const now = Date.now()
    // Throttle: write at most every 3s, unless immediate (zone change).
    // El rate-limit del server es 60/min por IP, así que 3s va sobrado y los
    // demás nos ven movernos con mucha menos latencia (antes 8s).
    if (!immediate && now - City.lastPresenceWrite < 3000) return
    const p = City.player
    const zone = City.currentZone || 'plaza'
    // Only write if state actually changed
    const state = `${zone}|${Math.round(p.x/12)}|${Math.round(p.y/12)}`
    if (!immediate && state === City.lastPresenceState) return
    City.lastPresenceState = state
    City.lastPresenceWrite = now
    try {
      await API.post('/city/presence', { zone, x: Math.round(p.x), y: Math.round(p.y) })
    } catch (_) {}
  }

  City.fetchOthers = async function () {
    try {
      const list = await API.get('/city/presence')
      const meId = App.user?.id
      const incoming = list.filter(o => o.user_id !== meId)
      // Preserve transient client-only fields across polls. La posición del
      // server NO se aplica directa: es el DESTINO (_tx,_ty) y updateOthers()
      // camina el sprite hacia él (estilo Midgard: nada de teletransportes).
      const prevById = {}
      for (const o of City.others) prevById[o.user_id] = o
      City.others = incoming.map(o => {
        const prev = prevById[o.user_id]
        const sx = o.x, sy = o.y
        if (prev && prev._tx != null) {
          o.x = prev.x; o.y = prev.y
          o._heartUntil = prev._heartUntil
          o._walkT = prev._walkT; o._walking = prev._walking; o._dir = prev._dir
        }
        o._tx = sx; o._ty = sy
        return o
      })
      // Lazy-load sprites for new others
      City.others.forEach(o => {
        if (City.otherSprites[o.user_id]) return
        const img = new Image()
        img.src = `/api/users/${o.user_id}/avatar.svg`
        img.onload = () => { City.otherSprites[o.user_id] = img }
      })
    } catch (_) {}
  }

  City.fetchWaves = async function () {
    try {
      const list = await API.get('/city/waves')
      if (!Array.isArray(list)) return
      for (const w of list) {
        if (City._wavesSeen.has(w.id)) continue
        City._wavesSeen.add(w.id)
        // Find the recipient and trigger their heart bubble
        const target = City.others.find(o => o.user_id === w.to_user_id)
        if (target) target._heartUntil = performance.now() + 1500
        // If I'm the one being saluted → soft toast
        if (w.to_user_id === App.user?.id && w.from_user_id !== App.user?.id) {
          if (typeof showToast === 'function') showToast(`${w.from_username} te saludó 💗`, 2000)
        }
      }
      // Trim seen set so it doesn't grow forever
      if (City._wavesSeen.size > 400) City._wavesSeen = new Set(Array.from(City._wavesSeen).slice(-200))
    } catch (_) {}
  }

  // Interpolación de los demás (trasplante del motor Midgard/ragnarok test):
  // cada frame, los otros poporings CAMINAN hacia su última posición conocida
  // (_tx,_ty) en vez de teletransportarse en cada poll. Si el salto es enorme
  // (cambio de zona / primer dato tras rato), sí se teletransportan.
  const OTHER_BASE_SPEED = 300     // px/s ≈ velocidad del jugador (320)
  const OTHER_SNAP_DIST = 420      // más lejos que esto = teleport (zona nueva)
  City.updateOthers = function (dt) {
    for (const o of City.others) {
      if (o._tx == null) continue
      const dx = o._tx - o.x, dy = o._ty - o.y
      const d = Math.hypot(dx, dy)
      if (d < 2) { o._walking = false; continue }
      if (d > OTHER_SNAP_DIST) { o.x = o._tx; o.y = o._ty; o._walking = false; continue }
      // Nunca más lento que "llegar en ~2s": si va muy retrasado, acelera.
      const sp = Math.max(OTHER_BASE_SPEED, d / 2) * dt
      if (sp >= d) { o.x = o._tx; o.y = o._ty }
      else { o.x += dx / d * sp; o.y += dy / d * sp }
      o._walking = true
      o._walkT = (o._walkT || 0) + dt * 9
      if (dx < -0.5) o._dir = 1
      else if (dx > 0.5) o._dir = 0
    }
  }

  // Mascot center coords per zone — used by app.js to write presence from outside the city
  City.MASCOT_COORDS = ZONES.reduce((m, z) => {
    m[z.id] = { x: z.x + z.w/2, y: z.y + z.h/2 }
    return m
  }, {})

  // Write presence for a given mode (called by App.go for non-city modes)
  City.writePresenceForMode = async function (mode) {
    if (!App.user || typeof API === 'undefined') return
    const coords = City.MASCOT_COORDS[mode]
    if (!coords) return
    try { await API.post('/city/presence', { zone: mode, x: coords.x, y: coords.y }) } catch (_) {}
  }
})()

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
    // Throttle: write at most every 8s, unless immediate (zone change)
    if (!immediate && now - City.lastPresenceWrite < 8000) return
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
      // Preserve transient client-only fields (heart bubble timer) across polls
      const prevById = {}
      for (const o of City.others) prevById[o.user_id] = o
      City.others = incoming.map(o => {
        const prev = prevById[o.user_id]
        return prev ? Object.assign(o, { _heartUntil: prev._heartUntil }) : o
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

  // Mascot center coords per zone — used by app.js to write presence from outside the city
  City.MASCOT_COORDS = ZONES.reduce((m, z) => {
    m[z.id] = { x: z.x + z.w/2, y: z.y + z.h/2 }
    return m
  }, {})

  // Write presence for a given mode (called by App.go for non-city modes)
  City.writePresenceForMode = async function (mode) {
    if (!App.user || !window.API) return
    const coords = City.MASCOT_COORDS[mode]
    if (!coords) return
    try { await API.post('/city/presence', { zone: mode, x: coords.x, y: coords.y }) } catch (_) {}
  }
})()

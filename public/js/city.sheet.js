// City — bottom sheet (zone modal) + doormat trigger.
// Extends window.City with: openSheetForHabitat, openSheet, closeSheet, checkZone.
// Loads after city.js. Sheet hosts a section's `.mode` element inside
// #zoneSheetContent; closing restores it to the body.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { W, H, ZONES } = window.CityConfig

  // Open the sheet for a given habitat id ('tweets', 'posts', etc.). Used by
  // the routing layer (deep links) and by the doormat-trigger / mascot click.
  City.openSheetForHabitat = function (habitatId, chatWith) {
    const z = ZONES.find(zz => zz.habitat === habitatId || zz.id === habitatId)
    if (!z) return
    // If the sheet for this same zone is already open, do nothing
    const sheet = document.getElementById('zoneSheet')
    if (sheet && !sheet.hidden && City._sheetReturn && City._sheetReturn.el && City._sheetReturn.el.id === 'mode-' + habitatId) return
    City.openSheet(z)
    // /chat/<username> deep link → after the sheet is up, open the conversation
    // with that user. We only have the username slug; resolve it to a user_id by
    // looking it up in the presence list (cached) or falling back to a search.
    if (habitatId === 'chat' && chatWith && App.openChat) {
      const lower = chatWith.toLowerCase()
      const tryOpen = () => {
        const other = (City.others || []).find(o => (o.username || '').toLowerCase() === lower)
        if (other) { App.openChat(other.user_id, other.username, other.color); return true }
        return false
      }
      // Try immediately, then retry once after presence has refreshed
      setTimeout(() => { if (!tryOpen()) setTimeout(tryOpen, 1500) }, 250)
    }
  }

  City.openSheet = function (zone) {
    if (!zone) return
    const sheet = document.getElementById('zoneSheet')
    const content = document.getElementById('zoneSheetContent')
    const modeEl = document.getElementById('mode-' + zone.habitat)
    if (!sheet || !content || !modeEl) return
    // Update title chrome
    document.getElementById('zoneSheetTitle').textContent = zone.name
    const subs = { tweets: 'lo que se está miaulando', posts: 'fotos del día', stories: 'lo que pasa hoy', chat: 'conversaciones', bereal: 'tu miau real', profile: 'tu rincón' }
    document.getElementById('zoneSheetSub').textContent = subs[zone.habitat] || ''
    // Stash original parent so we can put it back on close
    City._sheetReturn = { el: modeEl, parent: modeEl.parentNode, next: modeEl.nextSibling }
    modeEl.hidden = false
    content.appendChild(modeEl)
    // Trigger that mode's enter to load its data (tweets, posts, etc.)
    if (App['enter_' + zone.habitat]) App['enter_' + zone.habitat]()
    sheet.hidden = false
    sheet.dataset.open = 'true'
    requestAnimationFrame(() => sheet.classList.add('open'))
    // Track which sheet is open so other modules (chat polling, etc.) can react.
    if (window.App) App.activeSheet = zone.habitat
    // Reflect the sheet in the URL so refresh / back / share keep the same view.
    // /tweets, /posts, etc. map to mode='city' + sheet=<habitat>.
    if (window.history && history.replaceState && window.Routes) {
      const path = Routes.pathFor('city', { sheet: zone.habitat })
      if (location.pathname !== path) history.replaceState({ mode: 'city', sheet: zone.habitat }, '', path)
      document.title = `${zone.habitat} · miaumiau`
    }
  }

  City.closeSheet = function () {
    const sheet = document.getElementById('zoneSheet')
    if (!sheet || sheet.hidden) return
    sheet.classList.remove('open')
    sheet.dataset.open = 'false'
    // Step the player slightly off the doormat so the proximity trigger doesn't
    // immediately re-open the sheet, and add a cooldown for safety.
    const z = ZONES.find(zz => zz.id === City._matZoneId) || ZONES.find(zz => zz.id === City.currentZone)
    if (z) {
      // Push player just below the doormat (toward the plaza)
      const cx = z.x + z.w/2, cy = z.y + z.h - 30
      const px = W/2, py = H/2 + 20
      const dx = px - cx, dy = py - cy
      const len = Math.hypot(dx, dy) || 1
      City.player.x = cx + (dx/len) * 60
      City.player.y = cy + (dy/len) * 60
    }
    City._matCooldownUntil = performance.now() + 1500
    City._matZoneId = null
    City._matEnterTime = 0
    if (window.App) App.activeSheet = null
    // Reset URL back to the city home so the back button + refresh behave naturally
    if (window.history && history.replaceState && location.pathname !== '/') {
      history.replaceState({ mode: 'city' }, '', '/')
      document.title = 'miaumiau'
    }
    // After the slide-down transition, restore the .mode element back to its original parent
    setTimeout(() => {
      sheet.hidden = true
      const ret = City._sheetReturn
      if (ret && ret.el && ret.parent) {
        ret.el.hidden = true
        if (ret.next) ret.parent.insertBefore(ret.el, ret.next)
        else ret.parent.appendChild(ret.el)
      }
      City._sheetReturn = null
    }, 320)
  }

  // Doormat proximity trigger: standing on the doormat (in front of the door,
  // 28px around the mascot) for ≥420ms opens that zone's sheet automatically.
  // While walking through, the timer resets, so passing by doesn't trigger.
  City.checkZone = function () {
    const p = City.player
    const inside = ZONES.find(z => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h)
    const newZone = inside ? inside.id : null
    const now = performance.now()
    const cooldownActive = now < (City._matCooldownUntil || 0)
    const sheetOpen = !!(document.getElementById('zoneSheet') && !document.getElementById('zoneSheet').hidden)
    if (!cooldownActive && !sheetOpen) {
      const onMat = ZONES.find(z => Math.hypot(p.x - (z.x + z.w/2), p.y - (z.y + z.h - 30)) < 28)
      if (onMat) {
        City._matZoneId = onMat.id
        // Enter the moment the player STOPS on the doormat (arrived by click-to-walk
        // → target cleared / arrived by WASD → keys released). Walking through doesn't
        // trigger because p.walking is still true mid-step.
        if (!p.walking) City.openSheet(onMat)
      } else if (City._matZoneId) {
        City._matZoneId = null
        City._matEnterTime = 0
      }
    }
    if (newZone !== City.currentZone) {
      City.currentZone = newZone
      if (window.World) {
        if (newZone) World.applyHabitat(inside.habitat)
        else World.applyHabitat('city')
      }
      City.writePresence(true)  // immediate write on zone change
      // Track zone entry (drives heatmap)
      if (newZone && window.track) track('enter:zone', { zone: newZone })
    }
  }
})()

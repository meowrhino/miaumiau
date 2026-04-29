// City — hover tooltip + click popover for OTHER poporings (sesión 8).
// Extends window.City with: showOtherTooltip, moveOtherTooltip, hideOtherTooltip,
// openOtherPopover, closeOtherPopover. Loads after city.js.
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { ZONES } = window.CityConfig

  function escText(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
  }
  function fmtAgo(updatedAt) {
    if (!updatedAt) return 'aquí'
    const diff = (Date.now() - new Date(updatedAt + 'Z').getTime()) / 1000
    if (diff < 30)    return 'ahora mismo'
    if (diff < 90)    return 'hace 1 min'
    if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`
    return 'hace un rato'
  }
  function zoneLabel(zoneId) {
    const z = ZONES.find(zz => zz.id === zoneId)
    return z ? z.name : 'la plaza'
  }

  City.showOtherTooltip = function (o, clientX, clientY) {
    let tip = document.getElementById('cityTooltip')
    if (!tip) {
      tip = document.createElement('div')
      tip.id = 'cityTooltip'
      tip.className = 'city-tooltip'
      document.body.appendChild(tip)
    }
    const c = (typeof colorHex === 'function') ? colorHex(o.color) : '#888'
    tip.innerHTML = `
      <span class="city-tooltip-name" style="color:${c}">${escText(o.username)}</span>
      <span class="city-tooltip-zone">en ${escText(zoneLabel(o.zone))}</span>
      <span class="city-tooltip-ago">${fmtAgo(o.updated_at)}</span>
    `
    tip.hidden = false
    City.moveOtherTooltip(clientX, clientY)
  }
  City.moveOtherTooltip = function (clientX, clientY) {
    const tip = document.getElementById('cityTooltip')
    if (!tip || tip.hidden) return
    tip.style.left = (clientX + 14) + 'px'
    tip.style.top  = (clientY - 14) + 'px'
  }
  City.hideOtherTooltip = function () {
    const tip = document.getElementById('cityTooltip')
    if (tip) tip.hidden = true
  }

  City.openOtherPopover = function (o, clientX, clientY) {
    City.activeOtherId = o.user_id
    City.hideOtherTooltip()
    let pop = document.getElementById('cityPopover')
    if (!pop) {
      pop = document.createElement('div')
      pop.id = 'cityPopover'
      pop.className = 'city-popover'
      document.body.appendChild(pop)
    }
    const c = (typeof colorHex === 'function') ? colorHex(o.color) : '#888'
    pop.innerHTML = `
      <div class="city-popover-head">
        <span class="city-popover-name" style="color:${c}">${escText(o.username)}</span>
        <span class="city-popover-where">en ${escText(zoneLabel(o.zone))} · ${fmtAgo(o.updated_at)}</span>
      </div>
      <div class="city-popover-actions">
        <button class="city-popover-btn" data-act="profile">ver perfil</button>
        <button class="city-popover-btn" data-act="chat">miau privado</button>
        <button class="city-popover-btn" data-act="hello">decir hola 💗</button>
      </div>
      <button class="city-popover-close" aria-label="cerrar">×</button>
    `
    pop.hidden = false
    pop.style.left = Math.min(window.innerWidth - 220, clientX + 10) + 'px'
    pop.style.top  = Math.min(window.innerHeight - 140, clientY + 10) + 'px'

    pop.querySelector('[data-act="profile"]').onclick = () => {
      City.closeOtherPopover()
      const slug = (o.username || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
      window.location.assign('/u/' + slug)
    }
    pop.querySelector('[data-act="chat"]').onclick = () => {
      City.closeOtherPopover()
      // Open the chat sheet on the city map and start a conversation with this user.
      // We have user_id + username + color from the presence record, so we can
      // skip the username-slug round trip and call openChat directly.
      const startConversation = () => {
        if (window.App && App.openChat) App.openChat(o.user_id, o.username, o.color)
      }
      if (City.openSheetForHabitat) {
        City.openSheetForHabitat('chat')
        setTimeout(startConversation, 260)
      } else {
        const slug = (o.username || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
        if (window.Routes) Routes.navigate('/chat/' + slug)
      }
    }
    pop.querySelector('[data-act="hello"]').onclick = () => {
      o._heartUntil = performance.now() + 1500
      if (typeof showToast === 'function') showToast(`saludaste a ${o.username} 💗`, 1500)
      if (window.track) track('city:hello', { to: o.user_id })
      // Broadcast the wave so everyone else in the city sees the heart bubble too
      if (window.API) API.post('/city/wave', { to_user_id: o.user_id }).catch(() => {})
      City.closeOtherPopover()
    }
    pop.querySelector('.city-popover-close').onclick = () => City.closeOtherPopover()
  }
  City.closeOtherPopover = function () {
    const pop = document.getElementById('cityPopover')
    if (pop) pop.hidden = true
    City.activeOtherId = null
  }
})()

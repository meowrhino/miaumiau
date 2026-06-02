// City — proximity chat (sesión 13): say something in the town and it pops as a
// speech bubble over your avatar; everyone nearby sees recent bubbles too.
//
// State: City._says (user_id → {text, until}) read by drawOther/drawPlayer in
// city.render.entities.js. City._cityChatSeen dedupes polled messages.
// The lifecycle (timer + input bar mount) is driven from city.js enter()/leave().
;(function () {
  if (!window.City) return
  const City = window.City
  City._says = City._says || {}              // user_id → { text, until (perf.now ms) }
  City._cityChatSeen = City._cityChatSeen || new Set()
  const SAY_MS = 5200                         // how long a bubble lingers

  // Registro del chat (ventana estilo RO abajo-izquierda; lo pinta City.drawHud).
  City._chatLog = City._chatLog || []
  City._pushChat = function (name, color, text) {
    City._chatLog.push({ name: name || 'gato', color: color || '#ffd24a', text: String(text == null ? '' : text) })
    if (City._chatLog.length > 40) City._chatLog.shift()
  }

  // DB content is HTML-escaped server-side (esc()); decode for canvas display.
  const UNESC = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }
  const unesc = (s) => String(s).replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => UNESC[e])

  // Poll recent town messages → assign the latest per user to City._says.
  City.fetchCityChat = async function () {
    if (!window.API) return
    try {
      const list = await API.get('/city/chat')
      if (!Array.isArray(list)) return
      const now = performance.now()
      const meId = (window.App && App.user) ? App.user.id : null
      // Server returns newest-first; walk oldest→newest so the latest wins.
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i]
        if (City._cityChatSeen.has(m.id)) continue
        City._cityChatSeen.add(m.id)
        if (m.user_id === meId) continue       // my own bubble is shown optimistically
        const txt = unesc(m.content)
        City._says[m.user_id] = { text: txt, until: now + SAY_MS }
        const other = City.others.find(o => o.user_id === m.user_id)
        City._pushChat(other ? other.username : ('gato#' + m.user_id),
                       (other && typeof colorHex === 'function') ? colorHex(other.color) : '#9ad06a', txt)
      }
      if (City._cityChatSeen.size > 600) {
        City._cityChatSeen = new Set(Array.from(City._cityChatSeen).slice(-300))
      }
    } catch (_) {}
  }

  // Say something: show my bubble right away (optimistic) + POST it.
  City.sayInWorld = async function (text) {
    text = (text || '').trim()
    if (!text || !(window.App && App.user) || !window.API) return
    if (text.length > 120) text = text.slice(0, 120)
    City._says[App.user.id] = { text, until: performance.now() + SAY_MS }
    City._pushChat((App.user.display_name || App.user.username || 'tú'),
                   (typeof colorHex === 'function' ? colorHex(App.user.color) : '#ffd24a'), text)
    try {
      await API.post('/city/chat', { content: text, zone: City.currentZone || 'plaza' })
    } catch (_) {}
  }

  // ─── Input bar: a small DOM overlay inside .city-wrap (focus → WASD pauses
  //     automatically via City.isInputBlocked). ───
  City.mountChatBar = function () {
    if (document.getElementById('cityChatBar')) return
    const wrap = document.querySelector('#mode-city .city-wrap')
    if (!wrap) return
    injectStyle()
    const form = document.createElement('form')
    form.id = 'cityChatBar'
    form.className = 'city-chat-bar'
    form.innerHTML =
      '<input id="cityChatInput" type="text" maxlength="120" autocomplete="off" ' +
      'placeholder="di algo al pueblo… (Enter)" aria-label="hablar en la ciudad">' +
      '<button type="submit">decir</button>'
    wrap.appendChild(form)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const inp = document.getElementById('cityChatInput')
      if (!inp) return
      const v = inp.value
      inp.value = ''
      City.sayInWorld(v)
      inp.blur()  // release focus so WASD/click-to-walk work again
    })
  }

  City.unmountChatBar = function () {
    const bar = document.getElementById('cityChatBar')
    if (bar) bar.remove()
  }

  function injectStyle() {
    if (document.getElementById('city-chat-style')) return
    const s = document.createElement('style')
    s.id = 'city-chat-style'
    s.textContent = [
      '.city-chat-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);',
      'display:flex;gap:6px;z-index:5;width:min(420px,86%);}',
      '.city-chat-bar input{flex:1;min-width:0;font:600 14px/1 "Galmuri11","Pixelify Sans",ui-monospace,monospace;',
      'padding:9px 12px;border:2px solid #241a33;border-radius:10px;background:rgba(255,247,234,.95);',
      'color:#241a33;box-shadow:3px 3px 0 rgba(36,26,51,.35);outline:none;}',
      '.city-chat-bar input::placeholder{color:#9a8aa0;}',
      '.city-chat-bar button{font:600 14px/1 "Galmuri11","Pixelify Sans",ui-monospace,monospace;cursor:pointer;',
      'padding:0 16px;border:2px solid #241a33;border-radius:10px;background:#ff5d8f;color:#fff;',
      'box-shadow:3px 3px 0 rgba(36,26,51,.35);}',
      '.city-chat-bar button:active{transform:translate(2px,2px);box-shadow:none;}'
    ].join('')
    document.head.appendChild(s)
  }
})()

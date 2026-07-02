// City — chat en vivo (motor rumrum): WebSocket a /ws, una sala por zona del
// mapa (sala = City.currentZone || 'plaza'). Cruzar una zona = cambiar de sala.
// Antes esto era polling sobre D1 (/api/city/chat); ahora los mensajes llegan
// al instante por el ConversationDO y quedan en el historial de cada sala.
//
// State: City._says (user_id → {text, until}) read by drawOther/drawPlayer in
// city.render.entities.js. El log (City._chatLog) lo pinta City.drawChatLog.
// Ciclo de vida: city.js enter() llama City.connectChat(); leave(),
// City.disconnectChat(). El cambio de sala lo dispara checkZone (city.sheet.js)
// vía City.syncChatRoom().
;(function () {
  if (!window.City) return
  const City = window.City
  City._says = City._says || {}              // user_id → { text, until (perf.now ms) }
  const SAY_MS = 5200                         // how long a bubble lingers

  // Registro del chat (ventana estilo RO abajo-izquierda; lo pinta City.drawHud).
  City._chatLog = City._chatLog || []
  City._pushChat = function (name, color, text) {
    City._chatLog.push({ name: name || 'gato', color: color || '#ffd24a', text: String(text == null ? '' : text) })
    if (City._chatLog.length > 40) City._chatLog.shift()
  }

  // ─── Estado del socket ───
  let ws = null            // WebSocket actual (o null)
  let wsRoom = null        // sala del socket actual
  let gen = 0              // generación: invalida reconexiones zombis tras leave()
  let pending = null       // último mensaje escrito con el socket caído
  const seen = new Set()   // `${room}:${seq}` — dedupe entre history y rejoins
  const roomColors = {}    // author → hex (snapshot history + eventos 'color')

  function myName() {
    const u = window.App && App.user
    return u ? (u.display_name || u.username || '') : ''
  }

  function desiredRoom() { return City.currentZone || 'plaza' }

  // Los WebSocket del navegador no mandan headers → la credencial va en el query.
  function authQuery() {
    const u = window.App && App.user
    if (!u) return null
    if (u.token) return 'token=' + encodeURIComponent(u.token)
    if (u.username && u.secret) return 'miau=' + encodeURIComponent(u.username + '#' + u.secret)
    return null
  }

  City.connectChat = function () {
    const auth = authQuery()
    if (!auth) return
    const g = ++gen
    if (ws) { try { ws.close() } catch (_) {} ws = null }
    const room = desiredRoom()
    wsRoom = room
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
    const sock = new WebSocket(proto + location.host + '/ws?room=' + encodeURIComponent(room) + '&' + auth)
    ws = sock

    sock.onopen = () => {
      if (g !== gen) { try { sock.close() } catch (_) {} return }
      if (pending) {
        try { sock.send(JSON.stringify({ type: 'msg', body: pending })) } catch (_) {}
        pending = null
      }
    }
    sock.onmessage = (ev) => {
      if (g !== gen) return
      let data
      try { data = JSON.parse(ev.data) } catch (_) { return }
      if (data.type === 'history') {
        Object.assign(roomColors, data.profiles || {})
        // Contexto al entrar: las últimas líneas de la sala (sin burbujas).
        const msgs = (data.messages || []).filter(m => m.kind === 'user').slice(-6)
        for (const m of msgs) addLine(room, m, false)
      } else if (data.type === 'msg') {
        addLine(room, data, true)
      } else if (data.type === 'color') {
        if (data.name) roomColors[data.name] = data.color
      }
    }
    sock.onclose = () => {
      if (g !== gen) return
      ws = null
      // Caída de red / despliegue: reconecta solo en ~1s (como rumrum).
      setTimeout(() => { if (g === gen) City.connectChat() }, 1000)
    }
  }

  City.disconnectChat = function () {
    gen++
    if (ws) { try { ws.close() } catch (_) {} ws = null }
    wsRoom = null
  }

  // Al cruzar de zona cambia la sala (lo llama checkZone en city.sheet.js).
  City.syncChatRoom = function () {
    if (!ws && wsRoom === null) return     // fuera de la city (nunca conectado)
    if (wsRoom === desiredRoom()) return
    City.connectChat()
  }

  // Mete un mensaje del DO en el log (y burbuja si es en vivo y de otro).
  function addLine(room, m, live) {
    if (m.seq != null) {
      const key = room + ':' + m.seq
      if (seen.has(key)) return
      seen.add(key)
      if (seen.size > 900) {
        const keep = Array.from(seen).slice(-450)
        seen.clear()
        keep.forEach(k => seen.add(k))
      }
    }
    if (m.kind === 'system') {
      // "X se ha conectado / desconectado" — línea gris, sin burbuja.
      City._pushChat('·', '#a99ac2', m.author + ' ' + m.body)
      return
    }
    const mine = m.author === myName()
    if (live && mine) return               // ya pintado optimista al enviar
    const other = (City.others || []).find(o => o.username === m.author)
    const color = roomColors[m.author] ||
      (other && typeof colorHex === 'function' ? colorHex(other.color) : '#9ad06a')
    City._pushChat(m.author, color, m.body)
    // Burbuja sobre su avatar: solo mensajes en vivo de alguien visible en presence.
    if (live && !mine && other) {
      City._says[other.user_id] = { text: String(m.body).slice(0, 120), until: performance.now() + SAY_MS }
    }
  }

  // Say something: show my bubble right away (optimistic) + send over the wire.
  City.sayInWorld = function (text) {
    text = (text || '').trim()
    if (!text || !(window.App && App.user)) return
    if (text.length > 120) text = text.slice(0, 120)
    City._says[App.user.id] = { text, until: performance.now() + SAY_MS }
    City._pushChat(myName() || 'tú',
                   (typeof colorHex === 'function' ? colorHex(App.user.color) : '#ffd24a'), text)
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: 'msg', body: text })) } catch (_) { pending = text }
    } else {
      pending = text
      City.connectChat()
    }
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

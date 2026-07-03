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

  // Registro del chat. Ahora lo pinta una VENTANA DOM estilo Ragnarok (más abajo,
  // City.mountChatWindow); ya NO se pinta en canvas.
  City._chatLog = City._chatLog || []
  // _pushChat(name, color, text[, opts]) — opts.ts (ms) para la hora; opts.system
  // (línea gris cursiva); opts.mine (mensaje propio → sin sonido/badge). Es
  // compatible con quien llame sin opts (p.ej. city.npcs.js): entonces ts = ahora.
  City._pushChat = function (name, color, text, opts) {
    opts = opts || {}
    const line = {
      name: name || 'gato',
      color: color || '#ffd24a',
      text: String(text == null ? '' : text),
      ts: opts.ts || Date.now(),
      system: !!opts.system,
      mine: !!opts.mine,
    }
    City._chatLog.push(line)
    if (City._chatLog.length > 200) City._chatLog.shift()
    // Pinta la línea en la ventana DOM (si está montada) y avisa (sonido/badge).
    if (City._chatAppendLine) City._chatAppendLine(line)
  }

  // ─── Estado del socket ───
  let ws = null            // WebSocket actual (o null)
  let wsRoom = null        // sala del socket actual
  let gen = 0              // generación: invalida reconexiones zombis tras leave()
  let pending = null       // último mensaje escrito con el socket caído
  const seen = new Set()   // `${room}:${seq}` — dedupe entre history y rejoins
  const roomColors = {}    // author → hex (snapshot history + eventos 'color')
  City._chatOnline = 0     // nº de gente en línea en la sala actual (WS presence)

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
    City._chatOnline = 0
    if (City._chatUpdateHeader) City._chatUpdateHeader()
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
        // Cuánta gente hay en línea en esta sala (para la cabecera de la ventana).
        City._chatOnline = Array.isArray(data.online) ? data.online.length : 0
        if (City._chatUpdateHeader) City._chatUpdateHeader()
        // Contexto al entrar: las últimas líneas de la sala (sin burbujas).
        const msgs = (data.messages || []).filter(m => m.kind === 'user').slice(-6)
        for (const m of msgs) addLine(room, m, false)
      } else if (data.type === 'msg') {
        addLine(room, data, true)
      } else if (data.type === 'presence') {
        // La sala avisa de quién está en línea (entradas/salidas) → refresca contador.
        City._chatOnline = Array.isArray(data.online) ? data.online.length : 0
        if (City._chatUpdateHeader) City._chatUpdateHeader()
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
      // "X se ha conectado / desconectado" — línea gris cursiva, sin burbuja.
      City._pushChat('·', '#a99ac2', m.author + ' ' + m.body, { ts: m.ts, system: true })
      return
    }
    const mine = m.author === myName()
    if (live && mine) return               // ya pintado optimista al enviar
    const other = (City.others || []).find(o => o.username === m.author)
    const color = roomColors[m.author] ||
      (other && typeof colorHex === 'function' ? colorHex(other.color) : '#9ad06a')
    City._pushChat(m.author, color, m.body, { ts: m.ts, mine })
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
                   (typeof colorHex === 'function' ? colorHex(App.user.color) : '#ffd24a'), text,
                   { mine: true })
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: 'msg', body: text })) } catch (_) { pending = text }
    } else {
      pending = text
      City.connectChat()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VENTANA DE CHAT estilo Ragnarok Online — panel DOM abajo-izquierda dentro de
  // #mode-city .city-wrap. Arrastrable por la barra de título, minimizable,
  // recuerda posición/estado en localStorage. Cabecera = nombre bonito de la sala
  // + gente en línea. Cada línea con hora hh:mm. Sonido sutil (Web Audio) al
  // recibir mensaje de otro + badge en la barra si está minimizada.
  // Foco del input → WASD/click se pausan solos (City.isInputBlocked); al enviar
  // hacemos blur() para que el juego vuelva a responder (bug clásico del repo).
  // ═══════════════════════════════════════════════════════════════════════════

  const LS_KEY = 'miau.chatWin'           // { x, y, min } en localStorage
  let winEl = null                        // raíz de la ventana (o null)
  let logEl = null                        // contenedor del historial (scroll)
  let inputEl = null                      // input de texto
  let titleTextEl = null                  // "<sala> · N en línea"
  let badgeEl = null                      // puntito en la barra si hay algo nuevo minimizado
  let minimized = false
  let unread = 0

  function isMobile() { return window.matchMedia('(max-width: 720px)').matches }

  function zoneName() {
    const id = City.currentZone || 'plaza'
    const cfg = window.CityConfig && CityConfig.ZONES
    const z = cfg && cfg.find(zz => zz.id === id)
    return (z && z.name) || (id === 'plaza' ? 'la plaza' : id)
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch (_) { return {} }
  }
  function saveState(patch) {
    const s = Object.assign(loadState(), patch)
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch (_) {}
  }

  function two(n) { return (n < 10 ? '0' : '') + n }
  function hhmm(ts) {
    const d = new Date(ts || Date.now())
    return two(d.getHours()) + ':' + two(d.getMinutes())
  }

  // ─── Sonido: blip corto agradable (Web Audio). Perezoso: el AudioContext se
  //     crea al primer gesto del usuario (autoplay policy). ───
  let audioCtx = null
  function primeAudio() {
    if (audioCtx) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) audioCtx = new AC()
    } catch (_) { audioCtx = null }
  }
  window.addEventListener('pointerdown', primeAudio, { once: false })
  window.addEventListener('keydown', primeAudio, { once: false })
  function blip() {
    if (!audioCtx || audioCtx.state === 'closed') return
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const t = audioCtx.currentTime
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, t)
      osc.frequency.exponentialRampToValueAtTime(990, t + 0.09)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.start(t); osc.stop(t + 0.18)
    } catch (_) {}
  }

  // Actualiza el texto de la cabecera (sala + gente en línea). Lo llaman
  // connectChat/history/presence/syncChatRoom vía City._chatUpdateHeader.
  City._chatUpdateHeader = function () {
    if (!titleTextEl) return
    const n = City._chatOnline || 0
    const q = n === 1 ? '1 en línea' : n + ' en línea'
    titleTextEl.textContent = zoneName() + ' · ' + q
  }

  // Añade una línea al historial DOM + sonido/badge si toca. La llama _pushChat.
  City._chatAppendLine = function (line) {
    if (!logEl) return
    const nearBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 24
    const row = document.createElement('div')
    row.className = 'roc-line' + (line.system ? ' roc-sys' : '')
    const time = document.createElement('span')
    time.className = 'roc-time'
    time.textContent = hhmm(line.ts)
    row.appendChild(time)
    if (line.system) {
      const txt = document.createElement('span')
      txt.className = 'roc-txt'
      txt.textContent = line.text
      row.appendChild(txt)
    } else {
      const nm = document.createElement('span')
      nm.className = 'roc-name'
      nm.style.color = line.color || '#ffd24a'
      nm.textContent = line.name + ': '
      const txt = document.createElement('span')
      txt.className = 'roc-txt'
      txt.textContent = line.text
      row.appendChild(nm); row.appendChild(txt)
    }
    logEl.appendChild(row)
    // Poda el DOM (el array ya se poda en _pushChat).
    while (logEl.childElementCount > 200) logEl.removeChild(logEl.firstChild)
    if (nearBottom) logEl.scrollTop = logEl.scrollHeight
    // Aviso solo para mensajes de OTRA persona (no propios, no sistema).
    if (!line.mine && !line.system) {
      blip()
      if (minimized) { unread++; if (badgeEl) { badgeEl.hidden = false; badgeEl.textContent = unread > 9 ? '9+' : String(unread) } }
    }
  }

  function setMinimized(v) {
    minimized = !!v
    if (!winEl) return
    winEl.classList.toggle('roc-min', minimized)
    if (!minimized) { unread = 0; if (badgeEl) badgeEl.hidden = true; if (logEl) logEl.scrollTop = logEl.scrollHeight }
    saveState({ min: minimized })
  }

  City.mountChatWindow = function () {
    if (winEl || document.getElementById('cityChatWin')) return
    const wrap = document.querySelector('#mode-city .city-wrap')
    if (!wrap) return
    injectStyle()

    const st = loadState()
    winEl = document.createElement('div')
    winEl.id = 'cityChatWin'
    winEl.className = 'roc-win'
    winEl.innerHTML =
      '<div class="roc-bar" id="rocBar">' +
        '<span class="roc-title" id="rocTitle">la plaza</span>' +
        '<span class="roc-badge" id="rocBadge" hidden></span>' +
        '<button type="button" class="roc-min-btn" id="rocMinBtn" aria-label="minimizar" title="minimizar">–</button>' +
      '</div>' +
      '<div class="roc-log" id="rocLog" aria-live="polite"></div>' +
      '<form class="roc-form" id="rocForm">' +
        '<input id="rocInput" type="text" maxlength="120" autocomplete="off" ' +
          'placeholder="di algo… (Enter)" aria-label="hablar en la ciudad">' +
        '<button type="submit">decir</button>' +
      '</form>'
    wrap.appendChild(winEl)

    logEl = winEl.querySelector('#rocLog')
    inputEl = winEl.querySelector('#rocInput')
    titleTextEl = winEl.querySelector('#rocTitle')
    badgeEl = winEl.querySelector('#rocBadge')

    // Posición recordada (solo escritorio; en móvil ocupa el ancho abajo por CSS).
    if (!isMobile() && st && typeof st.x === 'number' && typeof st.y === 'number') {
      applyPos(st.x, st.y)
    }
    // Pinta el historial que ya haya en memoria (al reentrar en la ciudad).
    for (const l of City._chatLog) City._chatAppendLine(l)
    unread = 0; if (badgeEl) badgeEl.hidden = true
    logEl.scrollTop = logEl.scrollHeight
    setMinimized(!!st.min)
    City._chatUpdateHeader()

    // Enviar → burbuja + WS, y SOLTAR el foco para que WASD/click vuelvan.
    winEl.querySelector('#rocForm').addEventListener('submit', (e) => {
      e.preventDefault()
      const v = inputEl.value
      inputEl.value = ''
      City.sayInWorld(v)
      inputEl.blur()
    })
    // Minimizar / restaurar.
    winEl.querySelector('#rocMinBtn').addEventListener('click', () => setMinimized(!minimized))
    // Clic en la barra minimizada → restaura (además del botón).
    winEl.querySelector('#rocBar').addEventListener('click', (e) => {
      if (minimized && e.target.id !== 'rocMinBtn') setMinimized(false)
    })

    // Arrastre por la barra de título (solo escritorio).
    setupDrag(winEl.querySelector('#rocBar'))
    window.addEventListener('resize', onWinResize)
  }

  City.unmountChatWindow = function () {
    window.removeEventListener('resize', onWinResize)
    if (winEl) winEl.remove()
    winEl = logEl = inputEl = titleTextEl = badgeEl = null
    minimized = false; unread = 0
  }

  function onWinResize() {
    // Al pasar a móvil quitamos posición absoluta libre (CSS la fija abajo).
    if (!winEl) return
    if (isMobile()) {
      winEl.style.left = winEl.style.top = winEl.style.right = winEl.style.bottom = ''
    } else {
      const st = loadState()
      if (typeof st.x === 'number' && typeof st.y === 'number') applyPos(st.x, st.y)
    }
  }

  // Coloca la ventana en (x,y) dentro del wrap, con clamp para que no se salga.
  function applyPos(x, y) {
    const wrap = winEl && winEl.parentElement
    if (!wrap) return
    const maxX = Math.max(0, wrap.clientWidth - winEl.offsetWidth)
    const maxY = Math.max(0, wrap.clientHeight - winEl.offsetHeight)
    x = Math.max(0, Math.min(maxX, x))
    y = Math.max(0, Math.min(maxY, y))
    winEl.style.left = x + 'px'
    winEl.style.top = y + 'px'
    winEl.style.right = 'auto'
    winEl.style.bottom = 'auto'
  }

  function setupDrag(handle) {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0
    handle.addEventListener('pointerdown', (e) => {
      if (isMobile()) return                 // sin drag en móvil
      if (e.target.id === 'rocMinBtn') return
      dragging = true
      const wrap = winEl.parentElement
      const r = winEl.getBoundingClientRect()
      const wr = wrap.getBoundingClientRect()
      ox = r.left - wr.left; oy = r.top - wr.top
      sx = e.clientX; sy = e.clientY
      handle.setPointerCapture(e.pointerId)
      e.preventDefault()
    })
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return
      applyPos(ox + (e.clientX - sx), oy + (e.clientY - sy))
    })
    const end = (e) => {
      if (!dragging) return
      dragging = false
      try { handle.releasePointerCapture(e.pointerId) } catch (_) {}
      const x = parseFloat(winEl.style.left) || 0
      const y = parseFloat(winEl.style.top) || 0
      saveState({ x, y })
    }
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  function injectStyle() {
    if (document.getElementById('city-chat-style')) return
    const s = document.createElement('style')
    s.id = 'city-chat-style'
    s.textContent = [
      // Ventana: pergamino RO, borde doble oscuro, sombra dura desplazada.
      '.roc-win{position:absolute;left:14px;bottom:14px;z-index:8;width:min(360px,88vw);',
      'display:flex;flex-direction:column;',
      'font:600 12px/1.35 "Galmuri11","Pixelify Sans",ui-monospace,monospace;',
      'border:2px solid #241a33;border-radius:10px;overflow:hidden;',
      'background:linear-gradient(180deg,#f3e6c4,#e2cd9b);',
      'box-shadow:4px 4px 0 rgba(36,26,20,.45);color:#241a33;}',
      // Barra de título
      '.roc-bar{display:flex;align-items:center;gap:8px;cursor:move;user-select:none;',
      'padding:6px 8px;border-bottom:2px solid #3a2a14;',
      'background:linear-gradient(180deg,#e9d7a8,#d9c085);}',
      '.roc-title{flex:1;font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.roc-badge{min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#ff5d8f;color:#fff;',
      'font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}',
      '.roc-min-btn{cursor:pointer;border:2px solid #241a33;border-radius:6px;background:#f3e6c4;color:#241a33;',
      'width:22px;height:20px;line-height:1;font-weight:700;padding:0;}',
      '.roc-min-btn:active{transform:translate(1px,1px);}',
      // Historial con scroll
      '.roc-log{height:150px;overflow-y:auto;overflow-x:hidden;padding:6px 8px;',
      'background:rgba(255,247,224,.35);overscroll-behavior:contain;}',
      '.roc-line{margin:0 0 2px;word-break:break-word;}',
      '.roc-sys{color:#7a6a52;font-style:italic;}',
      '.roc-time{color:#9a8a68;font-size:10px;margin-right:5px;}',
      '.roc-name{font-weight:700;}',
      '.roc-txt{color:#2c2036;}',
      // Línea de input integrada
      '.roc-form{display:flex;gap:6px;padding:6px 8px;border-top:2px solid #3a2a14;',
      'background:linear-gradient(180deg,#ecdcb2,#e2cd9b);}',
      '.roc-form input{flex:1;min-width:0;font:600 13px/1 "Galmuri11","Pixelify Sans",ui-monospace,monospace;',
      'padding:7px 9px;border:2px solid #241a33;border-radius:8px;background:rgba(255,247,234,.95);',
      'color:#241a33;outline:none;}',
      '.roc-form input::placeholder{color:#9a8aa0;}',
      '.roc-form button{font:600 13px/1 "Galmuri11","Pixelify Sans",ui-monospace,monospace;cursor:pointer;',
      'padding:0 12px;border:2px solid #241a33;border-radius:8px;background:#ff5d8f;color:#fff;',
      'box-shadow:2px 2px 0 rgba(36,26,51,.35);}',
      '.roc-form button:active{transform:translate(2px,2px);box-shadow:none;}',
      // Minimizada: solo la barra visible.
      '.roc-win.roc-min .roc-log,.roc-win.roc-min .roc-form{display:none;}',
      // Badge parpadea suave cuando hay algo sin leer minimizado.
      '.roc-win.roc-min .roc-badge:not([hidden]){animation:rocBlink 1s steps(2,start) infinite;}',
      '@keyframes rocBlink{50%{opacity:.35;}}',
      // Móvil: ancho abajo, sin drag, un pelín más bajo el log.
      '@media (max-width:720px){',
      '.roc-win{left:0;right:0;bottom:0;width:100%;border-radius:0;border-left:0;border-right:0;border-bottom:0;}',
      '.roc-bar{cursor:default;}',
      '.roc-log{height:120px;}}',
    ].join('')
    document.head.appendChild(s)
  }
})()

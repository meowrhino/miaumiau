// City — chat en vivo (motor rumrum): WebSocket a /ws.
//
// Aquí conviven DOS cosas montadas sobre la MISMA estética (ventana estilo
// Ragnarok, clases roc-*):
//   1) La VENTANA DE SALA (singleton): sala = zona del mapa (o 'plaza').
//      Cruzar una zona = cambiar de sala. Sus mensajes generan burbuja sobre
//      los avatares (City._says) y quedan en el log. Recuerda pos/estado en
//      localStorage 'miau.chatWin'. NO cambia para el usuario.
//   2) Los SUSURROS 1:1 (DM): ventanas instanciables, cada una con su propio
//      WebSocket a `dm:<a>~<b>`, en cascada, cerrables. No generan burbuja.
//
// Para no duplicar código, la ventana DOM es una FACTORY (makeChatWindow) que
// crea una instancia con su historial, input, cabecera, drag y minimizar. La
// ventana de sala es una instancia de esa factory; cada DM es otra.
//
// State: City._says (user_id → {text, until}) lo leen drawOther/drawPlayer en
// city.render.entities.js. Ciclo de vida: city.js enter() llama
// City.connectChat()/mountChatWindow(); leave() los deshace. El cambio de sala
// lo dispara checkZone (city.sheet.js) vía City.syncChatRoom().
;(function () {
  if (!window.City) return
  const City = window.City
  City._says = City._says || {}              // user_id → { text, until (perf.now ms) }
  const SAY_MS = 5200                         // how long a bubble lingers

  // ═══════════════════════════════════════════════════════════════════════════
  // SONIDO: blip corto (Web Audio). Compartido por todas las ventanas. Perezoso:
  // el AudioContext se crea al primer gesto del usuario (autoplay policy).
  // ═══════════════════════════════════════════════════════════════════════════
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

  function isMobile() { return window.matchMedia('(max-width: 720px)').matches }
  function myName() {
    const u = window.App && App.user
    return u ? (u.display_name || u.username || '') : ''
  }
  // Credencial en el query (los WS del navegador no mandan headers).
  function authQuery() {
    const u = window.App && App.user
    if (!u) return null
    if (u.token) return 'token=' + encodeURIComponent(u.token)
    if (u.username && u.secret) return 'miau=' + encodeURIComponent(u.username + '#' + u.secret)
    return null
  }
  function two(n) { return (n < 10 ? '0' : '') + n }
  function hhmm(ts) {
    const d = new Date(ts || Date.now())
    return two(d.getHours()) + ':' + two(d.getMinutes())
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FACTORY de VENTANA estilo Ragnarok Online — panel DOM dentro de
  // #mode-city .city-wrap. Arrastrable por la barra, minimizable, opcionalmente
  // cerrable (✕). Cabecera con título + subtítulo. Cada línea con hora hh:mm.
  // Blip + badge al recibir de otro estando minimizada.
  //
  // opts: {
  //   id, title, titleColor, closable (bool), lsKey (string|null: recuerda pos),
  //   cascadeIndex (number: desplaza en cascada si no hay pos guardada),
  //   onSend(text), onClose()
  // }
  // Devuelve un objeto instancia con métodos: appendLine, setHeader, mount,
  // unmount, focus, isMounted, setMinimized.
  // ═══════════════════════════════════════════════════════════════════════════
  function makeChatWindow(opts) {
    opts = opts || {}
    const inst = {
      winEl: null, logEl: null, inputEl: null, titleTextEl: null,
      subEl: null, badgeEl: null, minimized: false, unread: 0, log: [],
    }

    function loadState() {
      if (!opts.lsKey) return {}
      try { return JSON.parse(localStorage.getItem(opts.lsKey)) || {} } catch (_) { return {} }
    }
    function saveState(patch) {
      if (!opts.lsKey) return
      const s = Object.assign(loadState(), patch)
      try { localStorage.setItem(opts.lsKey, JSON.stringify(s)) } catch (_) {}
    }

    inst.setHeader = function (title, subtitle, titleColor) {
      if (title != null && inst.titleTextEl) inst.titleTextEl.textContent = title
      if (titleColor != null && inst.titleTextEl) inst.titleTextEl.style.color = titleColor
      if (subtitle != null && inst.subEl) inst.subEl.textContent = subtitle
    }

    // Añade una línea al historial DOM (+ sonido/badge si toca).
    // line: { name, color, text, ts, system, mine, quest }
    // quest = aviso de recado/misión: dorado, solo texto, sin sonido (estilo RO).
    inst.appendLine = function (line) {
      inst.log.push(line)
      if (inst.log.length > 200) inst.log.shift()
      if (!inst.logEl) return
      const el = inst.logEl
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
      const row = document.createElement('div')
      row.className = 'roc-line' + (line.system ? ' roc-sys' : '') + (line.quest ? ' roc-quest' : '')
      const time = document.createElement('span')
      time.className = 'roc-time'
      time.textContent = hhmm(line.ts)
      row.appendChild(time)
      if (line.system || line.quest) {
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
      el.appendChild(row)
      while (el.childElementCount > 200) el.removeChild(el.firstChild)
      if (nearBottom) el.scrollTop = el.scrollHeight
      // Aviso solo para mensajes de OTRA persona (no propios, no sistema/misión).
      if (!line.mine && !line.system && !line.quest) {
        blip()
        if (inst.minimized && inst.badgeEl) {
          inst.unread++
          inst.badgeEl.hidden = false
          inst.badgeEl.textContent = inst.unread > 9 ? '9+' : String(inst.unread)
        }
      }
    }

    inst.setMinimized = function (v) {
      inst.minimized = !!v
      if (!inst.winEl) return
      inst.winEl.classList.toggle('roc-min', inst.minimized)
      if (!inst.minimized) {
        inst.unread = 0
        if (inst.badgeEl) inst.badgeEl.hidden = true
        if (inst.logEl) inst.logEl.scrollTop = inst.logEl.scrollHeight
      }
      saveState({ min: inst.minimized })
    }

    inst.isMounted = function () { return !!inst.winEl }
    inst.focus = function () { if (inst.inputEl) inst.inputEl.focus() }

    // Coloca la ventana en (x,y) dentro del wrap, con clamp para que no se salga.
    function applyPos(x, y) {
      const wrap = inst.winEl && inst.winEl.parentElement
      if (!wrap) return
      const maxX = Math.max(0, wrap.clientWidth - inst.winEl.offsetWidth)
      const maxY = Math.max(0, wrap.clientHeight - inst.winEl.offsetHeight)
      x = Math.max(0, Math.min(maxX, x))
      y = Math.max(0, Math.min(maxY, y))
      inst.winEl.style.left = x + 'px'
      inst.winEl.style.top = y + 'px'
      inst.winEl.style.right = 'auto'
      inst.winEl.style.bottom = 'auto'
    }

    function onWinResize() {
      if (!inst.winEl) return
      if (isMobile()) {
        inst.winEl.style.left = inst.winEl.style.top = inst.winEl.style.right = inst.winEl.style.bottom = ''
      } else {
        const st = loadState()
        if (typeof st.x === 'number' && typeof st.y === 'number') applyPos(st.x, st.y)
      }
    }

    function setupDrag(handle) {
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0
      handle.addEventListener('pointerdown', (e) => {
        if (isMobile()) return
        if (e.target.classList && (e.target.classList.contains('roc-min-btn') || e.target.classList.contains('roc-close-btn'))) return
        dragging = true
        const wrap = inst.winEl.parentElement
        const r = inst.winEl.getBoundingClientRect()
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
        const x = parseFloat(inst.winEl.style.left) || 0
        const y = parseFloat(inst.winEl.style.top) || 0
        saveState({ x, y })
      }
      handle.addEventListener('pointerup', end)
      handle.addEventListener('pointercancel', end)
    }

    inst.mount = function () {
      if (inst.winEl || (opts.id && document.getElementById(opts.id))) return
      const wrap = document.querySelector('#mode-city .city-wrap')
      if (!wrap) return
      injectStyle()

      const st = loadState()
      const win = document.createElement('div')
      if (opts.id) win.id = opts.id
      win.className = 'roc-win' + (opts.closable ? ' roc-dm' : '')
      win.innerHTML =
        '<div class="roc-bar">' +
          '<span class="roc-head">' +
            '<span class="roc-title"></span>' +
            '<span class="roc-sub"></span>' +
          '</span>' +
          '<span class="roc-badge" hidden></span>' +
          '<button type="button" class="roc-min-btn" aria-label="minimizar" title="minimizar">–</button>' +
          (opts.closable ? '<button type="button" class="roc-close-btn" aria-label="cerrar" title="cerrar">✕</button>' : '') +
        '</div>' +
        '<div class="roc-log" aria-live="polite"></div>' +
        '<form class="roc-form">' +
          '<input type="text" maxlength="120" autocomplete="off" ' +
            'placeholder="di algo… (Enter)" aria-label="hablar">' +
          '<button type="submit">decir</button>' +
        '</form>'
      wrap.appendChild(win)
      inst.winEl = win
      inst.logEl = win.querySelector('.roc-log')
      inst.inputEl = win.querySelector('.roc-form input')
      inst.titleTextEl = win.querySelector('.roc-title')
      inst.subEl = win.querySelector('.roc-sub')
      inst.badgeEl = win.querySelector('.roc-badge')

      inst.setHeader(opts.title || '', '', opts.titleColor)

      // Posición: recordada (si lsKey), o cascada, o CSS por defecto.
      if (!isMobile()) {
        if (opts.lsKey && typeof st.x === 'number' && typeof st.y === 'number') {
          applyPos(st.x, st.y)
        } else if (opts.cascadeIndex) {
          // En cascada respecto a la ventana de sala (abajo-izquierda): sube y
          // desplaza a la derecha para no taparla.
          applyPos(28 + opts.cascadeIndex * 26, wrap.clientHeight - 300 - opts.cascadeIndex * 26)
        }
      }

      // Pinta el historial que ya haya en memoria (reentrada).
      const prev = inst.log; inst.log = []
      for (const l of prev) inst.appendLine(l)
      inst.unread = 0; if (inst.badgeEl) inst.badgeEl.hidden = true
      inst.logEl.scrollTop = inst.logEl.scrollHeight
      inst.setMinimized(!!st.min)

      // Enviar → callback + SOLTAR foco (para que WASD/click vuelvan al juego).
      win.querySelector('.roc-form').addEventListener('submit', (e) => {
        e.preventDefault()
        const v = inst.inputEl.value
        inst.inputEl.value = ''
        if (opts.onSend) opts.onSend(v)
        inst.inputEl.blur()
      })
      win.querySelector('.roc-min-btn').addEventListener('click', () => inst.setMinimized(!inst.minimized))
      if (opts.closable) {
        win.querySelector('.roc-close-btn').addEventListener('click', () => {
          if (opts.onClose) opts.onClose()
        })
      }
      // Clic en la barra minimizada → restaura.
      win.querySelector('.roc-bar').addEventListener('click', (e) => {
        const cl = e.target.classList
        if (inst.minimized && cl && !cl.contains('roc-min-btn') && !cl.contains('roc-close-btn')) inst.setMinimized(false)
      })

      setupDrag(win.querySelector('.roc-bar'))
      inst._onWinResize = onWinResize
      window.addEventListener('resize', onWinResize)
    }

    inst.unmount = function () {
      if (inst._onWinResize) window.removeEventListener('resize', inst._onWinResize)
      if (inst.winEl) inst.winEl.remove()
      inst.winEl = inst.logEl = inst.inputEl = inst.titleTextEl = inst.subEl = inst.badgeEl = null
      inst.minimized = false; inst.unread = 0
    }

    return inst
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONEXIÓN a una sala del ConversationDO. Encapsula socket + reconexión +
  // dedupe por seq. La usan tanto la sala como los DMs.
  //
  // opts: { room, onLine(m, live), onOnline(n), onColor(name,color) }
  // Devuelve { connect, disconnect, send, room, isOpen }.
  // ═══════════════════════════════════════════════════════════════════════════
  function makeRoomConnection(opts) {
    let ws = null
    let gen = 0
    let pending = null
    const seen = new Set()
    const roomColors = {}
    const conn = { room: opts.room, roomColors }

    conn.connect = function () {
      const auth = authQuery()
      if (!auth) return
      const g = ++gen
      if (ws) { try { ws.close() } catch (_) {} ws = null }
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
      const sock = new WebSocket(proto + location.host + '/ws?room=' + encodeURIComponent(conn.room) + '&' + auth)
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
          if (opts.onOnline) opts.onOnline(Array.isArray(data.online) ? data.online.length : 0)
          const msgs = (data.messages || []).filter(m => m.kind === 'user' || m.kind === 'system')
          for (const m of msgs) feed(m, false)
        } else if (data.type === 'msg') {
          feed(data, true)
        } else if (data.type === 'presence') {
          if (opts.onOnline) opts.onOnline(Array.isArray(data.online) ? data.online.length : 0)
        } else if (data.type === 'color') {
          if (data.name) { roomColors[data.name] = data.color; if (opts.onColor) opts.onColor(data.name, data.color) }
        }
      }
      sock.onclose = () => {
        if (g !== gen) return
        ws = null
        setTimeout(() => { if (g === gen) conn.connect() }, 1000)
      }
    }

    // Dedupe por seq y reenvía a onLine.
    function feed(m, live) {
      if (m.seq != null) {
        const key = conn.room + ':' + m.seq
        if (seen.has(key)) return
        seen.add(key)
        if (seen.size > 900) {
          const keep = Array.from(seen).slice(-450)
          seen.clear(); keep.forEach(k => seen.add(k))
        }
      }
      if (opts.onLine) opts.onLine(m, live)
    }

    conn.disconnect = function () {
      gen++
      if (ws) { try { ws.close() } catch (_) {} ws = null }
    }
    conn.isOpen = function () { return ws && ws.readyState === 1 }
    conn.send = function (text) {
      if (conn.isOpen()) {
        try { ws.send(JSON.stringify({ type: 'msg', body: text })) } catch (_) { pending = text }
      } else {
        pending = text
        conn.connect()
      }
    }
    return conn
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VENTANA DE SALA (singleton) — zona del mapa. Reusa la factory de arriba.
  // ═══════════════════════════════════════════════════════════════════════════

  const LS_KEY = 'miau.chatWin'
  let roomWin = null       // instancia de ventana de sala (o null)
  let roomConn = null      // conexión de la sala (o null)
  let wsRoom = null        // sala actual (para syncChatRoom)
  City._chatOnline = 0

  function desiredRoom() { return City.currentZone || 'plaza' }

  function zoneName() {
    const id = City.currentZone || 'plaza'
    const cfg = window.CityConfig && CityConfig.ZONES
    const z = cfg && cfg.find(zz => zz.id === id)
    return (z && z.name) || (id === 'plaza' ? 'la plaza' : id)
  }

  // Cabecera de la ventana de sala (nombre bonito + gente en línea).
  City._chatUpdateHeader = function () {
    if (!roomWin) return
    const n = City._chatOnline || 0
    const q = n === 1 ? '1 en línea' : n + ' en línea'
    roomWin.setHeader(zoneName(), q)
  }

  // Log de sala (compatible con quien llame sin opts, p.ej. city.npcs.js).
  City._chatLog = City._chatLog || []
  City._pushChat = function (name, color, text, opts) {
    opts = opts || {}
    const line = {
      name: name || 'gato',
      color: color || '#ffd24a',
      text: String(text == null ? '' : text),
      ts: opts.ts || Date.now(),
      system: !!opts.system,
      mine: !!opts.mine,
      quest: !!opts.quest,
    }
    City._chatLog.push(line)
    if (City._chatLog.length > 200) City._chatLog.shift()
    if (roomWin) roomWin.appendLine(line)
  }

  // Aviso de recado/misión: línea dorada DENTRO de la ventana de chat (estilo
  // RO). Si la ventana no está montada (fuera de la city), cae al toast.
  City.notifyInChat = function (text) {
    if (roomWin) City._pushChat('📜', '#8a6d1e', text, { quest: true })
    else if (typeof showToast === 'function') showToast(text, 3000)
  }

  // Mete un mensaje del DO en el log de sala (+ burbuja si en vivo y de otro).
  function roomAddLine(m, live) {
    if (m.kind === 'system') {
      City._pushChat('·', '#a99ac2', m.author + ' ' + m.body, { ts: m.ts, system: true })
      return
    }
    const mine = m.author === myName()
    if (live && mine) return
    const other = (City.others || []).find(o => o.username === m.author)
    const color = (roomConn && roomConn.roomColors[m.author]) ||
      (other && typeof colorHex === 'function' ? colorHex(other.color) : '#9ad06a')
    City._pushChat(m.author, color, m.body, { ts: m.ts, mine })
    if (live && !mine && other) {
      City._says[other.user_id] = { text: String(m.body).slice(0, 120), until: performance.now() + SAY_MS }
    }
  }

  City.connectChat = function () {
    if (!authQuery()) return
    if (roomConn) roomConn.disconnect()
    const room = desiredRoom()
    wsRoom = room
    City._chatOnline = 0
    City._chatUpdateHeader()
    roomConn = makeRoomConnection({
      room,
      onLine: roomAddLine,
      onOnline: (n) => { City._chatOnline = n; City._chatUpdateHeader() },
    })
    roomConn.connect()
  }

  City.disconnectChat = function () {
    if (roomConn) { roomConn.disconnect(); roomConn = null }
    wsRoom = null
  }

  City.syncChatRoom = function () {
    if (!roomConn && wsRoom === null) return
    if (wsRoom === desiredRoom()) return
    City.connectChat()
  }

  // Say something: burbuja propia (optimista) + envío por el socket de sala.
  City.sayInWorld = function (text) {
    text = (text || '').trim()
    if (!text || !(window.App && App.user)) return
    if (text.length > 120) text = text.slice(0, 120)
    City._says[App.user.id] = { text, until: performance.now() + SAY_MS }
    City._pushChat(myName() || 'tú',
                   (typeof colorHex === 'function' ? colorHex(App.user.color) : '#ffd24a'), text,
                   { mine: true })
    if (roomConn) roomConn.send(text)
    else { City.connectChat(); if (roomConn) roomConn.send(text) }
  }

  City.mountChatWindow = function () {
    if (roomWin) return
    roomWin = makeChatWindow({
      id: 'cityChatWin',
      title: 'la plaza',
      lsKey: LS_KEY,
      closable: false,
      onSend: (v) => City.sayInWorld(v),
    })
    roomWin.mount()
    // Rellena con el historial que ya haya en memoria.
    const prev = City._chatLog.slice()
    for (const l of prev) roomWin.appendLine(l)
    City._chatUpdateHeader()
  }

  City.unmountChatWindow = function () {
    if (roomWin) { roomWin.unmount(); roomWin = null }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUSURROS 1:1 (DM) — ventanas instanciables en cascada. Máx 3 abiertas.
  // ═══════════════════════════════════════════════════════════════════════════

  const MAX_DM = 3
  const dmWins = {}         // otherId → { win, conn, other }
  let dmCount = 0

  function dmRoomId(myId, otherId) {
    const a = Math.min(myId, otherId), b = Math.max(myId, otherId)
    return 'dm:' + a + '~' + b
  }

  // Abre (o enfoca) la ventana de susurro con otro usuario.
  // other: { user_id|id, username, color }
  City.openWhisper = function (other) {
    const me = window.App && App.user
    if (!me) return
    const otherId = Number(other.user_id != null ? other.user_id : other.id)
    if (!otherId || otherId === me.id) return

    // Ya abierta → enfócala (y restaura si estaba minimizada).
    const existing = dmWins[otherId]
    if (existing) {
      if (existing.win.minimized) existing.win.setMinimized(false)
      existing.win.focus()
      City._markDmSeen(otherId)
      return
    }
    if (dmCount >= MAX_DM) {
      if (typeof showToast === 'function') showToast('máximo 3 susurros a la vez 🤫', 1800)
      return
    }

    const color = (typeof colorHex === 'function') ? colorHex(other.color) : '#ffd24a'
    const room = dmRoomId(me.id, otherId)
    const cascadeIndex = dmCount + 1

    const win = makeChatWindow({
      id: 'cityDmWin_' + otherId,
      title: other.username || 'gato',
      titleColor: color,
      closable: true,
      lsKey: null,
      cascadeIndex,
      onSend: (v) => dmSend(otherId, v),
      onClose: () => City.closeWhisper(otherId),
    })
    win.mount()
    win.setHeader(other.username || 'gato', 'susurro privado', color)

    const conn = makeRoomConnection({
      room,
      onLine: (m, live) => dmAddLine(otherId, color, m, live),
    })
    conn.connect()

    dmWins[otherId] = { win, conn, other: { id: otherId, username: other.username, color: other.color } }
    dmCount++
    City._markDmSeen(otherId)
    win.focus()
    if (window.track) track('city:whisper_open', { to: otherId })
  }

  City.closeWhisper = function (otherId) {
    const d = dmWins[otherId]
    if (!d) return
    d.conn.disconnect()
    d.win.unmount()
    delete dmWins[otherId]
    dmCount = Math.max(0, dmCount - 1)
  }

  function dmSend(otherId, text) {
    text = (text || '').trim()
    if (!text) return
    if (text.length > 120) text = text.slice(0, 120)
    const d = dmWins[otherId]
    if (!d) return
    // Pinta optimista (mío).
    d.win.appendLine({
      name: myName() || 'tú',
      color: (typeof colorHex === 'function' ? colorHex(App.user.color) : '#ffd24a'),
      text, ts: Date.now(), mine: true,
    })
    d.conn.send(text)
    // Marca actividad en la bandeja (para no-leídos del otro).
    if (typeof API !== 'undefined') API.post('/dm/touch', { other_id: otherId }).catch(() => {})
    City._markDmSeen(otherId)
  }

  function dmAddLine(otherId, otherColor, m, live) {
    const d = dmWins[otherId]
    if (!d) return
    if (m.kind === 'system') {
      d.win.appendLine({ name: '·', color: '#a99ac2', text: m.author + ' ' + m.body, ts: m.ts, system: true })
      return
    }
    const mine = m.author === myName()
    if (live && mine) return   // ya pintado optimista
    const color = mine
      ? (typeof colorHex === 'function' ? colorHex(App.user.color) : '#ffd24a')
      : otherColor
    d.win.appendLine({ name: m.author, color, text: m.body, ts: m.ts, mine })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NO-LEÍDOS de DM sin ventana abierta — badge 💌 abajo-derecha (encima de la
  // mascota). Cada ~25s: GET /api/dm, compara last_ts con el mapa "visto" en
  // localStorage 'miau.dmSeen'. Si hay novedades de OTRO, muestra el badge.
  // ═══════════════════════════════════════════════════════════════════════════

  const DM_SEEN_KEY = 'miau.dmSeen'   // { otherId: last_ts_visto }
  let dmPollTimer = 0
  let dmBadgeEl = null
  let dmListEl = null
  let lastDmList = []                 // último GET /api/dm

  function loadSeen() {
    try { return JSON.parse(localStorage.getItem(DM_SEEN_KEY)) || {} } catch (_) { return {} }
  }
  function saveSeen(map) {
    try { localStorage.setItem(DM_SEEN_KEY, JSON.stringify(map)) } catch (_) {}
  }
  // Marca como visto el DM con otherId (usa el last_ts que tengamos en memoria).
  City._markDmSeen = function (otherId) {
    const row = lastDmList.find(r => Number(r.id) === Number(otherId))
    const seen = loadSeen()
    seen[otherId] = row ? row.last_ts : new Date().toISOString()
    saveSeen(seen)
    refreshDmBadge()
  }

  // ¿Hay DMs con novedad de OTRO (last_from != yo y last_ts > visto)?
  function unreadDms() {
    const me = window.App && App.user
    if (!me) return []
    const seen = loadSeen()
    return lastDmList.filter(r => {
      if (Number(r.last_from) === Number(me.id)) return false   // lo último lo dije yo
      const seenTs = seen[r.id]
      return !seenTs || String(r.last_ts) > String(seenTs)
    })
  }

  function refreshDmBadge() {
    const news = unreadDms()
    if (!dmBadgeEl) return
    if (news.length === 0) {
      dmBadgeEl.hidden = true
      if (dmListEl) dmListEl.hidden = true
      return
    }
    dmBadgeEl.hidden = false
    const countEl = dmBadgeEl.querySelector('.roc-dmnew-count')
    if (countEl) { countEl.textContent = news.length > 9 ? '9+' : String(news.length); countEl.hidden = false }
  }

  function toggleDmList() {
    if (!dmListEl) return
    if (!dmListEl.hidden) { dmListEl.hidden = true; return }
    const news = unreadDms()
    dmListEl.innerHTML = ''
    for (const r of news) {
      const color = (typeof colorHex === 'function') ? colorHex(r.color) : '#ffd24a'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'roc-dmnew-item'
      const nm = document.createElement('span')
      nm.className = 'roc-dmnew-name'
      nm.style.color = color
      nm.textContent = r.username || 'gato'
      btn.appendChild(nm)
      btn.appendChild(document.createTextNode(' te susurró 🤫'))
      btn.addEventListener('click', () => {
        dmListEl.hidden = true
        City.openWhisper({ user_id: r.id, username: r.username, color: r.color })
      })
      dmListEl.appendChild(btn)
    }
    dmListEl.hidden = news.length === 0
  }

  function ensureDmBadge() {
    if (dmBadgeEl) return
    const wrap = document.querySelector('#mode-city .city-wrap') || document.body
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'cityDmBadge'
    b.className = 'roc-dmnew'
    b.setAttribute('aria-label', 'susurros nuevos')
    b.hidden = true
    b.innerHTML = '<span class="roc-dmnew-ico">💌</span><span class="roc-dmnew-count" hidden></span>'
    b.addEventListener('click', toggleDmList)
    const list = document.createElement('div')
    list.id = 'cityDmList'
    list.className = 'roc-dmnew-list'
    list.hidden = true
    wrap.appendChild(b)
    wrap.appendChild(list)
    dmBadgeEl = b
    dmListEl = list
  }

  async function pollDms() {
    if (!(window.App && App.user) || typeof API === 'undefined') return
    try {
      const list = await API.get('/dm')
      lastDmList = Array.isArray(list) ? list : []
      refreshDmBadge()
    } catch (_) {}
  }

  // Arranca el badge + polling. Lo llama city.js enter() (junto a connectChat).
  City.startDmWatch = function () {
    if (!(window.App && App.user)) return
    ensureDmBadge()
    pollDms()
    clearInterval(dmPollTimer)
    dmPollTimer = setInterval(pollDms, 25000)
  }
  // Lo llama city.js leave().
  City.stopDmWatch = function () {
    clearInterval(dmPollTimer); dmPollTimer = 0
    // Cierra las ventanas DM abiertas.
    for (const id of Object.keys(dmWins)) City.closeWhisper(Number(id))
    if (dmBadgeEl) { dmBadgeEl.remove(); dmBadgeEl = null }
    if (dmListEl) { dmListEl.remove(); dmListEl = null }
    lastDmList = []
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTILOS (roc-*) — pergamino RO. Compartidos por sala y DMs.
  // ═══════════════════════════════════════════════════════════════════════════
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
      // Ventanas DM: un pelín más estrechas y con acento rosa en el borde.
      '.roc-win.roc-dm{width:min(320px,86vw);z-index:9;border-color:#7a2a4a;}',
      // Barra de título
      '.roc-bar{display:flex;align-items:center;gap:8px;cursor:move;user-select:none;',
      'padding:6px 8px;border-bottom:2px solid #3a2a14;',
      'background:linear-gradient(180deg,#e9d7a8,#d9c085);}',
      '.roc-head{flex:1;display:flex;flex-direction:column;min-width:0;line-height:1.1;}',
      '.roc-title{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.roc-sub{font-weight:600;font-size:10px;color:#7a6a52;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.roc-badge{min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#ff5d8f;color:#fff;',
      'font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}',
      '.roc-min-btn,.roc-close-btn{cursor:pointer;border:2px solid #241a33;border-radius:6px;background:#f3e6c4;color:#241a33;',
      'width:22px;height:20px;line-height:1;font-weight:700;padding:0;}',
      '.roc-close-btn{background:#ffd7e2;}',
      '.roc-min-btn:active,.roc-close-btn:active{transform:translate(1px,1px);}',
      // Historial con scroll
      '.roc-log{height:150px;overflow-y:auto;overflow-x:hidden;padding:6px 8px;',
      'background:rgba(255,247,224,.35);overscroll-behavior:contain;}',
      '.roc-line{margin:0 0 2px;word-break:break-word;}',
      '.roc-sys{color:#7a6a52;font-style:italic;}',
      '.roc-quest{color:#8a6d1e;font-weight:700;}',   // avisos de recado (dorado RO)
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
      '.roc-win.roc-min .roc-badge:not([hidden]){animation:rocBlink 1s steps(2,start) infinite;}',
      '@keyframes rocBlink{50%{opacity:.35;}}',
      // Badge 💌 de susurros nuevos — abajo-derecha, ENCIMA de la mascota
      // (mascota vive en bottom:14px right:16px, 64px). Lo subimos.
      '.roc-dmnew{position:fixed;right:16px;bottom:88px;z-index:101;width:46px;height:46px;',
      'border:2px solid #7a2a4a;border-radius:50%;background:linear-gradient(180deg,#fff0f5,#ffd7e2);',
      'cursor:pointer;box-shadow:3px 3px 0 rgba(36,26,51,.35);display:flex;align-items:center;justify-content:center;',
      'font-size:22px;line-height:1;padding:0;animation:rocBlink 1.4s steps(2,start) infinite;}',
      '.roc-dmnew:active{transform:translate(2px,2px);box-shadow:none;}',
      '.roc-dmnew-count{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;',
      'border-radius:9px;background:#ff2d6f;color:#fff;font:700 10px/16px ui-monospace,monospace;',
      'display:inline-flex;align-items:center;justify-content:center;}',
      '.roc-dmnew-list{position:fixed;right:16px;bottom:140px;z-index:101;width:min(240px,80vw);',
      'display:flex;flex-direction:column;gap:4px;padding:6px;',
      'border:2px solid #7a2a4a;border-radius:10px;background:linear-gradient(180deg,#f3e6c4,#e2cd9b);',
      'box-shadow:4px 4px 0 rgba(36,26,20,.45);}',
      '.roc-dmnew-item{cursor:pointer;text-align:left;border:2px solid #241a33;border-radius:8px;',
      'background:rgba(255,247,234,.95);color:#241a33;padding:6px 8px;',
      'font:600 12px/1.3 "Galmuri11","Pixelify Sans",ui-monospace,monospace;}',
      '.roc-dmnew-item:active{transform:translate(1px,1px);}',
      '.roc-dmnew-name{font-weight:700;}',
      // Móvil: ancho abajo, sin drag, un pelín más bajo el log.
      '@media (max-width:720px){',
      '.roc-win{left:0;right:0;bottom:0;width:100%;border-radius:0;border-left:0;border-right:0;border-bottom:0;}',
      '.roc-win.roc-dm{width:100%;}',
      '.roc-bar{cursor:default;}',
      '.roc-log{height:120px;}}',
    ].join('')
    document.head.appendChild(s)
  }
})()

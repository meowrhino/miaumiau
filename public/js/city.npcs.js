// City — VECINOS (NPCs). El alma del barrio: aunque no haya nadie conectado, el
// parque está habitado. Cada vecino pasea despacio alrededor de su casa, se para,
// y suelta frases ambientales. Datos en city.config.js (NPCS). Loads after city.js.
//
// Atributos por vecino (en runtime): x,y, dir, walking, target, pauseUntil,
// say {text, until}, sprite, phase. Se actualizan en updateNpcs() (llamado desde
// el tick de city.js) y se pintan en drawNpc() (encolado por city.render.js).
;(function () {
  if (!window.City || !window.CityConfig) return
  const City = window.City
  const { NPCS, PLAYER_SIZE, TABLON } = window.CityConfig
  if (!NPCS || !NPCS.length) return

  const PS = PLAYER_SIZE || 60
  const SPEED = 46          // px/s — los vecinos pasean (el jugador va a 320)

  // Crea los vecinos desde la config + genera su carita (poporing SVG).
  City.initNpcs = function () {
    if (City.npcs && City.npcs.length) return   // idempotente (re-enter al pueblo)
    City.npcs = NPCS.map((n, i) => {
      const npc = {
        name: n.name, color: n.color, lines: n.lines || ['buenas!'],
        home: n.home, roam: n.roam || 220, near: n.near || 'el barrio',
        gift: n.gift || { emoji: '🎁', name: 'un detalle' },
        x: n.home.x, y: n.home.y, dir: 0, walking: false,
        target: null, pauseUntil: 500 + i * 700, say: null,
        sprite: null, phase: (n.seed || i * 13) % 1000, _heartUntil: 0,
        // buzón del vecino (objeto fijo): junto a su casa, donde recibe las fotos
        buzon: n.buzon || { x: n.home.x + 52, y: n.home.y + 28 }, buzonFlash: 0,
      }
      if (typeof generateCatSvg === 'function') {
        const svg = generateCatSvg(n.seed != null ? n.seed : i * 131, n.color)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => { npc.sprite = img; URL.revokeObjectURL(url) }
        img.src = url
      }
      return npc
    })
    City.tablon = TABLON || null
  }

  // Elige un destino andable dentro del radio de paseo (varios intentos).
  function pickTarget(npc) {
    const land = City._pointInLand
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * npc.roam
      const x = npc.home.x + Math.cos(a) * r
      const y = npc.home.y + Math.sin(a) * r
      if (!land || land(x, y)) return { x, y }
    }
    return { x: npc.home.x, y: npc.home.y }
  }

  // Paso de simulación. dt en segundos, now en ms (mismo reloj que el render).
  City.updateNpcs = function (dt, now) {
    const npcs = City.npcs
    if (!npcs) return
    const land = City._pointInLand
    for (const npc of npcs) {
      // Frase ambiental ocasional (independiente de moverse o no).
      if ((!npc.say || npc.say.until < now) && Math.random() < dt * 0.06) {
        npc.say = { text: npc.lines[(Math.random() * npc.lines.length) | 0], until: now + 2800 }
      }
      // Descansando.
      if (npc.pauseUntil > now) { npc.walking = false; continue }
      // Pausa cumplida y sin destino: casi siempre arranca un paseo nuevo; a veces
      // se queda un rato más parado. (Decisión por evento, NO por frame: si se
      // escalara por dt sería ~0 y nunca pasearían.)
      if (!npc.target) {
        if (Math.random() < 0.85) npc.target = pickTarget(npc)
        else { npc.pauseUntil = now + 600 + Math.random() * 1600; npc.walking = false; continue }
      }
      const dx = npc.target.x - npc.x, dy = npc.target.y - npc.y
      const d = Math.hypot(dx, dy)
      if (d < 6) {           // llegó → descansa antes del siguiente paseo
        npc.target = null; npc.walking = false
        npc.pauseUntil = now + 1200 + Math.random() * 3400
        continue
      }
      const sx = (dx / d) * SPEED * dt, sy = (dy / d) * SPEED * dt
      let moved = false
      if (!land || land(npc.x + sx, npc.y)) { npc.x += sx; moved = true }
      if (!land || land(npc.x, npc.y + sy)) { npc.y += sy; moved = true }
      if (!moved) { npc.target = null; npc.pauseUntil = now + 500 }   // atascado: replantea
      npc.walking = moved
      if (dx < -0.1) npc.dir = 1
      else if (dx > 0.1) npc.dir = 0
    }
  }

  // ─── RECADOS (misiones de barrio) ────────────────────────────────────────
  // Click a un vecino sin recado → te encarga llevar algo a OTRO vecino. Vas,
  // clicas al destinatario → entrega + recompensa. Un recado activo a la vez.
  const ITEMS = [
    { emoji: '✉️', name: 'una carta' },
    { emoji: '🥘', name: 'un táper de lentejas' },
    { emoji: '📰', name: 'el periódico' },
    { emoji: '🌼', name: 'unas flores' },
    { emoji: '🍅', name: 'tomates del huerto' },
    { emoji: '🔑', name: 'unas llaves' },
    { emoji: '🧶', name: 'un ovillo de lana' },
    { emoji: '🍰', name: 'un trozo de bizcocho' },
  ]

  City.quest = null   // recado activo: { giver, to, toRef, item, kind:'errand'|'photo', chain }
  City.recadosDone = 0
  City.keepsakes = []  // recuerdos coleccionados: [{ emoji, name, from }]
  City.photoWall = []  // muro del barrio: [{ from, to, hue, t }]
  try { City.recadosDone = parseInt(localStorage.getItem('miau_recados') || '0', 10) || 0 } catch (_) {}
  try { City.keepsakes = JSON.parse(localStorage.getItem('miau_keepsakes') || '[]') || [] } catch (_) {}
  try { City.photoWall = JSON.parse(localStorage.getItem('miau_photos') || '[]') || [] } catch (_) {}
  function saveKeepsakes () { try { localStorage.setItem('miau_keepsakes', JSON.stringify(City.keepsakes.slice(-60))) } catch (_) {} }
  function savePhotos () { try { localStorage.setItem('miau_photos', JSON.stringify(City.photoWall.slice(-60))) } catch (_) {} }
  function hashStr (s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

  // ¿Hay un vecino bajo este punto del mundo? (radio de click generoso)
  City.findNpcAt = function (x, y) {
    if (!City.npcs) return null
    let best = null, bestD = 32
    for (const n of City.npcs) {
      const d = Math.hypot(x - n.x, y - (n.y - 6))
      if (d < bestD) { best = n; bestD = d }
    }
    return best
  }

  // Genera el contenido de un recado nuevo: a quién y de qué tipo (mano/foto).
  function rollRecado (giverName) {
    const others = City.npcs.filter(n => n.name !== giverName)
    if (!others.length) return { to: null }
    const to = others[(Math.random() * others.length) | 0]
    const kind = Math.random() < 0.45 ? 'photo' : 'errand'
    const item = (kind === 'photo') ? { emoji: '📷', name: 'una foto' }
                                    : ITEMS[(Math.random() * ITEMS.length) | 0]
    return { to, kind, item }
  }

  // Cierra una entrega: cuenta el recado, cuelga la foto si tocaba, y o BIEN encadena
  // otro recado O BIEN te da el recuerdo del vecino. Devuelve { continued, gift, chain }.
  function completeRecado (recipientNpc, now) {
    const q = City.quest
    City.recadosDone++
    try { localStorage.setItem('miau_recados', String(City.recadosDone)) } catch (_) {}
    if (window.track) track('city:recado-done', { kind: q.kind, to: q.to, chain: q.chain || 1 })
    if (q.kind === 'photo') {
      City.photoWall.push({ from: q.giver, to: q.to, hue: hashStr(q.giver + q.to + City.photoWall.length) % 360, t: Date.now() })
      savePhotos()
    }
    const chain = q.chain || 1
    const others = City.npcs.filter(n => n.name !== recipientNpc.name)
    if (chain < 4 && others.length && Math.random() < 0.5) {     // sigue la cadena
      const r = rollRecado(recipientNpc.name)
      City.quest = { giver: recipientNpc.name, to: r.to.name, toRef: r.to, item: r.item, kind: r.kind, chain: chain + 1 }
      return { continued: true }
    }
    const gift = recipientNpc.gift || { emoji: '🎁', name: 'un detalle' }   // fin → recuerdo
    City.keepsakes.push({ emoji: gift.emoji, name: gift.name, from: recipientNpc.name })
    saveKeepsakes()
    City.quest = null
    return { continued: false, gift, chain }
  }

  // Aviso de recado: línea dorada en la ventana de chat (estilo RO); si la
  // ventana no está montada, City.notifyInChat cae solo al toast.
  function notify (msg, ms) {
    if (City.notifyInChat) City.notifyInChat(msg)
    else if (typeof showToast === 'function') showToast(msg, ms || 3000)
  }

  // Mensajería tras una entrega (say del vecino + avisos), común a mano y buzón.
  function announceDelivery (recipientNpc, r, now, prefixToast) {
    if (r.continued) {
      const q = City.quest
      const what = q.kind === 'photo' ? 'una foto' : 'esto'
      recipientNpc.say = { text: `¡gracias! oye, ¿y ${what} a ${q.to}?`, until: now + 3800 }
      if (prefixToast) notify(prefixToast, 1800)
      notify(`sigue la cadena 🔗 ${q.item.emoji} → ${q.to} (${q.toRef.near})`, 3200)
    } else {
      recipientNpc.say = { text: `¡gracias! toma, ${r.gift.emoji} de recuerdo`, until: now + 3600 }
      if (prefixToast) notify(prefixToast, 1800)
      notify(`${recipientNpc.name} te da ${r.gift.emoji} ${r.gift.name} · ${City.keepsakes.length} recuerdos`, 2800)
      if (r.chain >= 3) setTimeout(() => notify(`¡cadena de barrio de ${r.chain} paradas! 🎉`, 2600), 800)
    }
  }

  // Conversación con un vecino: dar recado / entregar (solo recados de mano) / recordar.
  City.talkToNpc = function (npc) {
    const now = performance.now()
    npc.pauseUntil = now + 1600
    const q = City.quest
    if (q && q.to === npc.name) {
      if (q.kind === 'photo') {                          // la foto va a su BUZÓN, no a la mano
        npc.say = { text: 'la foto, en mi buzón 📮 (ahí al lado)', until: now + 3200 }
        return
      }
      npc._heartUntil = now + 1700                       // entrega en mano
      const r = completeRecado(npc, now)
      announceDelivery(npc, r, now)
      return
    }
    if (q && q.giver === npc.name) {                     // recordatorio
      const dest = q.kind === 'photo' ? `el buzón de ${q.to}` : q.to
      npc.say = { text: `es para ${dest}, en ${q.toRef.near}`, until: now + 3400 }
      return
    }
    if (q) { npc.say = { text: '¿para mí? no, qué va 🐈', until: now + 2600 }; return }
    // sin recado → encarga uno nuevo (de mano o de foto)
    const r = rollRecado(npc.name)
    if (!r.to) { npc.say = { text: npc.lines[0], until: now + 2600 }; return }
    City.quest = { giver: npc.name, to: r.to.name, toRef: r.to, item: r.item, kind: r.kind, chain: 1 }
    if (r.kind === 'photo') {
      npc.say = { text: `¿le llevas una foto a ${r.to.name}?`, until: now + 3600 }
      notify(`📷 foto para ${r.to.name} → su buzón (${r.to.near})`, 3400)
    } else {
      npc.say = { text: `¿me llevas esto a ${r.to.name}?`, until: now + 3600 }
      notify(`${r.item.emoji} lleva ${r.item.name} a ${r.to.name} (${r.to.near})`, 3400)
    }
    if (window.track) track('city:recado-start', { from: npc.name, to: r.to.name, kind: r.kind })
  }

  // Entrega de FOTO en el buzón de un vecino.
  City.deliverToBuzon = function (owner) {
    const now = performance.now()
    const q = City.quest
    if (q && q.kind === 'photo' && q.to === owner.name) {
      owner.buzonFlash = now + 1600
      const r = completeRecado(owner, now)
      announceDelivery(owner, r, now, `foto colgada en el muro 📷 · ${City.photoWall.length} en el tablón`)
      return
    }
    if (q && q.kind === 'photo') {
      notify(`ese no es el buzón de ${q.to}`, 1800)
      return
    }
    notify(`el buzón de ${owner.name}`, 1400)
  }

  // Hit-testing de buzones y del tablón (coords de mundo).
  City.findBuzonAt = function (x, y) {
    if (!City.npcs) return null
    for (const n of City.npcs) {
      if (n.buzon && Math.hypot(x - n.buzon.x, y - (n.buzon.y - 14)) < 26) return n
    }
    return null
  }
  City.findTablonAt = function (x, y) {
    const t = City.tablon
    if (!t) return null
    return (Math.hypot(x - t.x, y - (t.y - 24)) < 42) ? t : null
  }

  // Banner del recado activo (espacio de PANTALLA — lo llama drawHud).
  City.drawQuestBanner = function (ctx, VW, VH) {
    const q = City.quest
    if (!q) return
    const chainTag = (q.chain && q.chain > 1) ? `  🔗${q.chain}` : ''
    const dest = q.kind === 'photo' ? `buzón de ${q.to}` : q.to
    const txt = `${q.item.emoji} ${q.item.name} → ${dest} · ${q.toRef.near}${chainTag}`
    ctx.font = '700 13px "Galmuri11", "Pixelify Sans", monospace'
    ctx.textBaseline = 'middle'
    const pad = 12, bw = ctx.measureText(txt).width + pad * 2, bh = 30
    const bx = VW - bw - 14, by = 14
    if (City.drawPanel) City.drawPanel(ctx, bx, by, bw, bh, 9)
    else { ctx.fillStyle = 'rgba(20,14,26,0.7)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill() }
    ctx.fillStyle = '#3a2a14'; ctx.textAlign = 'left'
    ctx.fillText(txt, bx + pad, by + bh / 2 + 1)
  }

  // Estantería de recuerdos (espacio de PANTALLA — lo llama drawHud). Cuenta cada
  // tipo de recuerdo coleccionado; se coloca bajo el banner si hay recado activo.
  City.drawKeepsakeShelf = function (ctx, VW, VH) {
    const ks = City.keepsakes
    if (!ks || !ks.length) return
    const idx = {}, tally = []
    for (const k of ks) {
      if (idx[k.emoji] == null) { idx[k.emoji] = tally.length; tally.push({ emoji: k.emoji, n: 0 }) }
      tally[idx[k.emoji]].n++
    }
    const txt = '🎁 ' + tally.map(t => t.emoji + (t.n > 1 ? '×' + t.n : '')).join(' ')
    ctx.font = '700 13px "Galmuri11", "Pixelify Sans", monospace'
    ctx.textBaseline = 'middle'
    const pad = 12, bw = ctx.measureText(txt).width + pad * 2, bh = 28
    const bx = VW - bw - 14
    const by = City.quest ? 14 + 30 + 8 : 14   // debajo del banner si hay recado
    if (City.drawPanel) City.drawPanel(ctx, bx, by, bw, bh, 8)
    ctx.fillStyle = '#3a2a14'; ctx.textAlign = 'left'
    ctx.fillText(txt, bx + pad, by + bh / 2 + 1)
  }

  // ── Buzón de un vecino (objeto fijo del mundo) ──
  City.drawBuzon = function (ctx, npc, now) {
    const b = npc.buzon
    const col = (typeof colorHex === 'function') ? colorHex(npc.color) : '#9a7'
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = 'rgba(40,25,15,0.25)'
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, 12, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(b.x - 2, b.y - 16, 4, 18)          // poste
    ctx.fillStyle = col                                                        // caja
    ctx.beginPath(); ctx.roundRect(b.x - 9, b.y - 30, 18, 15, 3); ctx.fill()
    ctx.strokeStyle = 'rgba(30,20,12,0.55)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(b.x - 9, b.y - 30, 18, 15, 3); ctx.stroke()
    ctx.fillStyle = 'rgba(20,14,8,0.5)'; ctx.fillRect(b.x - 5, b.y - 27, 10, 2) // ranura
    ctx.fillStyle = '#e0533c'; ctx.fillRect(b.x + 9, b.y - 30, 2, 7); ctx.fillRect(b.x + 9, b.y - 30, 6, 4) // banderita
    ctx.restore()
    const q = City.quest
    if (q && q.kind === 'photo' && q.to === npc.name) {        // destino de una foto
      const pulse = (Math.sin(now / 300) + 1) * 0.5
      ctx.save()
      ctx.strokeStyle = `rgba(255,205,90,${0.42 + pulse * 0.36})`; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(b.x, b.y - 18, 22, 0, Math.PI * 2); ctx.stroke()
      ctx.font = '20px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('📮', b.x, b.y - 40 + Math.sin(now / 400) * 3)
      ctx.restore()
    }
    if (npc.buzonFlash > now) {                                // pop al recibir
      const t = (npc.buzonFlash - now) / 1600
      ctx.save(); ctx.globalAlpha = t
      ctx.font = '18px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('📷', b.x, b.y - 38 - (1 - t) * 16)
      ctx.restore()
    }
  }

  // ── Tablón del barrio (muro de fotos) ──
  City.drawTablon = function (ctx, x, y, now) {
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = 'rgba(40,25,15,0.28)'
    ctx.beginPath(); ctx.ellipse(x, y + 4, 34, 8, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 30, y - 6, 4, 14); ctx.fillRect(x + 26, y - 6, 4, 14)
    const bw = 72, bh = 50, bx = x - bw / 2, by = y - 56
    ctx.fillStyle = '#c79a5b'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill()
    ctx.strokeStyle = '#7a5a2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.stroke()
    const photos = City.photoWall || []
    const shown = photos.slice(-6)
    for (let i = 0; i < shown.length; i++) {
      const p = shown[i]
      const px = bx + 8 + (i % 3) * 22, py = by + 8 + ((i / 3) | 0) * 21
      ctx.save(); ctx.translate(px + 8, py + 8); ctx.rotate(((hashStr(p.from + p.to + i) % 7) - 3) * 0.04); ctx.translate(-8, -8)
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 16, 17)
      ctx.fillStyle = `hsl(${p.hue},55%,68%)`; ctx.fillRect(1.5, 1.5, 13, 11)
      ctx.restore()
    }
    ctx.font = '700 11px "Galmuri11", "Pixelify Sans", monospace'; ctx.textAlign = 'center'
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.fillStyle = '#fff4d8'
    const lbl = `📷 ${photos.length}`
    ctx.strokeText(lbl, x, by - 4); ctx.fillText(lbl, x, by - 4)
    ctx.restore()
  }

  // ── Muro de fotos (panel DOM) ──
  function escapeHtml (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
  City.openPhotoWall = function () {
    let el = document.getElementById('photoWall')
    if (!el) { el = document.createElement('div'); el.id = 'photoWall'; el.className = 'photo-wall'; document.body.appendChild(el) }
    const photos = (City.photoWall || []).slice().reverse()
    const cards = photos.length
      ? photos.map(p => `<figure class="pw-card"><div class="pw-img" style="background:hsl(${p.hue},55%,70%)">📷</div><figcaption>de ${escapeHtml(p.from)} · para ${escapeHtml(p.to)}</figcaption></figure>`).join('')
      : `<p class="pw-empty">aún no hay fotos. acepta un recado de foto 📷 y llévala al buzón del vecino 📮</p>`
    el.innerHTML = `
      <div class="pw-backdrop"></div>
      <div class="pw-panel">
        <header class="pw-head">
          <span class="pw-title">Muro de fotos del barrio</span>
          <span class="pw-count">${photos.length} foto${photos.length === 1 ? '' : 's'}</span>
          <button class="pw-close" aria-label="cerrar">×</button>
        </header>
        <div class="pw-grid">${cards}</div>
        <p class="pw-note">aquí irán tus fotos cuadradas de verdad ✨</p>
      </div>`
    el.hidden = false
    const close = () => City.closePhotoWall()
    el.querySelector('.pw-backdrop').onclick = close
    el.querySelector('.pw-close').onclick = close
  }
  City.closePhotoWall = function () { const el = document.getElementById('photoWall'); if (el) el.hidden = true }

  // Dibujo (encolado en el y-sort por city.render.js como kind:'npc').
  City.drawNpc = function (ctx, npc, now) {
    const bob = npc.walking ? Math.sin(now / 110 + npc.phase) * 2 : Math.sin(now / 650 + npc.phase) * 1.2
    // sombra
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath(); ctx.ellipse(npc.x, npc.y + PS / 2 - 6, 13, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // sprite (espejo según dirección, igual que drawPlayer)
    if (npc.sprite) {
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.globalAlpha = 0.97
      if (npc.dir === 1) {
        ctx.translate(npc.x + PS / 2, 0); ctx.scale(-1, 1)
        ctx.drawImage(npc.sprite, 4, npc.y - PS / 2 + bob + 4, PS - 8, PS - 8)
      } else {
        ctx.drawImage(npc.sprite, npc.x - PS / 2 + 4, npc.y - PS / 2 + bob + 4, PS - 8, PS - 8)
      }
      ctx.restore()
    } else {
      ctx.fillStyle = (typeof colorHex === 'function') ? colorHex(npc.color) : '#caa'
      ctx.beginPath(); ctx.arc(npc.x, npc.y + bob, 14, 0, Math.PI * 2); ctx.fill()
    }
    // nombre (con marca de "vecino" — más tenue que un jugador real)
    ctx.save()
    ctx.font = '600 11px "Galmuri11", "Pixelify Sans", monospace'
    ctx.textAlign = 'center'
    ctx.lineWidth = 3; ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.fillStyle = (typeof colorHex === 'function') ? colorHex(npc.color) : '#fff'
    ctx.globalAlpha = 0.9
    ctx.strokeText(npc.name, npc.x, npc.y - PS / 2 - 2)
    ctx.fillText(npc.name, npc.x, npc.y - PS / 2 - 2)
    ctx.restore()
    // ── marcadores de recado ──
    const q = City.quest
    const talking = npc.say && npc.say.until > now
    const markY = npc.y - PS / 2 - 16 + Math.sin(now / 400 + npc.phase) * 3
    if (q && q.kind !== 'photo' && q.to === npc.name) {
      // destinatario (recado de mano): anillo dorado pulsante + sobre flotante
      const pulse = (Math.sin(now / 300) + 1) * 0.5
      ctx.save()
      ctx.strokeStyle = `rgba(255,205,90,${0.42 + pulse * 0.36})`; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(npc.x, npc.y, PS / 2 + 2, 0, Math.PI * 2); ctx.stroke()
      if (!talking) {
        ctx.font = '22px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('📨', npc.x, markY)
      }
      ctx.restore()
    } else if (!q && !talking && City.player &&
               Math.hypot(npc.x - City.player.x, npc.y - City.player.y) < 380) {
      // posible dador cercano: pista suave de "háblame"
      ctx.save()
      ctx.globalAlpha = 0.45 + (Math.sin(now / 500 + npc.phase) + 1) * 0.16
      ctx.font = '15px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('💬', npc.x + 13, markY)
      ctx.restore()
    }
    // corazón de agradecimiento (al entregar)
    if (npc._heartUntil > now) {
      const t = (npc._heartUntil - now) / 1700
      ctx.save(); ctx.globalAlpha = t
      ctx.font = '20px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('💗', npc.x + 14, npc.y - PS / 2 - 10 - (1 - t) * 22)
      ctx.restore()
    }
    // burbuja ambiental (reusa el pergamino RO de city.render.entities.js)
    if (npc.say && npc.say.until > now && City.drawSpeechBubble) {
      const left = npc.say.until - now
      const a = left > 400 ? 1 : left / 400
      City.drawSpeechBubble(ctx, npc.x, npc.y - PS / 2 - 12, npc.say.text, a)
    }
  }
})()

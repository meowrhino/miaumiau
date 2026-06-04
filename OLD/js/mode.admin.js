// ─── Admin Mode (owner-only dashboard at /admin) ───
// Renders stats from /api/admin/stats: counts, section views, zone heatmap, hourly histogram.
// Server-side gate: only the account_name 'manu' can hit the endpoint.
;(function () {
  Object.assign(App, {
    async enter_admin() {
      const root = document.getElementById('adminContent')
      if (!root) return
      // Quick client-side gate (server still re-checks)
      const adminAccounts = ['manu']
      const ok = App.user && (adminAccounts.includes(App.user.account_name) || adminAccounts.includes(App.user.username))
      if (!ok) {
        root.innerHTML = `<div class="admin-block"><h2>403</h2><p class="muted">solo manu ve esto.</p></div>`
        return
      }
      root.innerHTML = `<div class="loading">cargando stats</div>`
      try {
        const data = await API.get('/admin/stats')
        root.innerHTML = App._renderAdmin(data)
        // Draw the heatmap canvas overlaid on the city map
        App._drawHeatmap(data.zoneEntries || [])
        // Wire the events admin section (CRUD for /api/admin/events)
        App._wireAdminEvents()
      } catch (e) {
        root.innerHTML = `<div class="admin-block error">error: ${esc(e.message || 'fallo')}</div>`
      }
    },

    // Sesión 12: events CRUD inside /admin
    async _wireAdminEvents() {
      const form = document.getElementById('adminEventForm')
      if (!form) return
      form.onsubmit = async (e) => {
        e.preventDefault()
        const id    = form.dataset.editing || ''
        const date  = document.getElementById('adminEvDate').value
        const title = document.getElementById('adminEvTitle').value.trim()
        const desc  = document.getElementById('adminEvDesc').value.trim()
        const emoji = document.getElementById('adminEvEmoji').value.trim() || '📅'
        if (!date || !title) { showToast('faltan fecha o título'); return }
        try {
          if (id) await API.put('/admin/events/' + id, { date, title, desc, emoji })
          else    await API.post('/admin/events', { date, title, desc, emoji })
          form.reset()
          form.dataset.editing = ''
          document.getElementById('adminEvSubmit').textContent = 'añadir evento'
          await App._reloadAdminEvents()
          if (window.Events) Events.load(true)  // invalidate cached list
        } catch (err) { showToast(err.message) }
      }
      document.getElementById('adminEvCancel').onclick = () => {
        form.reset()
        form.dataset.editing = ''
        document.getElementById('adminEvSubmit').textContent = 'añadir evento'
      }
      App._reloadAdminEvents()
    },

    async _reloadAdminEvents() {
      const list = document.getElementById('adminEventList')
      if (!list) return
      try {
        const rows = await API.get('/admin/events')
        if (!rows.length) {
          list.innerHTML = `<p class="muted">no hay eventos en la base. añade uno arriba.</p>`
          return
        }
        list.innerHTML = rows.map(r => `
          <div class="admin-event-row">
            <span class="admin-event-emoji">${esc(r.emoji || '📅')}</span>
            <div class="admin-event-body">
              <span class="admin-event-title">${esc(r.title)}</span>
              <span class="admin-event-meta">${esc(r.date)}${r.desc ? ' · ' + esc(r.desc) : ''}</span>
            </div>
            <button class="btn small" data-edit="${r.id}">editar</button>
            <button class="btn small danger" data-del="${r.id}">borrar</button>
          </div>
        `).join('')
        list.querySelectorAll('[data-edit]').forEach(b => {
          b.onclick = () => {
            const r = rows.find(x => x.id === Number(b.dataset.edit))
            if (!r) return
            const f = document.getElementById('adminEventForm')
            f.dataset.editing = String(r.id)
            document.getElementById('adminEvDate').value  = r.date
            document.getElementById('adminEvTitle').value = r.title
            document.getElementById('adminEvDesc').value  = r.desc || ''
            document.getElementById('adminEvEmoji').value = r.emoji || '📅'
            document.getElementById('adminEvSubmit').textContent = 'guardar cambios'
            f.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
        list.querySelectorAll('[data-del]').forEach(b => {
          b.onclick = async () => {
            if (!confirm('¿borrar este evento?')) return
            try {
              await API.del('/admin/events/' + b.dataset.del)
              await App._reloadAdminEvents()
              if (window.Events) Events.load(true)
            } catch (e) { showToast(e.message) }
          }
        })
      } catch (e) {
        list.innerHTML = `<p class="error">${esc(e.message)}</p>`
      }
    },

    _renderAdmin(data) {
      const c = data.counts || {}
      const counts = [
        { label: 'usuarios',          v: c.users },
        { label: 'activos 7d',        v: c.active7 },
        { label: 'activos 30d',       v: c.active30 },
        { label: 'miaus',             v: c.tweets },
        { label: 'posts',             v: c.posts },
        { label: 'miau real',         v: c.bereals },
        { label: 'mensajes',          v: c.messages },
      ]
      // Section views bars (last 7d)
      const views = (data.sectionViews || []).filter(s => s.section)
      const maxV = Math.max(1, ...views.map(s => s.c))
      const viewBars = views.map(s => `
        <div class="admin-bar-row">
          <span class="admin-bar-label">${esc(s.section)}</span>
          <div class="admin-bar"><div class="admin-bar-fill" style="width:${(s.c/maxV*100).toFixed(0)}%"></div></div>
          <span class="admin-bar-count">${s.c}</span>
        </div>`).join('')
      // Hourly histogram (24 bars)
      const hourly = Array.from({ length: 24 }, (_, h) => {
        const row = (data.hourly || []).find(x => x.hour === h)
        return row ? row.c : 0
      })
      const maxH = Math.max(1, ...hourly)
      const hourBars = hourly.map((c, h) => `
        <div class="admin-hour-bar" title="${h}h: ${c}">
          <div style="height:${(c/maxH*100).toFixed(0)}%"></div>
          <span>${h}</span>
        </div>`).join('')

      return `
        <div class="admin-grid">
          ${counts.map(k => `
            <div class="admin-stat">
              <span class="admin-stat-value">${k.v ?? 0}</span>
              <span class="admin-stat-label">${k.label}</span>
            </div>`).join('')}
        </div>

        <div class="admin-block">
          <h2>secciones más vistas (7d)</h2>
          ${viewBars || '<p class="muted">sin datos aún</p>'}
        </div>

        <div class="admin-block">
          <h2>actividad por hora (7d)</h2>
          <div class="admin-hours">${hourBars}</div>
        </div>

        <div class="admin-block">
          <h2>heatmap del pueblo (7d)</h2>
          <p class="muted" style="margin-bottom:8px">qué zonas se llenan más.</p>
          <div class="admin-heatmap-wrap">
            <canvas id="adminHeatmap" width="640" height="360"></canvas>
          </div>
        </div>

        <div class="admin-block">
          <h2>eventos del calendario</h2>
          <p class="muted" style="margin-bottom:10px">añade, edita o borra eventos sin tocar el JSON.</p>
          <form id="adminEventForm" class="admin-event-form" autocomplete="off">
            <div class="admin-event-fields">
              <input id="adminEvDate"  type="date" required>
              <input id="adminEvEmoji" type="text" maxlength="4" placeholder="📅" value="📅" style="width:70px">
              <input id="adminEvTitle" type="text" maxlength="80" placeholder="título" required>
            </div>
            <input id="adminEvDesc" type="text" maxlength="240" placeholder="descripción (opcional)">
            <div class="admin-event-actions">
              <button id="adminEvSubmit" type="submit" class="btn primary small">añadir evento</button>
              <button id="adminEvCancel" type="button" class="btn small">cancelar</button>
            </div>
          </form>
          <div id="adminEventList" class="admin-event-list">
            <p class="muted">cargando…</p>
          </div>
        </div>
      `
    },

    // City heatmap: same 6 zones as city.js, opacity + warm overlay scaled by entries
    _drawHeatmap(zoneEntries) {
      const canvas = document.getElementById('adminHeatmap')
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      // Zone layout normalized to 640x360 (half of city's 1280x720)
      const zones = [
        { id:'tweets',  x:55, y:60,  w:160, h:100, name:'café',     color:'#f0a85a' },
        { id:'posts',   x:240,y:30,  w:160, h:100, name:'tablón',   color:'#5fa3d8' },
        { id:'stories', x:425,y:60,  w:160, h:100, name:'miradero', color:'#7a3a8e' },
        { id:'chat',    x:55, y:210, w:160, h:100, name:'banquito', color:'#4abd76' },
        { id:'bereal',  x:240,y:230, w:160, h:100, name:'polaroid', color:'#ff8a3c' },
        { id:'profile', x:425,y:210, w:160, h:100, name:'tu casa',  color:'#a87dd8' },
      ]
      const counts = {}
      zoneEntries.forEach(z => { if (z.zone) counts[z.zone] = z.c })
      const max = Math.max(1, ...Object.values(counts))

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#aed6e8')
      grad.addColorStop(0.7, '#f0c89a')
      grad.addColorStop(1, '#c98564')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      zones.forEach(z => {
        const c = counts[z.id] || 0
        const heat = c / max  // 0–1
        ctx.save()
        // Base zone tint
        ctx.fillStyle = `${z.color}33`
        ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 14); ctx.fill()
        ctx.strokeStyle = `${z.color}aa`
        ctx.lineWidth = 2; ctx.stroke()
        // Heat overlay
        if (heat > 0) {
          ctx.fillStyle = `rgba(255, 60, 40, ${0.15 + heat * 0.55})`
          ctx.fill()
        }
        // Label
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'
        ctx.lineWidth = 3; ctx.lineJoin = 'round'
        ctx.font = '700 14px "Pixelify Sans", monospace'
        ctx.textAlign = 'center'
        ctx.strokeText(z.name, z.x + z.w/2, z.y + z.h/2 - 4)
        ctx.fillText(z.name, z.x + z.w/2, z.y + z.h/2 - 4)
        // Count
        ctx.font = '600 12px "Inter", sans-serif'
        ctx.strokeText(c + ' visitas', z.x + z.w/2, z.y + z.h/2 + 14)
        ctx.fillText(c + ' visitas', z.x + z.w/2, z.y + z.h/2 + 14)
        ctx.restore()
      })
    },
  })
})()

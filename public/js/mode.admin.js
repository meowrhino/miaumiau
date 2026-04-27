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
      } catch (e) {
        root.innerHTML = `<div class="admin-block error">error: ${esc(e.message || 'fallo')}</div>`
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

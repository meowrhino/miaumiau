// ─── BeReal Mode ───
Object.assign(App, {
  _berealBlob: null,

  enter_bereal() {
    App.loadBereals()
  },

  async loadBereals() {
    try {
      const bereals = await API.get('/bereal?limit=20')
      const grid = $('#berealGrid')
      grid.innerHTML = ''

      if (bereals.length === 0) {
        grid.innerHTML = '<div class="empty"><div class="empty-icon">📸</div><p>nadie ha publicado su miau real hoy.<br>se el primero!</p></div>'
        return
      }

      bereals.forEach(b => App.renderBereal(b, grid))
    } catch (e) { showToast(e.message) }
  },

  renderBereal(bereal, container) {
    const el = document.createElement('div')
    el.className = 'bereal-card'

    // Format time as HH:MM
    const d = new Date(bereal.created_at + 'Z')
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    const timeStr = hours + ':' + mins

    // Is it today?
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    const dateLabel = isToday ? 'hoy a las ' + timeStr : timeAgo(bereal.created_at)

    const hex = colorHex(bereal.color)
    el.innerHTML = `
      <div class="bereal-card-header">
        <img class="avatar" src="${App.avatarUrl(bereal.user_id)}" loading="lazy"
             style="border-color:${hex};box-shadow:0 0 0 2px color-mix(in srgb, ${hex} 18%, transparent)">
        <a class="bereal-card-name display" href="/u/${encodeURIComponent(bereal.username)}" style="color:${hex}">${esc(bereal.username)}</a>
        <span class="bereal-card-time">${dateLabel}</span>
      </div>
      <img class="bereal-card-image" src="/media/bereal/${bereal.media_key}" loading="lazy" alt="">
      ${bereal.caption ? `<p class="bereal-card-caption">${esc(bereal.caption)}</p>` : ''}`
    container.appendChild(el)
  },

  openBerealCapture() {
    App._berealBlob = null
    $('#berealPreview').hidden = true
    $('#berealCaption').value = ''
    $('#berealFile').value = ''
    $('#berealModal').hidden = false
    const dz = $('#berealDropZone'); if (dz) dz.classList.remove('has-file')
    const hint = $('#berealDropHint'); if (hint) hint.textContent = 'o sube una desde el rollo'

    $('#berealFile').onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const blob = await compressImage(file, 'post')
        App._berealBlob = blob
        $('#berealPreview').src = URL.createObjectURL(blob)
        $('#berealPreview').hidden = false
        if (dz) dz.classList.add('has-file')
        if (hint) hint.textContent = 'foto lista · ' + (file.name || '').slice(0, 40)
      } catch (err) { showToast('error: ' + err.message) }
    }
  },

  async submitBereal() {
    if (!App._berealBlob) { showToast('saca una foto primero!'); return }
    const caption = $('#berealCaption').value.trim()
    const fd = new FormData()
    fd.append('image', App._berealBlob, 'miaureal.webp')
    fd.append('caption', caption)
    try {
      await API.upload('/bereal', fd)
      $('#berealModal').hidden = true
      App.loadBereals()
      showToast('miau real publicado!')
    } catch (e) { showToast(e.message) }
  }
})

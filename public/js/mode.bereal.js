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
    el.innerHTML = `
      <div class="bereal-card-header">
        <img class="avatar" src="${App.avatarUrl(bereal.user_id)}" loading="lazy">
        <span class="bereal-card-name" style="color:${colorHex(bereal.color)}">${esc(bereal.username)}</span>
        <span class="bereal-card-time">${timeAgo(bereal.created_at)}</span>
      </div>
      <img class="bereal-card-image" src="/media/bereal/${bereal.media_key}" loading="lazy" alt=""
           onerror="this.style.background='var(--accent-soft)';this.style.minHeight='200px'">
      ${bereal.caption ? `<p class="bereal-card-caption">${esc(bereal.caption)}</p>` : ''}`
    container.appendChild(el)
  },

  openBerealCapture() {
    App._berealBlob = null
    $('#berealPreview').hidden = true
    $('#berealCaption').value = ''
    $('#berealFile').value = ''
    $('#berealModal').hidden = false

    $('#berealFile').onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const blob = await compressImage(file, 'post')
        App._berealBlob = blob
        $('#berealPreview').src = URL.createObjectURL(blob)
        $('#berealPreview').hidden = false
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

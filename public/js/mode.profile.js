// ─── Profile Mode (5th tab) ───
Object.assign(App, {
  _searchTimeout: null,

  enter_profile() {
    if (!App.user) return

    // Load friends
    App.loadFriends()

    // Render avatar
    const preview = document.getElementById('profileAvatar')
    preview.innerHTML = generateCatSvg(App.user.avatar_seed, App.user.color)

    // Name
    document.getElementById('profileName').textContent = App.user.username

    // Bio
    document.getElementById('profileBio').value = App.user.bio ?? ''

    // Key
    document.getElementById('profileKey').textContent = App.user.username + '#' + App.user.secret

    // Color grid
    App._profileColor = App.user.color
    renderColorGrid(document.getElementById('profileColorGrid'), App.user.color, c => {
      App._profileColor = c
      preview.innerHTML = generateCatSvg(App.user.avatar_seed, c)
      preview.classList.remove('pop')
      void preview.offsetWidth
      preview.classList.add('pop')
    })

    // Theme buttons
    App._updateThemeButtons()
  },

  rerollProfileAvatar() {
    App.user.avatar_seed = Math.floor(Math.random() * 0xFFFFFFFF)
    const preview = document.getElementById('profileAvatar')
    preview.innerHTML = generateCatSvg(App.user.avatar_seed, App._profileColor ?? App.user.color)
    preview.classList.remove('pop')
    void preview.offsetWidth
    preview.classList.add('pop')
  },

  async saveProfile() {
    const bio = document.getElementById('profileBio').value.trim()
    try {
      const updated = await API.put('/users/' + App.user.id, {
        color: App._profileColor ?? App.user.color,
        theme: App.user.theme ?? 'light',
        bio: bio
      })
      App.user = { ...App.user, ...updated }
      App.save()
      App.bumpAvatarVersion()
      App.updateHeader()
      showToast('guardado')
    } catch (e) { showToast(e.message) }
  },

  copyKey() {
    const key = App.user.username + '#' + App.user.secret
    navigator.clipboard.writeText(key).then(() => {
      showToast('clave copiada')
    }).catch(() => {
      prompt('tu clave:', key)
    })
  },

  async changeKey() {
    const input = document.getElementById('profileNewKey')
    const newKey = input.value.trim()
    if (newKey.length < 4) { showToast('minimo 4 caracteres'); return }
    if (newKey.length > 32) { showToast('maximo 32 caracteres'); return }

    try {
      // Server needs a new endpoint to change tripcode
      await API.post('/users/' + App.user.id + '/key', { new_secret: newKey })
      App.user.secret = newKey
      App.save()
      document.getElementById('profileKey').textContent = App.user.username + '#' + newKey
      input.value = ''
      showToast('clave cambiada a: ' + App.user.username + '#' + newKey)
    } catch (e) { showToast(e.message) }
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '')
    localStorage.setItem('miau_theme', theme)
    App._updateThemeIcon()
    App._updateThemeButtons()
  },

  _updateThemeButtons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const btnLight = document.getElementById('btnLight')
    const btnDark = document.getElementById('btnDark')
    if (btnLight) {
      btnLight.classList.toggle('active', !isDark)
      btnDark.classList.toggle('active', isDark)
    }
  },

  // ─── Friends ───
  async loadFriends() {
    try {
      const data = await API.get('/friends')
      App._friends = data.friends
      App._friendIds = new Set(data.friends.map(f => f.id))

      // Render pending requests
      const pendingEl = $('#friendPending')
      pendingEl.innerHTML = ''
      if (data.pending.length > 0) {
        const title = document.createElement('p')
        title.className = 'friends-pending-title'
        title.textContent = `${data.pending.length} solicitud${data.pending.length > 1 ? 'es' : ''}`
        pendingEl.appendChild(title)
        data.pending.forEach(p => {
          const el = document.createElement('div')
          el.className = 'friend-row'
          el.innerHTML = `
            <img class="avatar" src="${App.avatarUrl(p.id)}">
            <span class="friend-name" style="color:${colorHex(p.color)}">${esc(p.username)}</span>
            <button class="btn small primary" onclick="App.acceptFriend(${p.request_id})">aceptar</button>
            <button class="btn small" onclick="App.rejectFriend(${p.request_id})">rechazar</button>`
          pendingEl.appendChild(el)
        })
      }

      // Render friend list
      const listEl = $('#friendList')
      listEl.innerHTML = ''
      if (data.friends.length === 0) {
        listEl.innerHTML = '<p class="muted" style="font-size:0.8rem">aun no tienes amigos. busca gatos arriba!</p>'
        return
      }
      data.friends.forEach(f => {
        const el = document.createElement('div')
        el.className = 'friend-row'
        el.innerHTML = `
          <img class="avatar" src="${App.avatarUrl(f.id)}">
          <span class="friend-name" style="color:${colorHex(f.color)}">${esc(f.username)}</span>
          <span class="muted" style="font-size:0.7rem;flex:1">${f.bio || ''}</span>
          <button class="btn small" onclick="App.unfriend(${f.id},'${esc(f.username)}')" title="quitar amigo">x</button>`
        listEl.appendChild(el)
      })
    } catch (e) { console.error(e) }
  },

  searchUsers(query) {
    clearTimeout(App._searchTimeout)
    const results = $('#friendSearchResults')
    if (!query || query.length < 1) { results.innerHTML = ''; return }
    App._searchTimeout = setTimeout(async () => {
      try {
        const users = await API.get('/users/search?q=' + encodeURIComponent(query))
        results.innerHTML = ''
        users.filter(u => u.id !== App.user.id).forEach(u => {
          const isFriend = App._friendIds?.has(u.id)
          const el = document.createElement('div')
          el.className = 'friend-row'
          el.innerHTML = `
            <img class="avatar" src="${App.avatarUrl(u.id)}">
            <span class="friend-name" style="color:${colorHex(u.color)}">${esc(u.username)}</span>
            ${isFriend
              ? '<span class="muted" style="font-size:0.7rem">ya sois amigos</span>'
              : `<button class="btn small primary" onclick="App.addFriend(${u.id})">+ amigo</button>`
            }`
          results.appendChild(el)
        })
      } catch (e) { console.error(e) }
    }, 300)
  },

  async addFriend(userId) {
    try {
      await API.post('/friends/request/' + userId)
      showToast('solicitud enviada!')
      $('#friendSearch').value = ''
      $('#friendSearchResults').innerHTML = ''
    } catch (e) { showToast(e.message) }
  },

  async acceptFriend(requestId) {
    try {
      await API.post('/friends/accept/' + requestId)
      showToast('amigo aceptado!')
      App.loadFriends()
    } catch (e) { showToast(e.message) }
  },

  async unfriend(userId, username) {
    if (!confirm('quitar a ' + username + ' de amigos?')) return
    try {
      await API.del('/friends/' + userId)
      showToast(username + ' eliminado de amigos')
      App.loadFriends()
    } catch (e) { showToast(e.message) }
  },

  async rejectFriend(requestId) {
    try {
      await API.post('/friends/reject/' + requestId)
      App.loadFriends()
    } catch (e) { showToast(e.message) }
  }
})

// ─── Profile Mode (5th tab) ───
Object.assign(App, {
  enter_profile() {
    if (!App.user) return

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
  }
})

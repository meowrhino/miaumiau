// ─── Core App ───
const App = {
  user: null,
  mode: null,

  init() {
    // Apply saved theme (light/dark)
    const savedTheme = localStorage.getItem('miau_theme') ?? 'light'
    document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : '')
    App._updateThemeIcon()

    const saved = localStorage.getItem('miau_user')
    if (saved) {
      App.user = JSON.parse(saved)
      App.updateHeader()
      App.go('tweets')
    } else {
      App.showRegistration()
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? '' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('miau_theme', next || 'light')
    App._updateThemeIcon()
  },

  _updateThemeIcon() {
    const btn = document.getElementById('themeToggle')
    if (!btn) return
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    btn.textContent = isDark ? '☀' : '☾'
  },

  save() {
    localStorage.setItem('miau_user', JSON.stringify(App.user))
  },

  // ─── Navigation ───
  go(mode) {
    document.querySelectorAll('.mode').forEach(s => s.hidden = true)
    const el = document.getElementById('mode-' + mode)
    if (el) {
      el.hidden = false
      App.mode = mode
      if (App['enter_' + mode]) App['enter_' + mode]()
    }
    // update nav
    document.querySelectorAll('#bottomNav button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode)
    })
    document.getElementById('bottomNav').hidden = false
    // update pop color
    const popMap = { stories: 'var(--pop-stories)', posts: 'var(--pop-posts)', tweets: 'var(--pop-tweets)', chat: 'var(--pop-chat)', profile: 'var(--text)' }
    document.documentElement.style.setProperty('--pop', popMap[mode] ?? 'var(--text)')
  },

  updateHeader() {
    if (!App.user) return
    // Update composer avatar
    const composerAvatar = document.getElementById('composerAvatar')
    if (composerAvatar) composerAvatar.src = '/api/users/' + App.user.id + '/avatar.svg'
  },

  // ─── Registration ───
  showRegistration() {
    document.querySelectorAll('.mode').forEach(s => s.hidden = true)
    document.getElementById('registration').hidden = false
    document.getElementById('bottomNav').hidden = true
    // header removed

    App._regColor = 'Coral'
    App._regSeed = Math.floor(Math.random() * 0xFFFFFFFF)
    renderColorGrid(document.getElementById('regColorGrid'), 'Coral', c => {
      App._regColor = c
      App.updateRegPreview()
    })
    App.updateRegPreview()
  },

  rerollAvatar() {
    App._regSeed = Math.floor(Math.random() * 0xFFFFFFFF)
    App.updateRegPreview()
  },

  updateRegPreview() {
    const preview = document.getElementById('regAvatarPreview')
    const glow = document.getElementById('regAvatarGlow')
    const svg = generateCatSvg(App._regSeed, App._regColor)
    preview.innerHTML = svg
    if (glow) glow.style.background = colorHex(App._regColor)
    // animate on change
    preview.classList.remove('pop')
    void preview.offsetWidth
    preview.classList.add('pop')
  },

  async register() {
    const name = document.getElementById('regName').value.trim()
    const errEl = document.getElementById('regError')
    errEl.hidden = true

    if (!name || name.length < 1 || name.length > 25) {
      errEl.textContent = 'nombre: 1-25 caracteres'
      errEl.hidden = false
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      errEl.textContent = 'solo letras, numeros, _ y -'
      errEl.hidden = false
      return
    }

    const secret = crypto.randomUUID().slice(0, 12)
    const seed = App._regSeed

    try {
      const user = await API.post('/users', {
        username: name,
        secret: secret,
        color: App._regColor,
        avatar_seed: seed
      })
      App.user = { ...user, secret }
      App.save()
      applyTheme('oscuro')
      App.updateHeader()
      App.go('tweets')
      showToast('tu clave: ' + name + '#' + secret + ' — guardala!', 10000)
    } catch (e) {
      errEl.textContent = e.message
      errEl.hidden = false
    }
  },

  showLogin() {
    document.querySelectorAll('.mode').forEach(s => s.hidden = true)
    document.getElementById('login').hidden = false
    document.getElementById('bottomNav').hidden = true
    // header removed
  },

  async login() {
    const key = document.getElementById('loginKey').value.trim()
    const errEl = document.getElementById('loginError')
    errEl.hidden = true

    const i = key.indexOf('#')
    if (i < 1) { errEl.textContent = 'formato: usuario#clave'; errEl.hidden = false; return }

    const username = key.slice(0, i)
    const secret = key.slice(i + 1)

    // test auth by trying to get user list with this credential
    App.user = { username, secret, id: 0 }
    try {
      const data = await API.get('/users')
      const me = data.users.find(u => u.username === username)
      if (!me) throw new Error('usuario no encontrado')
      App.user = { ...me, secret }
      App.save()
      applyTheme(App.user.theme ?? 'oscuro')
      App.updateHeader()
      App.go('tweets')
    } catch (e) {
      App.user = null
      errEl.textContent = e.message
      errEl.hidden = false
    }
  },

  // ─── Settings ───
  openSettings() {
    const modal = document.getElementById('settingsModal')
    modal.hidden = false
    App._settingsColor = App.user.color
    App._settingsTheme = App.user.theme ?? 'oscuro'
    renderColorGrid(document.getElementById('settingsColorGrid'), App.user.color, c => {
      App._settingsColor = c
    })
    renderThemeGrid(document.getElementById('settingsThemeGrid'), App._settingsTheme, t => {
      App._settingsTheme = t
      applyTheme(t)
    })
    document.getElementById('settingsBio').value = App.user.bio ?? ''
  },

  closeSettings() {
    document.getElementById('settingsModal').hidden = true
    applyTheme(App.user.theme ?? 'oscuro')
  },

  async saveSettings() {
    try {
      const updated = await API.put('/users/' + App.user.id, {
        color: App._settingsColor,
        theme: App._settingsTheme,
        bio: document.getElementById('settingsBio').value.trim()
      })
      App.user = { ...App.user, ...updated }
      App.save()
      applyTheme(App.user.theme)
      App.updateHeader()
      App.closeSettings()
      showToast('guardado')
    } catch (e) {
      showToast(e.message)
    }
  },

  async deleteAccount() {
    if (!confirm('seguro que quieres eliminar tu cuenta? esto no se puede deshacer.')) return
    try {
      await API.del('/users/' + App.user.id)
      localStorage.removeItem('miau_user')
      App.user = null
      App.showRegistration()
      showToast('cuenta eliminada')
    } catch (e) {
      showToast(e.message)
    }
  },

  // ─── Shared Render Helpers ───
  renderHeader(item) {
    return `<img class="avatar" src="/api/users/${item.user_id}/avatar.svg" loading="lazy">
      <div class="item-header">
        <b style="color:${colorHex(item.color)}">${item.username}</b>
        <small class="muted">${timeAgo(item.created_at)}</small>
      </div>`
  }
}

// ─── Utils ───
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = s => s.replace(/[&<>"']/g, c => ESC_MAP[c])

const URL_RE = /https?:\/\/[^\s<]+/g
const linkify = s => s.replace(URL_RE, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return Math.floor(diff / 60) + 'm'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  if (diff < 604800) return Math.floor(diff / 86400) + 'd'
  const d = new Date(dateStr + 'Z')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return d.getDate() + ' ' + months[d.getMonth()]
}

const $ = sel => document.querySelector(sel)
const $$ = sel => document.querySelectorAll(sel)

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => App.init())

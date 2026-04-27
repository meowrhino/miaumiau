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
    }

    // Public page (/u/:username, /p/:id, /t/:id) — render read-only, no login required
    if (window.__PUBLIC_CONTEXT__) {
      document.querySelectorAll('.mode').forEach(s => s.hidden = true)
      document.getElementById('mode-public').hidden = false
      const banner = document.getElementById('modeBanner'); if (banner) banner.hidden = true
      App.mode = 'public'
      App.enter_public()
      return
    }

    if (App.user) App.go('tweets')
    else App.showRegistration()
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
      App._renderBanner(mode)
      if (App['enter_' + mode]) App['enter_' + mode]()
    }
    // update nav
    document.querySelectorAll('#bottomNav button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode)
    })
    document.getElementById('bottomNav').hidden = false
    // update pop color
    const popMap = { stories: 'var(--pop-stories)', posts: 'var(--pop-posts)', tweets: 'var(--pop-tweets)', chat: 'var(--pop-chat)', bereal: 'var(--pop-bereal)', profile: 'var(--pop-profile)' }
    document.documentElement.style.setProperty('--pop', popMap[mode] ?? 'var(--text)')
    // scroll to top on mode change for clarity
    window.scrollTo({ top: 0, behavior: 'instant' })
  },

  // ─── Per-mode Habitats (banner + mascot + particles) ───
  _modeVibes: {
    stories: {
      title: 'stories',
      subtitle: 'lo que pasa hoy. desaparece en 24h.',
      traits: { eyes: 'sleepy', mouth: 'smile', cheeks: 'blush', headTop: 'spike' },
      mascotColor: 'Tomato',
      particle: 'ember',
    },
    posts: {
      title: 'posts',
      subtitle: 'tu galería personal.',
      traits: { eyes: 'sparkle', mouth: 'cat', cheeks: 'blush', headTop: 'droplet' },
      mascotColor: 'DodgerBlue',
      particle: 'sparkle',
    },
    tweets: {
      title: 'miaus',
      subtitle: 'pensamientos al vuelo.',
      traits: { eyes: 'classic', mouth: 'open', cheeks: 'blush', headTop: 'leaf' },
      mascotColor: 'Gold',
      particle: 'bubble',
    },
    chat: {
      title: 'chat',
      subtitle: 'conversaciones en privado.',
      traits: { eyes: 'heart', mouth: 'smile', cheeks: 'blush', headTop: 'none' },
      mascotColor: 'MediumSeaGreen',
      particle: 'soft',
    },
    bereal: {
      title: 'miau real',
      subtitle: 'una foto al día. sin filtros.',
      traits: { eyes: 'round', mouth: 'o', cheeks: 'freckles', headTop: 'antenna' },
      mascotColor: 'DarkOrange',
      particle: 'sun',
    },
    profile: {
      title: 'tu gato',
      subtitle: 'tu rincón. tu look.',
      traits: { eyes: 'star', mouth: 'smirk', cheeks: 'blush', headTop: 'antenna' },
      mascotColor: 'MediumPurple',
      particle: 'star',
    },
  },

  _renderBanner(mode) {
    const banner = document.getElementById('modeBanner')
    const cfg = App._modeVibes[mode]
    if (!banner || !cfg) { if (banner) banner.hidden = true; return }
    banner.hidden = false
    banner.dataset.mode = mode
    document.getElementById('bannerTitle').textContent = cfg.title
    document.getElementById('bannerSubtitle').textContent = cfg.subtitle

    // mascot poporing
    const mascotEl = document.getElementById('bannerMascot')
    if (typeof generatePoporingFromTraits === 'function') {
      mascotEl.innerHTML = generatePoporingFromTraits(cfg.traits, cfg.mascotColor)
    }

    // particles
    const part = document.getElementById('bannerParticles')
    part.innerHTML = ''
    part.dataset.particle = cfg.particle
    const count = cfg.particle === 'sun' ? 6 : 14
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span')
      dot.className = 'particle particle-' + cfg.particle
      dot.style.left = Math.random() * 100 + '%'
      dot.style.top = Math.random() * 100 + '%'
      dot.style.animationDelay = (Math.random() * 4) + 's'
      dot.style.animationDuration = (3 + Math.random() * 4) + 's'
      part.appendChild(dot)
    }
  },

  updateHeader() {
    if (!App.user) return
    // Update composer avatar
    const composerAvatar = document.getElementById('composerAvatar')
    if (composerAvatar) composerAvatar.src = App.avatarUrl(App.user.id)
  },

  // ─── Registration ───
  showRegistration() {
    document.querySelectorAll('.mode').forEach(s => s.hidden = true)
    document.getElementById('registration').hidden = false
    document.getElementById('bottomNav').hidden = true
    const banner = document.getElementById('modeBanner'); if (banner) banner.hidden = true
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
    const banner = document.getElementById('modeBanner'); if (banner) banner.hidden = true
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
      App.updateHeader()
      App.go('tweets')
    } catch (e) {
      App.user = null
      errEl.textContent = e.message
      errEl.hidden = false
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
  avatarUrl(userId) {
    // Cache-buster ensures avatar updates propagate immediately
    return `/api/users/${userId}/avatar.svg?v=${App._avatarVersion ?? 0}`
  },

  renderHeader(item) {
    return `<img class="avatar" src="${App.avatarUrl(item.user_id)}" loading="lazy">
      <div class="item-header">
        <b style="color:${colorHex(item.color)}">${item.username}</b>
        <small class="muted">${timeAgo(item.created_at)}</small>
      </div>`
  },

  bumpAvatarVersion() {
    App._avatarVersion = Date.now()
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

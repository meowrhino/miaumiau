// History-API routing. Each section is a real URL.
// Public pages (/u/:user, /p/:id, /t/:id) are server-rendered first,
// then the SPA takes over.
;(function () {
  const SECTIONS = ['tweets', 'stories', 'posts', 'chat', 'bereal', 'profile', 'city', 'admin']

  // path → { mode, params }
  function parse(path) {
    if (!path || path === '/') return { mode: 'tweets', params: {} }
    const parts = path.replace(/^\/|\/$/g, '').split('/')
    const head = parts[0]
    if (SECTIONS.includes(head)) {
      // /chat/:username → open chat with that user (handled by App.openChatWith later)
      if (head === 'chat' && parts[1]) return { mode: 'chat', params: { with: parts[1] } }
      return { mode: head, params: {} }
    }
    // Server-rendered public pages: leave them to App.enter_public()
    if (['u', 'p', 't'].includes(head)) return { mode: 'public', params: { kind: head, ref: parts[1] } }
    // unknown → fallback
    return { mode: 'tweets', params: {} }
  }

  function pathFor(mode, params = {}) {
    if (mode === 'tweets' && !params.with) return '/'
    if (mode === 'chat' && params.with) return '/chat/' + params.with
    return '/' + mode
  }

  function navigate(path, opts = {}) {
    const { mode, params } = parse(path)
    if (window.App && App.user) {
      // Internal section navigation
      App.go(mode, { ...params, _fromRoute: true })
    } else if (mode === 'public') {
      // Hard navigate to public route (server has the OG-rich HTML)
      if (!opts.fromPop) window.location.assign(path)
      return
    }
    if (!opts.fromPop) {
      const targetPath = pathFor(mode, params)
      if (location.pathname !== targetPath) {
        history.pushState({ mode, params }, '', targetPath)
      }
    }
    document.title = mode === 'tweets' ? 'miaumiau' : `${mode} · miaumiau`
  }

  // Catch internal anchor clicks like <a href="/posts" data-route>
  function interceptClicks() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[data-route]')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#')) return
      e.preventDefault()
      navigate(href)
    })
  }

  window.addEventListener('popstate', e => {
    const path = location.pathname
    navigate(path, { fromPop: true })
  })

  window.Routes = {
    parse,
    pathFor,
    navigate,
    init() {
      interceptClicks()
      // First navigation handled by App.init() which will read location.pathname
    },
    currentPath() { return location.pathname },
  }
})()

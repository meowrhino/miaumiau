// History-API routing. The city is the menu; the 6 functional sections live
// as bottom sheets inside the city. URLs like /tweets, /posts, /stories, /chat,
// /bereal, /profile resolve to { mode: 'city', sheet: <id> } so direct navigation
// (refresh, share, deep link) lands on the map with the right sheet open.
;(function () {
  // Limpieza (OLD/): los modos sociales están archivados. Lo único vivo es el
  // parque + el chat en vivo, así que toda ruta resuelve al parque ('city').
  // path → { mode, params }
  function parse(path) {
    return { mode: 'city', params: {} }
  }

  function pathFor(mode, params = {}) {
    if (mode === 'city') {
      if (params.sheet === 'chat' && params.chatWith) return '/chat/' + params.chatWith
      if (params.sheet) return '/' + params.sheet
      return '/'
    }
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
    document.title = mode === 'city' ? 'miaumiau' : `${mode} · miaumiau`
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

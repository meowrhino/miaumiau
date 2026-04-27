// HUD cluster (bottom-right) + Map modal.
// Toggle visibility: HUD starts collapsed; click on Pet expands.
;(function () {
  const HUD = {
    mounted: false,
    collapsed: true,  // hidden by default — Pet click expands

    mount() {
      const el = document.getElementById('hud')
      if (!el || HUD.mounted) return
      HUD.mounted = true

      // Wire HUD button clicks
      el.querySelectorAll('.hud-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const action = btn.dataset.action
          if (action === 'cat-editor') {
            if (window.CatEditor && CatEditor.open) CatEditor.open()
            return
          }
          const route = btn.dataset.route
          if (route === '/') return HUD.openMap()
          if (window.Routes) Routes.navigate(route)
        })
      })

      // Wire map place clicks
      document.querySelectorAll('.map-place').forEach(p => {
        p.addEventListener('click', () => {
          HUD.closeMap()
          const route = p.dataset.route
          if (window.Routes) setTimeout(() => Routes.navigate(route), 80)
        })
      })

      // Esc closes map
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') HUD.closeMap()
      })

      // Click outside map canvas closes
      const modal = document.getElementById('mapModal')
      if (modal) {
        modal.addEventListener('click', e => {
          if (e.target === modal) HUD.closeMap()
        })
      }
    },

    show() {
      const el = document.getElementById('hud')
      if (!el) return
      el.hidden = false
      el.classList.toggle('collapsed', HUD.collapsed)
    },
    hide() {
      const el = document.getElementById('hud')
      if (el) el.hidden = true
    },

    // Collapse/expand toggled by clicking the Pet
    toggle() {
      const el = document.getElementById('hud')
      if (!el) return
      HUD.collapsed = !HUD.collapsed
      el.classList.toggle('collapsed', HUD.collapsed)
    },
    collapse() {
      const el = document.getElementById('hud')
      if (!el) return
      HUD.collapsed = true
      el.classList.add('collapsed')
    },
    expand() {
      const el = document.getElementById('hud')
      if (!el) return
      HUD.collapsed = false
      el.classList.remove('collapsed')
    },

    setActive(mode) {
      document.querySelectorAll('.hud-btn').forEach(b => {
        const route = b.dataset.route
        const isActive = route === '/' + mode || (mode === 'tweets' && route === '/tweets')
        b.classList.toggle('active', isActive)
      })
    },

    refreshProfileAvatar() {
      const slot = document.getElementById('hudProfileAvatar')
      if (!slot || !App.user) return
      slot.innerHTML = `<img src="${App.avatarUrl(App.user.id)}" alt="" draggable="false">`
    },

    openMap() {
      const m = document.getElementById('mapModal')
      if (!m) return
      m.hidden = false
      requestAnimationFrame(() => m.classList.add('open'))
      // Briefly switch to map habitat
      if (window.World) World.applyHabitat('map')
    },
    closeMap() {
      const m = document.getElementById('mapModal')
      if (!m || m.hidden) return
      m.classList.remove('open')
      setTimeout(() => { m.hidden = true }, 220)
      // Restore habitat for current mode
      if (window.World && window.App && App.mode) World.applyHabitat(App.mode)
    },

    setUnread(n) {
      const b = document.getElementById('hudUnreadBadge')
      if (!b) return
      if (n > 0) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = false }
      else b.hidden = true
    },
  }

  window.HUD = HUD
})()

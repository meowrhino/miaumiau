// Pet Menu — radial overlay opened by clicking the pet.
// Replaces the old HUD cluster + map modal: the pet IS the menu.
;(function () {
  const Menu = {
    mounted: false,
    open_: false,

    mount() {
      const el = document.getElementById('petMenu')
      if (!el || Menu.mounted) return
      Menu.mounted = true

      // Wire action clicks. The 6 functional zones live in the city map (the city IS
      // the menu) — this radial only handles meta-actions that don't fit on the map.
      el.querySelectorAll('.pet-menu-action').forEach(b => {
        b.addEventListener('click', () => {
          const action = b.dataset.action
          const route = b.dataset.route
          Menu.close()
          if (action === 'cat-editor') {
            if (typeof CatEditor !== 'undefined' && CatEditor.open) setTimeout(() => CatEditor.open(), 120)
            return
          }
          if (action === 'events') {
            if (typeof Events !== 'undefined' && Events.openModal) setTimeout(() => Events.openModal(), 120)
            return
          }
          if (action === 'back-to-city') {
            // If a sheet is open, close it; otherwise just navigate to /
            if (window.City && City.closeSheet) City.closeSheet()
            setTimeout(() => { if (window.Routes) Routes.navigate('/') }, 80)
            return
          }
          if (action === 'logout') {
            if (App.logout) App.logout()
            return
          }
          if (route) setTimeout(() => Routes.navigate(route), 90)
        })
      })

      // Esc closes
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && Menu.open_) Menu.close()
      })

      // Backdrop click closes
      el.addEventListener('click', e => {
        if (e.target === el) Menu.close()
      })
    },

    open() {
      const el = document.getElementById('petMenu')
      if (!el) return
      Menu.refreshHeader()
      Menu.refreshAdmin()
      el.hidden = false
      requestAnimationFrame(() => el.classList.add('open'))
      Menu.open_ = true
      // Switch habitat to map vibe while menu is up
      if (window.World) World.applyHabitat('map')
      if (window.track) track('menu:open')
    },

    close() {
      const el = document.getElementById('petMenu')
      if (!el || el.hidden) return
      el.classList.remove('open')
      setTimeout(() => { el.hidden = true }, 220)
      Menu.open_ = false
      // Restore habitat for current mode
      if (window.World && window.App && App.mode) World.applyHabitat(App.mode)
    },

    toggle() { Menu.open_ ? Menu.close() : Menu.open() },

    refreshHeader() {
      if (!App.user) return
      const av = document.getElementById('petMenuAvatar')
      const nm = document.getElementById('petMenuName')
      if (av) av.innerHTML = `<img src="${App.avatarUrl(App.user.id)}" alt="" draggable="false">`
      if (nm) nm.textContent = App.user.username || App.user.display_name || 'miau'
    },

    // Show admin shortcut only for the owner account
    refreshAdmin() {
      const a = document.getElementById('petMenuAdmin')
      if (!a) return
      const isAdmin = !!(App.user && (App.user.account_name === 'manu' || App.user.username === 'manu'))
      a.hidden = !isAdmin
    },

    setUnread(n) {
      const b = document.getElementById('petMenuUnread')
      if (!b) return
      if (n > 0) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = false }
      else b.hidden = true
    },
  }

  window.Menu = Menu
})()

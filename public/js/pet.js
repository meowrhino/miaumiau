// Poporing pet: always-visible avatar at bottom-left.
// Idles, walks across when section changes, peeks at composer when typing.
// Click on pet → opens the radial Pet Menu (the only menu).
;(function () {
  const HINT_KEY = 'miau_pet_hint_seen'

  const Pet = {
    el: null,
    sprite: null,
    bubble: null,
    hint: null,

    mount() {
      Pet.el     = document.getElementById('poporingPet')
      Pet.sprite = document.getElementById('poporingPetSprite')
      Pet.bubble = document.getElementById('poporingPetBubble')
      Pet.hint   = document.getElementById('poporingPetHint')
      if (!Pet.el || !Pet.sprite) return
      Pet.refresh()
      Pet.el.hidden = !App.user
      // Click on pet:
      //   - If we're not in the city (e.g. /admin, /u/...), the pet is the "go home"
      //     button — it walks you back to the city map (which IS the menu).
      //   - If we're already in the city, open the radial action menu (editar miau,
      //     eventos, salir, etc.). The 6 places live in the map itself.
      Pet.el.addEventListener('click', (e) => {
        e.stopPropagation()
        Pet.pop()
        Pet.dismissHint()
        const inCity = App.mode === 'city'
        if (!inCity) {
          if (window.Routes) Routes.navigate('/')
          return
        }
        if (window.Menu) Menu.toggle()
      })
      // First-visit discovery hint — show after a delay so the user notices the pet first
      if (App.user && !localStorage.getItem(HINT_KEY)) {
        setTimeout(() => { if (!localStorage.getItem(HINT_KEY)) Pet.showHint() }, 1800)
      }
    },

    refresh() {
      if (!App.user || !Pet.sprite) return
      Pet.sprite.innerHTML = `<img src="${App.avatarUrl(App.user.id)}" alt="" draggable="false">`
    },

    show()  { if (Pet.el) Pet.el.hidden = false },
    hide()  { if (Pet.el) Pet.el.hidden = true },

    // Walk transition between sections — pet slides across the bottom briefly
    walk(toMode) {
      if (!Pet.el) return
      Pet.el.classList.remove('walk-trip')
      void Pet.el.offsetWidth
      Pet.el.classList.add('walk-trip')
      setTimeout(() => Pet.el.classList.remove('walk-trip'), 900)
      Pet.say(WALK_LINES[toMode] || null, 1800)
    },

    // Speech bubble (auto-hide after duration)
    say(text, ms = 2200) {
      if (!Pet.bubble || !text) return
      Pet.bubble.textContent = text
      Pet.bubble.hidden = false
      clearTimeout(Pet._sayTimer)
      Pet._sayTimer = setTimeout(() => { Pet.bubble.hidden = true }, ms)
    },

    // Bounce on action
    pop() {
      if (!Pet.el) return
      Pet.el.classList.remove('pet-pop')
      void Pet.el.offsetWidth
      Pet.el.classList.add('pet-pop')
    },

    showHint() {
      if (!Pet.hint) return
      Pet.hint.hidden = false
    },

    dismissHint() {
      if (!Pet.hint) return
      Pet.hint.hidden = true
      localStorage.setItem(HINT_KEY, '1')
    },
  }

  const WALK_LINES = {
    tweets:  '¡al café!',
    stories: 'al miradero...',
    posts:   'tablón',
    chat:    'al banquito',
    bereal:  'una foto',
    profile: '¡a casa!',
    map:     'a ver el pueblo',
    city:    '¡a la plaza!',
    admin:   'a las stats',
  }

  window.Pet = Pet
})()

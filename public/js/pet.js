// Poporing pet: always-visible avatar at bottom-left.
// Idles, walks across when section changes, peeks at composer when typing.
;(function () {
  const Pet = {
    el: null,
    sprite: null,
    bubble: null,

    mount() {
      Pet.el     = document.getElementById('poporingPet')
      Pet.sprite = document.getElementById('poporingPetSprite')
      Pet.bubble = document.getElementById('poporingPetBubble')
      if (!Pet.el || !Pet.sprite) return
      Pet.refresh()
      Pet.el.hidden = !App.user
      // Click on pet → toggle HUD menu collapse/expand
      Pet.el.addEventListener('click', (e) => {
        e.stopPropagation()
        Pet.pop()
        if (window.HUD) HUD.toggle()
      })
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
  }

  const WALK_LINES = {
    tweets:  '¡al café!',
    stories: 'al miradero...',
    posts:   'tablón',
    chat:    'al banquito',
    bereal:  'una foto',
    profile: '¡a casa!',
    map:     'a ver el pueblo',
  }

  window.Pet = Pet
})()

// ─── Cat Editor Modal ───
const CatEditor = {
  traits: null,
  color: null,

  open() {
    if (!App.user) return
    CatEditor.color = App._profileColor ?? App.user.color
    CatEditor.traits = seedToTraits(App.user.avatar_seed)

    // Build trait selectors
    const container = document.getElementById('catEditorTraits')
    container.innerHTML = ''

    for (const [key, meta] of Object.entries(CAT_TRAITS)) {
      const section = document.createElement('div')
      section.className = 'cat-trait-row'

      const label = document.createElement('span')
      label.className = 'cat-trait-label'
      label.textContent = meta.name

      const options = document.createElement('div')
      options.className = 'cat-trait-options'

      for (let i = 0; i < meta.count; i++) {
        const btn = document.createElement('button')
        btn.className = 'cat-trait-btn' + (CatEditor.traits[key] === i ? ' active' : '')
        btn.textContent = meta.labels[i]
        btn.onclick = () => {
          CatEditor.traits[key] = i
          options.querySelectorAll('.active').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          CatEditor.updatePreview()
        }
        options.appendChild(btn)
      }

      section.appendChild(label)
      section.appendChild(options)
      container.appendChild(section)
    }

    CatEditor.updatePreview()
    document.getElementById('catEditorModal').hidden = false
  },

  updatePreview() {
    const seed = traitsToSeed(CatEditor.traits)
    const svg = generateCatSvg(seed, CatEditor.color)
    document.getElementById('catEditorAvatar').innerHTML = svg
  },

  async save() {
    const seed = traitsToSeed(CatEditor.traits)

    try {
      // Persist to server
      await API.put('/users/' + App.user.id, { avatar_seed: seed })

      App.user.avatar_seed = seed
      App.save()

      // Update profile preview
      const preview = document.getElementById('profileAvatar')
      preview.innerHTML = generateCatSvg(seed, CatEditor.color)

      // Update composer avatar
      App.bumpAvatarVersion()
      App.updateHeader()

      showToast('gato actualizado')
      CatEditor.close()
    } catch (e) { showToast(e.message) }
  },

  close() {
    document.getElementById('catEditorModal').hidden = true
  }
}

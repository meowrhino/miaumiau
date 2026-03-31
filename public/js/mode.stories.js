// ─── Stories Mode ───
Object.assign(App, {
  _stories: [],
  _storyIdx: 0,
  _storyGroupIdx: 0,
  _storyGroups: [],
  _storyTimer: null,

  enter_stories() {
    App.loadStories()
  },

  async loadStories() {
    try {
      const stories = await API.get('/stories')
      const container = $('#storyBubbles')
      container.innerHTML = ''

      // group by user
      const groups = {}
      stories.forEach(s => {
        if (!groups[s.user_id]) groups[s.user_id] = { user_id: s.user_id, username: s.username, color: s.color, avatar_seed: s.avatar_seed, stories: [] }
        groups[s.user_id].stories.push(s)
      })
      App._storyGroups = Object.values(groups)

      if (App._storyGroups.length === 0) {
        container.innerHTML = '<p class="muted center">no hay stories todavia</p>'
        return
      }

      App._storyGroups.forEach((group, gi) => {
        const el = document.createElement('button')
        el.className = 'story-bubble'
        el.innerHTML = `<img class="avatar big" src="/api/users/${group.user_id}/avatar.svg">
          <span style="color:${colorHex(group.color)}">${group.username}</span>`
        el.onclick = () => App.viewStories(gi)
        container.appendChild(el)
      })
    } catch (e) { showToast(e.message) }
  },

  viewStories(groupIdx) {
    App._storyGroupIdx = groupIdx
    App._storyIdx = 0
    $('#storyViewer').hidden = false
    document.getElementById('bottomNav').hidden = true
    // header removed
    App._showStory()
  },

  _showStory() {
    const group = App._storyGroups[App._storyGroupIdx]
    if (!group) { App.closeStoryViewer(); return }
    const stories = group.stories
    if (App._storyIdx >= stories.length) {
      // next group
      App._storyGroupIdx++
      App._storyIdx = 0
      if (App._storyGroupIdx >= App._storyGroups.length) { App.closeStoryViewer(); return }
      App._showStory()
      return
    }

    const story = stories[App._storyIdx]
    $('#storyImage').src = '/media/stories/' + story.media_key

    // progress bars
    const progress = $('#storyProgress')
    progress.innerHTML = ''
    stories.forEach((_, i) => {
      const bar = document.createElement('div')
      bar.className = 'progress-bar' + (i < App._storyIdx ? ' done' : i === App._storyIdx ? ' active' : '')
      progress.appendChild(bar)
    })

    // layers
    const layers = $('#storyLayers')
    layers.innerHTML = ''
    try {
      const data = JSON.parse(story.layers_json || '{}')
      if (data.texts) data.texts.forEach(t => {
        const el = document.createElement('div')
        el.className = 'story-text-overlay'
        el.style.left = (t.x * 100) + '%'
        el.style.top = (t.y * 100) + '%'
        el.style.fontSize = (t.size || 24) + 'px'
        el.style.color = t.color || '#fff'
        el.textContent = t.text
        layers.appendChild(el)
      })
      if (data.links) data.links.forEach(l => {
        const el = document.createElement('a')
        el.className = 'story-link-overlay'
        el.href = l.url
        el.target = '_blank'
        el.rel = 'noopener'
        el.style.left = (l.x * 100) + '%'
        el.style.top = (l.y * 100) + '%'
        el.style.width = ((l.w || 0.5) * 100) + '%'
        el.textContent = l.label || l.url
        layers.appendChild(el)
      })
    } catch (_) {}

    // mark viewed
    API.post('/stories/' + story.id + '/view').catch(() => {})

    // auto advance
    clearTimeout(App._storyTimer)
    App._storyTimer = setTimeout(() => {
      App._storyIdx++
      App._showStory()
    }, 5000)
  },

  storyNext() {
    clearTimeout(App._storyTimer)
    App._storyIdx++
    App._showStory()
  },

  storyPrev() {
    clearTimeout(App._storyTimer)
    if (App._storyIdx > 0) App._storyIdx--
    App._showStory()
  },

  closeStoryViewer() {
    clearTimeout(App._storyTimer)
    $('#storyViewer').hidden = true
    document.getElementById('bottomNav').hidden = false
    // header removed
  },

  openStoryEditor() {
    StoryEditor.open()
  }
})

// ─── Posts Mode ───
Object.assign(App, {
  postsPage: 1,
  _postBlob: null,

  enter_posts() {
    App.postsPage = 1
    App.loadPosts(1)
  },

  async loadPosts(page) {
    try {
      const posts = await API.get('/posts?page=' + page + '&limit=20')
      const container = $('#postFeed')
      if (page === 1) container.innerHTML = ''
      posts.forEach(p => App.renderPost(p, container))
      $('#postsMore').hidden = posts.length < 20
    } catch (e) { showToast(e.message) }
  },

  renderPost(post, container) {
    const el = document.createElement('div')
    el.className = 'item post'
    el.innerHTML = `
      ${App.renderHeader(post)}
      <img class="post-image" src="/media/posts/${post.media_key}" loading="lazy" alt="">
      <div class="item-body">
        ${post.caption ? `<p>${linkify(esc(post.caption))}</p>` : ''}
        <div class="actions">
          <button onclick="App.toggleReaction('post',${post.id},this)">😻</button>
          <button onclick="App.showComments(${post.id})">💬 ${post.comment_count || ''}</button>
        </div>
      </div>`
    container.appendChild(el)
  },

  openPostComposer() {
    $('#postModal').hidden = false
    $('#postFile').value = ''
    $('#postPreview').hidden = true
    $('#postSize').textContent = ''
    $('#postCaption').value = ''
    App._postBlob = null
    const dz = $('#postDropZone'); if (dz) dz.classList.remove('has-file')
    const hint = $('#postDropHint'); if (hint) hint.textContent = 'o arrástrala aquí'

    $('#postFile').onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const blob = await compressImage(file, 'post')
        App._postBlob = blob
        const url = URL.createObjectURL(blob)
        $('#postPreview').src = url
        $('#postPreview').hidden = false
        $('#postSize').textContent = formatSize(blob.size)
        if (dz) dz.classList.add('has-file')
        if (hint) hint.textContent = 'foto lista · ' + formatSize(blob.size)
      } catch (err) { showToast('error comprimiendo: ' + err.message) }
    }
  },

  closePostComposer() {
    $('#postModal').hidden = true
    App._postBlob = null
  },

  async submitPost() {
    if (!App._postBlob) { showToast('selecciona una imagen'); return }
    const caption = $('#postCaption').value.trim()
    const fd = new FormData()
    fd.append('image', App._postBlob, 'photo.webp')
    fd.append('caption', caption)
    try {
      await API.upload('/posts', fd)
      App.closePostComposer()
      App.loadPosts(1)
      if (window.track) track('create:post', { hasCaption: !!caption })
      showToast('publicado')
    } catch (e) { showToast(e.message) }
  },

  async showComments(postId) {
    try {
      const data = await API.get('/posts/' + postId)
      const modal = $('#replyModal')
      const thread = $('#replyThread')
      thread.innerHTML = ''
      // post header
      const header = document.createElement('div')
      header.className = 'item post'
      header.innerHTML = `${App.renderHeader(data.post)}
        <img class="post-image small" src="/media/posts/${data.post.media_key}" loading="lazy">`
      thread.appendChild(header)
      // comments
      data.comments.forEach(c => {
        const el = document.createElement('div')
        el.className = 'item tweet reply'
        el.innerHTML = `${App.renderHeader(c)}<div class="item-body"><p>${linkify(esc(c.content))}</p></div>`
        thread.appendChild(el)
      })
      App._replyToId = null
      App._commentPostId = postId
      modal.hidden = false
      $('#replyInput').value = ''
      $('#replyInput').focus()
    } catch (e) { showToast(e.message) }
  },

})

// Patch submitReply to support comments
const _origSubmitReply = App.submitReply
App.submitReply = async function () {
  if (App._commentPostId) {
    const content = $('#replyInput').value.trim()
    if (!content) return
    try {
      await API.post('/posts/' + App._commentPostId + '/comments', { content })
      App.closeReply()
      App.loadPosts(1)
      showToast('comentario enviado')
    } catch (e) { showToast(e.message) }
    App._commentPostId = null
    return
  }
  return _origSubmitReply.call(App)
}

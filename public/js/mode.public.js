// ─── Public Mode (read-only view for /u/:username, /p/:id, /t/:id) ───
Object.assign(App, {
  async enter_public() {
    const ctx = window.__PUBLIC_CONTEXT__
    const root = $('#publicContent')
    if (!ctx) { root.innerHTML = empty('sin contexto') ; return }

    // Hide bottom nav + CTA handling
    $('#bottomNav').hidden = true
    document.documentElement.style.setProperty('--pop', 'var(--text)')

    // If logged in, the CTA goes to main app instead of registration
    const cta = document.querySelector('.public-cta')
    if (cta && App.user) {
      cta.innerHTML = `<a href="/" class="btn">volver a mi miaumiau</a>`
    }

    root.innerHTML = `<div class="loading">cargando</div>`
    try {
      if (ctx.kind === 'user') await App.renderPublicUser(ctx.username)
      else if (ctx.kind === 'post') await App.renderPublicPost(ctx.id)
      else if (ctx.kind === 'tweet') await App.renderPublicTweet(ctx.id)
      else if (ctx.kind === 'user_not_found') root.innerHTML = empty('este gato no existe', '🙀')
      else if (ctx.kind === 'post_not_found') root.innerHTML = empty('este post ya no existe', '📭')
      else if (ctx.kind === 'tweet_not_found') root.innerHTML = empty('este miau ya no existe', '💬')
      else root.innerHTML = empty('contenido no encontrado')
    } catch (e) {
      root.innerHTML = empty(e.message || 'error cargando', '⚠️')
    }
  },

  async renderPublicUser(username) {
    const data = await API.get('/public/users/' + encodeURIComponent(username))
    const u = data.user
    const hex = colorHex(u.color)
    const joined = new Date(u.created_at + 'Z')
    const joinedStr = joined.toLocaleDateString('es', { month: 'long', year: 'numeric' })

    const root = $('#publicContent')
    root.innerHTML = `
      <header class="public-header" style="--user-accent:${hex}">
        <div class="public-avatar">
          <img src="${App.avatarUrl(u.id)}" alt="avatar de ${esc(u.username)}">
        </div>
        <h1 class="public-name">${esc(u.username)}</h1>
        ${u.bio ? `<p class="public-bio">${linkify(u.bio)}</p>` : ''}
        <p class="public-meta">aquí desde ${joinedStr}</p>
      </header>

      ${data.posts.length ? `
        <section class="public-section">
          <h2 class="public-section-title">fotos</h2>
          <div class="public-grid">
            ${data.posts.map(p => `
              <a class="public-grid-cell" href="/p/${p.id}">
                <img src="/media/posts/${p.media_key}" loading="lazy" alt="">
              </a>
            `).join('')}
          </div>
        </section>` : ''}

      ${data.tweets.length ? `
        <section class="public-section">
          <h2 class="public-section-title">miaus</h2>
          <div class="public-tweets">
            ${data.tweets.map(t => `
              <a class="public-tweet" href="/t/${t.id}">
                <p>${linkify(t.content)}</p>
                <small class="muted">${timeAgo(t.created_at)}${t.reply_count ? ' · ' + t.reply_count + ' respuestas' : ''}</small>
              </a>
            `).join('')}
          </div>
        </section>` : ''}

      ${(!data.posts.length && !data.tweets.length) ? empty(esc(u.username) + ' no ha publicado aún', '🌱') : ''}
    `
  },

  async renderPublicPost(id) {
    const data = await API.get('/posts/' + id)
    const p = data.post
    const root = $('#publicContent')
    root.innerHTML = `
      <article class="public-post">
        <header class="public-post-header">
          <a href="/u/${encodeURIComponent(p.username)}" class="public-post-author">
            <img class="avatar" src="${App.avatarUrl(p.user_id)}" alt="">
            <b style="color:${colorHex(p.color)}">${esc(p.username)}</b>
          </a>
          <small class="muted">${timeAgo(p.created_at)}</small>
        </header>
        <img class="public-post-image" src="/media/posts/${p.media_key}" alt="">
        ${p.caption ? `<p class="public-post-caption">${linkify(p.caption)}</p>` : ''}
        ${data.comments.length ? `
          <div class="public-comments">
            <h3 class="public-section-title">${data.comments.length} comentario${data.comments.length === 1 ? '' : 's'}</h3>
            ${data.comments.map(c => `
              <div class="public-comment">
                <a href="/u/${encodeURIComponent(c.username)}" class="public-comment-author">
                  <img class="avatar" src="${App.avatarUrl(c.user_id)}" alt="">
                  <b style="color:${colorHex(c.color)}">${esc(c.username)}</b>
                </a>
                <p>${linkify(c.content)}</p>
                <small class="muted">${timeAgo(c.created_at)}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </article>
    `
  },

  async renderPublicTweet(id) {
    const data = await API.get('/tweets/' + id)
    const t = data.tweet
    const root = $('#publicContent')
    root.innerHTML = `
      <article class="public-tweet-page">
        <header class="public-post-header">
          <a href="/u/${encodeURIComponent(t.username)}" class="public-post-author">
            <img class="avatar" src="${App.avatarUrl(t.user_id)}" alt="">
            <b style="color:${colorHex(t.color)}">${esc(t.username)}</b>
          </a>
          <small class="muted">${timeAgo(t.created_at)}</small>
        </header>
        <p class="public-tweet-text">${linkify(t.content)}</p>
        ${data.replies.length ? `
          <div class="public-comments">
            <h3 class="public-section-title">${data.replies.length} respuesta${data.replies.length === 1 ? '' : 's'}</h3>
            ${data.replies.map(r => `
              <div class="public-comment">
                <a href="/u/${encodeURIComponent(r.username)}" class="public-comment-author">
                  <img class="avatar" src="${App.avatarUrl(r.user_id)}" alt="">
                  <b style="color:${colorHex(r.color)}">${esc(r.username)}</b>
                </a>
                <p>${linkify(r.content)}</p>
                <small class="muted">${timeAgo(r.created_at)}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </article>
    `
  }
})

function empty(msg, icon = '🐈') {
  return `<div class="empty"><div class="empty-icon">${icon}</div>${msg}</div>`
}

// ─── Tweets Mode ───
Object.assign(App, {
  tweetsPage: 1,
  _replyToId: null,

  enter_tweets() {
    App.tweetsPage = 1
    App.loadTweets(1)
    // char counter
    const input = $('#tweetInput')
    const counter = $('#tweetCount')
    input.oninput = () => counter.textContent = input.value.length + '/1000'
  },

  async loadTweets(page) {
    const container = $('#tweetTimeline')
    if (page === 1) container.innerHTML = '<div class="loading">cargando...</div>'
    try {
      const tweets = await API.get('/tweets?page=' + page + '&limit=20')
      if (page === 1) container.innerHTML = ''
      if (tweets.length === 0 && page === 1) {
        container.innerHTML = (typeof empty === 'function')
          ? empty('aún no hay miaus. sé el primero!')
          : '<div class="empty"><div class="empty-icon">🐱</div><p>no hay miaus todavia</p></div>'
      }
      tweets.forEach(t => App.renderTweet(t, container))
      $('#tweetsMore').hidden = tweets.length < 20
    } catch (e) { showToast(e.message) }
  },

  renderTweet(tweet, container) {
    const el = document.createElement('div')
    el.className = 'tweet'
    const replies = tweet.reply_count ? `<span class="tweet-count">${tweet.reply_count}</span>` : ''
    el.innerHTML = `
      <img class="avatar" src="${App.avatarUrl(tweet.user_id)}" loading="lazy"
           onclick="App.startChatWith(${tweet.user_id},'${esc(tweet.username)}','${tweet.color}')">
      <div class="tweet-body">
        <div class="tweet-meta">
          <span class="tweet-name" style="color:${colorHex(tweet.color)}">${esc(tweet.username)}</span>
          <span class="tweet-time">${timeAgo(tweet.created_at)}</span>
        </div>
        <p class="tweet-text">${linkify(esc(tweet.content))}</p>
        <div class="tweet-actions">
          <button onclick="App.openReply(${tweet.id})" title="responder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            ${replies}
          </button>
          <button onclick="App.toggleReaction('tweet',${tweet.id},this)" title="miau">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button onclick="App.reportTweet(${tweet.id})" title="reportar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </button>
        </div>
      </div>`
    container.appendChild(el)
  },

  async createTweet() {
    const input = $('#tweetInput')
    const content = input.value.trim()
    if (!content) return
    try {
      const tweet = await API.post('/tweets', { content })
      input.value = ''
      $('#tweetCount').textContent = '0/1000'
      // reload to get full data with username etc
      App.loadTweets(1)
    } catch (e) { showToast(e.message) }
  },

  async openReply(tweetId) {
    App._replyToId = tweetId
    try {
      const data = await API.get('/tweets/' + tweetId)
      const thread = $('#replyThread')
      thread.innerHTML = ''
      // original tweet
      const el = document.createElement('div')
      el.className = 'item tweet'
      el.innerHTML = `${App.renderHeader(data.tweet)}<div class="item-body"><p>${linkify(esc(data.tweet.content))}</p></div>`
      thread.appendChild(el)
      // replies
      data.replies.forEach(r => {
        const rel = document.createElement('div')
        rel.className = 'item tweet reply'
        rel.innerHTML = `${App.renderHeader(r)}<div class="item-body"><p>${linkify(esc(r.content))}</p></div>`
        thread.appendChild(rel)
      })
      $('#replyModal').hidden = false
      $('#replyInput').value = ''
      $('#replyInput').focus()
    } catch (e) { showToast(e.message) }
  },

  closeReply() {
    $('#replyModal').hidden = true
    App._replyToId = null
    App._commentPostId = null
  },

  async submitReply() {
    const content = $('#replyInput').value.trim()
    if (!content || !App._replyToId) return
    try {
      await API.post('/tweets', { content, parent_id: App._replyToId })
      App.closeReply()
      App.loadTweets(1)
      showToast('respuesta enviada')
    } catch (e) { showToast(e.message) }
  },

  async toggleReaction(type, id, btn) {
    try {
      const result = await API.post('/reactions', { target_type: type, target_id: id })
      btn.classList.toggle('reacted', result.toggled)
      btn.classList.remove('pop'); void btn.offsetWidth
      btn.classList.add('pop')
      setTimeout(() => btn.classList.remove('pop'), 600)
      // sparkle particles burst
      if (result.toggled) App._emitSparkles(btn)
    } catch (e) { showToast(e.message) }
  },

  _emitSparkles(btn) {
    let wrap = btn.querySelector('.sparkles')
    if (!wrap) {
      wrap = document.createElement('span')
      wrap.className = 'sparkles'
      btn.appendChild(wrap)
    }
    wrap.innerHTML = ''
    const N = 8
    for (let i = 0; i < N; i++) {
      const s = document.createElement('span')
      const angle = (Math.PI * 2 * i / N) + (Math.random() - 0.5) * 0.4
      const dist = 22 + Math.random() * 14
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px')
      s.style.setProperty('--dy', Math.sin(angle) * dist + 'px')
      s.style.animationDelay = (Math.random() * 0.08) + 's'
      wrap.appendChild(s)
    }
    setTimeout(() => { if (wrap) wrap.innerHTML = '' }, 800)
  },

  async reportTweet(id) {
    if (!confirm('reportar este tweet?')) return
    try {
      await API.post('/tweets/' + id + '/report')
      showToast('reportado')
    } catch (e) { showToast(e.message) }
  }
})

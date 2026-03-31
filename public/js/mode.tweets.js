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
    try {
      const tweets = await API.get('/tweets?page=' + page + '&limit=20')
      const container = $('#tweetTimeline')
      if (page === 1) container.innerHTML = ''
      tweets.forEach(t => App.renderTweet(t, container))
      $('#tweetsMore').hidden = tweets.length < 20
    } catch (e) { showToast(e.message) }
  },

  renderTweet(tweet, container) {
    const el = document.createElement('div')
    el.className = 'item tweet'
    el.innerHTML = `
      ${App.renderHeader(tweet)}
      <div class="item-body">
        <p>${linkify(esc(tweet.content))}</p>
        <div class="actions">
          <button onclick="App.openReply(${tweet.id})">💬 ${tweet.reply_count || ''}</button>
          <button onclick="App.toggleReaction('tweet',${tweet.id},this)">😻</button>
          <button class="muted small" onclick="App.reportTweet(${tweet.id})">reportar</button>
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
    } catch (e) { showToast(e.message) }
  },

  async reportTweet(id) {
    if (!confirm('reportar este tweet?')) return
    try {
      await API.post('/tweets/' + id + '/report')
      showToast('reportado')
    } catch (e) { showToast(e.message) }
  }
})

// ─── Chat Mode ───
Object.assign(App, {
  _chatUserId: null,
  _chatPollTimer: null,
  _chatPollSince: null,
  _chatPollInterval: 5000,

  _chatSearchTimeout: null,

  enter_chat() {
    App._chatUserId = null
    $('#chatThread').hidden = true
    $('#chatConversations').hidden = false
    $('.chat-search').hidden = false
    $('#chatSearch').value = ''
    $('#chatSearchResults').innerHTML = ''
    App.loadConversations()
    App._startChatPoll()
  },

  searchChatUsers(query) {
    clearTimeout(App._chatSearchTimeout)
    const results = $('#chatSearchResults')
    if (!query || query.length < 1) { results.innerHTML = ''; return }
    App._chatSearchTimeout = setTimeout(async () => {
      try {
        const users = await API.get('/users/search?q=' + encodeURIComponent(query))
        results.innerHTML = ''
        users.filter(u => u.id !== App.user.id).forEach(u => {
          const el = document.createElement('div')
          el.className = 'friend-row chat-search-row'
          el.innerHTML = `
            <img class="avatar" src="${App.avatarUrl(u.id)}">
            <span class="friend-name" style="color:${colorHex(u.color)}">${esc(u.username)}</span>`
          el.onclick = () => {
            results.innerHTML = ''
            $('#chatSearch').value = ''
            App.openChat(u.id, u.username, u.color)
          }
          results.appendChild(el)
        })
        if (users.filter(u => u.id !== App.user.id).length === 0) {
          results.innerHTML = '<p class="muted" style="padding:8px;font-size:0.8rem">no se encontro ningun gato</p>'
        }
      } catch (e) { console.error(e) }
    }, 300)
  },

  async loadConversations() {
    try {
      const convs = await API.get('/chat/conversations')
      const container = $('#chatConversations')
      container.innerHTML = ''
      if (convs.length === 0) {
        container.innerHTML = '<p class="muted center">no hay conversaciones todavia</p>'
        return
      }
      convs.forEach(c => {
        const el = document.createElement('div')
        el.className = 'item conversation'
        el.innerHTML = `
          <img class="avatar" src="${App.avatarUrl(c.other_id)}" loading="lazy">
          <div class="item-body">
            <b style="color:${colorHex(c.other_color)}">${c.other_username}</b>
            <p class="muted truncate">${esc(c.last_message_preview || '')}</p>
          </div>`
        el.onclick = () => App.openChat(c.other_id, c.other_username, c.other_color)
        container.appendChild(el)
      })
    } catch (e) { showToast(e.message) }
  },

  async openChat(userId, username, color) {
    App._chatUserId = userId
    $('#chatConversations').hidden = true
    $('.chat-search').hidden = true
    $('#chatThread').hidden = false
    $('#chatWith').innerHTML = `<b style="color:${colorHex(color)}">${username}</b>`
    $('#chatInput').value = ''

    try {
      const msgs = await API.get('/chat/' + userId + '?limit=50')
      const container = $('#chatMessages')
      container.innerHTML = ''
      // messages come DESC, reverse for display
      msgs.reverse().forEach(m => App._renderMessage(m, container))
      container.scrollTop = container.scrollHeight

      // mark read
      API.post('/chat/' + userId + '/read').catch(() => {})
    } catch (e) { showToast(e.message) }
  },

  _renderMessage(msg, container) {
    const el = document.createElement('div')
    const isMine = msg.sender_id === App.user.id
    el.className = 'message ' + (isMine ? 'sent' : 'received')
    el.innerHTML = `<p>${linkify(esc(msg.content))}</p>
      <small class="muted">${timeAgo(msg.created_at)}</small>`
    container.appendChild(el)
  },

  async sendMessage() {
    if (!App._chatUserId) return
    const input = $('#chatInput')
    const content = input.value.trim()
    if (!content) return
    input.value = ''

    try {
      const msg = await API.post('/chat/' + App._chatUserId, { content })
      const container = $('#chatMessages')
      App._renderMessage({ ...msg, sender_id: App.user.id }, container)
      container.scrollTop = container.scrollHeight
    } catch (e) { showToast(e.message) }
  },

  closeChat() {
    App._chatUserId = null
    $('#chatThread').hidden = true
    $('#chatConversations').hidden = false
    $('.chat-search').hidden = false
    App.loadConversations()
  },

  // ─── Start chat from user list (click on avatar anywhere) ───
  startChatWith(userId, username, color) {
    App.go('chat')
    setTimeout(() => App.openChat(userId, username, color), 100)
  },

  // ─── Polling ───
  _startChatPoll() {
    if (!App.user) return
    App._chatPollSince = new Date().toISOString()
    App._chatPollInterval = 5000
    App._pollChat()
  },

  async _pollChat() {
    if (App.mode !== 'chat') {
      // slow poll in background
      App._chatPollTimer = setTimeout(() => App._pollChat(), 60000)
      return
    }
    try {
      const data = await API.get('/chat/poll?since=' + encodeURIComponent(App._chatPollSince))
      if (data.messages.length > 0) {
        App._chatPollSince = data.serverTime
        App._chatPollInterval = 5000 // snap back to fast
        // if viewing a conversation, append new messages
        if (App._chatUserId) {
          const container = $('#chatMessages')
          data.messages
            .filter(m => m.sender_id === App._chatUserId)
            .forEach(m => App._renderMessage(m, container))
          container.scrollTop = container.scrollHeight
          API.post('/chat/' + App._chatUserId + '/read').catch(() => {})
        } else {
          App.loadConversations()
        }
      } else {
        App._chatPollInterval = Math.min(App._chatPollInterval * 1.5, 30000)
      }
      // update unread badge
      const badge = $('#headerUnread')
      badge.textContent = data.unread
      badge.hidden = data.unread === 0
    } catch (_) {
      App._chatPollInterval = 30000
    }
    App._chatPollTimer = setTimeout(() => App._pollChat(), App._chatPollInterval)
  }
})

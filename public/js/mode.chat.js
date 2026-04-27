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
        container.innerHTML = (typeof empty === 'function')
          ? empty('aún no hay conversaciones. busca un gato arriba!')
          : '<p class="muted center">no hay conversaciones</p>'
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
    document.getElementById('modeBanner').hidden = true
    $('#chatWith').innerHTML = `<b style="color:${colorHex(color)}">${esc(username)}</b>`
    $('#chatInput').value = ''
    // tint thread accent with other user's color
    document.documentElement.style.setProperty('--pop', colorHex(color))

    try {
      const msgs = await API.get('/chat/' + userId + '?limit=50')
      const container = $('#chatMessages')
      container.innerHTML = ''
      // messages come DESC, reverse for display
      const ordered = msgs.reverse()
      App._renderMessageList(ordered, container)
      container.scrollTop = container.scrollHeight

      // mark read
      API.post('/chat/' + userId + '/read').catch(() => {})
    } catch (e) { showToast(e.message) }
  },

  _renderMessageList(msgs, container) {
    let lastDate = null
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      const d = (m.created_at || '').slice(0, 10)
      if (d && d !== lastDate) {
        const sep = document.createElement('div')
        sep.className = 'chat-date-sep'
        sep.textContent = App._formatDateSep(m.created_at)
        container.appendChild(sep)
        lastDate = d
      }
      const prev = msgs[i - 1], next = msgs[i + 1]
      const sameAsPrev = prev && prev.sender_id === m.sender_id
        && d === (prev.created_at || '').slice(0, 10)
        && Math.abs(new Date(m.created_at + 'Z') - new Date(prev.created_at + 'Z')) < 3 * 60_000
      const sameAsNext = next && next.sender_id === m.sender_id
        && d === (next.created_at || '').slice(0, 10)
        && Math.abs(new Date(next.created_at + 'Z') - new Date(m.created_at + 'Z')) < 3 * 60_000
      let group = ''
      if (sameAsPrev && sameAsNext) group = 'group-mid'
      else if (sameAsPrev) group = 'group-end'
      else if (sameAsNext) group = 'group-start'
      App._renderMessage(m, container, { group, showMeta: !sameAsNext })
    }
  },

  _formatDateSep(dateStr) {
    const d = new Date(dateStr + 'Z')
    const today = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    const sameDay = (a, b) => a.toDateString() === b.toDateString()
    if (sameDay(d, today)) return 'hoy'
    if (sameDay(d, yesterday)) return 'ayer'
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return d.getDate() + ' ' + months[d.getMonth()]
  },

  _formatTime(dateStr) {
    const d = new Date(dateStr + 'Z')
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  },

  _renderMessage(msg, container, opts = {}) {
    const isMine = msg.sender_id === App.user.id
    // Wrap each message row so we can place a tiny avatar to the left of received messages
    const row = document.createElement('div')
    row.className = 'message-row ' + (isMine ? 'sent' : 'received')
    if (opts.group) row.classList.add(opts.group)
    // Tiny avatar gutter — shown only on the LAST received message in a group (keeps it clean)
    const showAvatar = !isMine && (opts.showMeta !== false)
    if (!isMine) {
      const gutter = document.createElement('div')
      gutter.className = 'message-avatar-gutter'
      if (showAvatar) {
        gutter.innerHTML = `<img class="message-avatar" src="${App.avatarUrl(msg.sender_id)}" alt="" loading="lazy">`
      }
      row.appendChild(gutter)
    }
    const bubble = document.createElement('div')
    bubble.className = 'message ' + (isMine ? 'sent' : 'received')
    if (opts.group) bubble.classList.add(opts.group)
    let metaHtml = ''
    if (opts.showMeta !== false) {
      const time = msg.created_at ? App._formatTime(msg.created_at) : ''
      const ticks = isMine
        ? (msg.read_at ? '<span class="ticks read">✓✓</span>' : '<span class="ticks">✓</span>')
        : ''
      metaHtml = `<div class="message-meta"><span>${time}</span>${ticks}</div>`
    }
    bubble.innerHTML = `<p>${linkify(esc(msg.content))}</p>${metaHtml}`
    row.appendChild(bubble)
    container.appendChild(row)
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
      App._renderMessage({ ...msg, sender_id: App.user.id }, container, { showMeta: true })
      container.scrollTop = container.scrollHeight
    } catch (e) { showToast(e.message) }
  },

  closeChat() {
    App._chatUserId = null
    $('#chatThread').hidden = true
    $('#chatConversations').hidden = false
    $('.chat-search').hidden = false
    document.getElementById('modeBanner').hidden = false
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

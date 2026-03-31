# miaumiau — Pseudocódigo Atómico

Cada función es una unidad mínima. Primero las escribimos todas, luego las refactorizamos.

---

## ÁTOMOS: Funciones Puras (sin side-effects)

```
// ─── CRYPTO ───
hash(text) → SHA-256(text) como hex string
tripcode(secret) → base36(hash(secret)).slice(0,8)

// ─── SANITIZE ───
esc(s) → s.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))

// ─── PARSE ───
parseAuth(header) → {username, secret} = header.split('#', 2)
parseQuery(url, key, fallback) → url.searchParams.get(key) ?? fallback
parseInt(s, fallback) → isNaN(+s) ? fallback : +s

// ─── TIME ───
timeAgo(date) →
  diff = now - date
  si diff < 60s → "ahora"
  si diff < 60m → "{m}m"
  si diff < 24h → "{h}h"
  si diff < 7d  → "{d}d"
  sino → "{d} {mes_corto}"

iso() → new Date().toISOString()
expires24h() → new Date(Date.now() + 86400000).toISOString()

// ─── TEXT ───
linkify(text) → text.replace(URL_REGEX, '<a href="$1" target="_blank">$1</a>')
truncate(text, n) → text.length > n ? text.slice(0,n) + '…' : text

// ─── MEDIA ───
compressImage(file, maxW, maxH, quality) →
  img = createImageBitmap(file)
  ratio = min(maxW/img.w, maxH/img.h, 1)
  canvas = OffscreenCanvas(img.w*ratio, img.h*ratio)
  canvas.ctx.drawImage(img, 0, 0, canvas.w, canvas.h)
  return canvas.toBlob('image/webp', quality)

// ─── AVATAR ───
seedRng(seed) →
  state = seed
  next() → state = (state * 1664525 + 1013904223) & 0xFFFFFFFF; return (state >>> 0) / 0xFFFFFFFF
  int(n) → floor(next() * n)
  return {next, int}

catSvg(seed, color) →
  r = seedRng(seed)
  parts = {
    body: BODIES[r.int(4)],
    ears: EARS[r.int(4)],
    eyes: EYES[r.int(5)],
    mouth: MOUTHS[r.int(4)],
    pattern: PATTERNS[r.int(5)],
    accessory: ACCESSORIES[r.int(6)],
    tail: TAILS[r.int(3)],
    whiskers: WHISKERS[r.int(3)]
  }
  return `<svg viewBox="0 0 64 64">${parts.body(color)}${parts.ears(color)}...etc</svg>`

// ─── COLOR ───
colorHex(name) → COLOR_MAP[name] ?? '#808080'
```

---

## ÁTOMOS: Base de Datos (D1 queries)

```
// ─── USERS ───
db.userCreate(username, tripcode, color, seed) →
  INSERT INTO users (username, tripcode, color, avatar_seed) VALUES (?, ?, ?, ?) RETURNING *

db.userGet(username) →
  SELECT * FROM users WHERE username = ?

db.userUpdate(id, {color?, theme?, bio?}) →
  UPDATE users SET color=?, theme=?, bio=? WHERE id = ? RETURNING *

db.userDelete(id) →
  DELETE FROM users WHERE id = ?

db.userList() →
  SELECT id, username, color, avatar_seed, bio FROM users ORDER BY username

// ─── TWEETS ───
db.tweetList(page, limit) →
  SELECT t.*, u.username, u.color, u.avatar_seed,
    (SELECT COUNT(*) FROM tweets r WHERE r.parent_id = t.id) as reply_count
  FROM tweets t JOIN users u ON t.user_id = u.id
  WHERE t.parent_id IS NULL AND t.hidden = 0
  ORDER BY t.created_at DESC
  LIMIT ? OFFSET ?

db.tweetGet(id) →
  SELECT t.*, u.username, u.color, u.avatar_seed FROM tweets t JOIN users u ON t.user_id = u.id WHERE t.id = ?

db.tweetReplies(parentId) →
  SELECT t.*, u.username, u.color, u.avatar_seed FROM tweets t JOIN users u ON t.user_id = u.id
  WHERE t.parent_id = ? ORDER BY t.created_at ASC

db.tweetCreate(userId, content, parentId?) →
  INSERT INTO tweets (user_id, content, parent_id) VALUES (?, ?, ?) RETURNING *

db.tweetReport(id) →
  UPDATE tweets SET reports = reports + 1, hidden = CASE WHEN reports >= 4 THEN 1 ELSE hidden END WHERE id = ?

// ─── POSTS ───
db.postList(page, limit) →
  SELECT p.*, u.username, u.color, u.avatar_seed,
    (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) as comment_count
  FROM posts p JOIN users u ON p.user_id = u.id
  WHERE p.hidden = 0
  ORDER BY p.created_at DESC
  LIMIT ? OFFSET ?

db.postGet(id) →
  SELECT p.*, u.username, u.color, u.avatar_seed FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?

db.postCreate(userId, caption, mediaKey) →
  INSERT INTO posts (user_id, caption, media_key) VALUES (?, ?, ?) RETURNING *

db.commentList(postId) →
  SELECT c.*, u.username, u.color, u.avatar_seed FROM post_comments c JOIN users u ON c.user_id = u.id
  WHERE c.post_id = ? ORDER BY c.created_at ASC

db.commentCreate(postId, userId, content) →
  INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?) RETURNING *

// ─── REACTIONS ───
db.reactionToggle(userId, targetType, targetId, emoji) →
  // si existe → DELETE, si no → INSERT
  existing = SELECT id FROM reactions WHERE user_id=? AND target_type=? AND target_id=?
  si existing → DELETE ... ; return null
  sino → INSERT INTO reactions (...) VALUES (...) RETURNING *

db.reactionCounts(targetType, targetId) →
  SELECT emoji, COUNT(*) as count FROM reactions WHERE target_type=? AND target_id=? GROUP BY emoji

// ─── STORIES ───
db.storyList() →
  SELECT s.*, u.username, u.color, u.avatar_seed FROM stories s JOIN users u ON s.user_id = u.id
  WHERE s.expires_at > datetime('now') AND s.hidden = 0
  ORDER BY s.created_at DESC

db.storyCreate(userId, mediaKey, layersJson, expiresAt) →
  INSERT INTO stories (user_id, media_key, layers_json, expires_at) VALUES (?, ?, ?, ?) RETURNING *

db.storyView(storyId, userId) →
  INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)

db.storyCleanup() →
  SELECT media_key FROM stories WHERE expires_at <= datetime('now')
  // → borrar de R2
  DELETE FROM stories WHERE expires_at <= datetime('now')
  DELETE FROM story_views WHERE story_id NOT IN (SELECT id FROM stories)

// ─── CHAT ───
db.conversationList(userId) →
  SELECT * FROM conversations WHERE user_a = ? OR user_b = ? ORDER BY last_message_at DESC

db.messageList(userA, userB, before?, limit) →
  SELECT m.*, u.username, u.color, u.avatar_seed FROM messages m JOIN users u ON m.sender_id = u.id
  WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
  AND (? IS NULL OR m.id < ?)
  ORDER BY m.created_at DESC LIMIT ?

db.messageCreate(senderId, receiverId, content, mediaKey?) →
  INSERT INTO messages (sender_id, receiver_id, content, media_key) VALUES (?, ?, ?, ?) RETURNING *
  // + upsert conversations

db.messageMarkRead(userId, otherUserId) →
  UPDATE messages SET read_at = datetime('now')
  WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL

db.messagePoll(userId, since) →
  SELECT m.*, u.username, u.color, u.avatar_seed FROM messages m JOIN users u ON m.sender_id = u.id
  WHERE m.receiver_id = ? AND m.created_at > ?
  ORDER BY m.created_at ASC

db.unreadCount(userId) →
  SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND read_at IS NULL
```

---

## ÁTOMOS: Middleware (servidor)

```
rateLimit(ip, max, windowMs) →
  bucket = MAP.get(ip) ?? {count: 0, reset: now + windowMs}
  si now > bucket.reset → bucket = {count: 0, reset: now + windowMs}
  bucket.count++
  si bucket.count > max → 429 "Demasiadas peticiones"
  MAP.set(ip, bucket)
  // limpiar MAP si > 100 entries

auth(c, db) →
  header = c.req.header('X-Miau')
  si no header → 401
  {username, secret} = parseAuth(header)
  si no username o no secret → 401
  user = db.userGet(username)
  si no user → 401
  si tripcode(secret) !== user.tripcode → 401
  c.set('user', user)

validateText(text, min, max) →
  text = text?.trim()
  si no text o text.length < min o text.length > max → error
  return esc(text)
```

---

## ÁTOMOS: Frontend

```
// ─── STATE ───
App.user = null                    // {username, secret, color, theme} de localStorage
App.mode = 'tweets'                // modo activo
App.data = {tweets:[], posts:[], stories:[], conversations:[]}

// ─── INIT ───
App.init() →
  App.user = JSON.parse(localStorage.miau_user ?? 'null')
  si no App.user → App.showRegistration()
  sino → App.go('tweets'); App.applyTheme(App.user.theme)

// ─── NAV ───
App.go(mode) →
  document.querySelectorAll('.mode').forEach(s => s.hidden = true)
  document.getElementById('mode-' + mode).hidden = false
  App.mode = mode
  App['enter_' + mode]()
  // highlight tab activo

// ─── API WRAPPER ───
App.api(method, path, body?) →
  headers = {'Content-Type': 'application/json'}
  si App.user → headers['X-Miau'] = App.user.username + '#' + App.user.secret
  resp = fetch('/api' + path, {method, headers, body: body ? JSON.stringify(body) : undefined})
  si resp.ok → return resp.json()
  sino → throw resp.statusText

App.upload(path, formData) →
  headers = {}
  si App.user → headers['X-Miau'] = App.user.username + '#' + App.user.secret
  return fetch('/api' + path, {method: 'POST', headers, body: formData})

// ─── REGISTRO ───
App.showRegistration() →
  mostrar formulario: nombre + selector de color + preview de avatar
  onChange nombre: actualizar avatar preview
  onSubmit:
    secret = crypto.randomUUID().slice(0,12)
    resp = App.api('POST', '/users', {username, secret: tripcode(secret), color, avatar_seed: randomInt()})
    si ok:
      localStorage.miau_user = JSON.stringify({username, secret, color, theme: 'Oscuro'})
      App.user = {username, secret, color, theme: 'Oscuro'}
      App.go('tweets')

// ─── TWEETS ───
App.enter_tweets() → App.loadTweets(1)
App.loadTweets(page) →
  tweets = App.api('GET', '/tweets?page=' + page + '&limit=20')
  si page == 1 → limpiar timeline
  para cada tweet → App.renderTweet(tweet, timeline)
  si tweets.length == 20 → mostrar "cargar más"

App.renderTweet(tweet, container) →
  el = crear div.tweet
  el.innerHTML = `
    <img class="avatar" src="/api/users/${tweet.user_id}/avatar.svg">
    <div>
      <b style="color:${colorHex(tweet.color)}">${esc(tweet.username)}</b>
      <small>${timeAgo(tweet.created_at)}</small>
      <p>${linkify(esc(tweet.content))}</p>
      <div class="actions">
        <button onclick="App.replyTo(${tweet.id})">💬 ${tweet.reply_count}</button>
        <button onclick="App.react('tweet',${tweet.id})">😻</button>
      </div>
    </div>
  `
  container.append(el)

App.createTweet(content, parentId?) →
  tweet = App.api('POST', '/tweets', {content, parent_id: parentId})
  App.renderTweet(tweet, timeline, prepend=true)

// ─── POSTS ───
App.enter_posts() → App.loadPosts(1)
App.loadPosts(page) →
  posts = App.api('GET', '/posts?page=' + page + '&limit=20')
  si page == 1 → limpiar feed
  para cada post → App.renderPost(post)

App.renderPost(post) →
  el = crear div.post
  el.innerHTML = `
    <div class="post-header">
      <img class="avatar" src="/api/users/${post.user_id}/avatar.svg">
      <b style="color:${colorHex(post.color)}">${esc(post.username)}</b>
    </div>
    <img class="post-image" src="/media/posts/${post.media_key}" loading="lazy">
    <p>${linkify(esc(post.caption))}</p>
    <div class="actions">
      <button onclick="App.react('post',${post.id})">😻</button>
      <button onclick="App.showComments(${post.id})">💬 ${post.comment_count}</button>
    </div>
  `
  feed.append(el)

App.createPost(file, caption) →
  blob = compressImage(file, 1080, 1080, 0.8)
  fd = new FormData()
  fd.append('image', blob, 'photo.webp')
  fd.append('caption', caption)
  App.upload('/posts', fd)

// ─── STORIES ───
App.enter_stories() → App.loadStories()
App.loadStories() →
  stories = App.api('GET', '/stories')
  // agrupar por user_id
  grouped = groupBy(stories, 'user_id')
  para cada user → renderStoryBubble(user, stories)

App.viewStories(userId, stories) →
  abrir visor fullscreen
  i = 0
  show(i)
  timer = setInterval(5000, () → i++, show(i))
  onTapRight: i++, show(i), resetTimer
  onTapLeft: i--, show(i), resetTimer
  show(idx):
    si idx >= stories.length → cerrar visor
    story = stories[idx]
    img.src = '/media/stories/' + story.media_key
    renderLayers(JSON.parse(story.layers_json))
    App.api('POST', '/stories/' + story.id + '/view')

// ─── CHAT ───
App.enter_chat() → App.loadConversations(); App.startPolling()
App.loadConversations() →
  convs = App.api('GET', '/chat/conversations')
  para cada conv → renderConversation(conv)

App.openChat(userId) →
  msgs = App.api('GET', '/chat/' + userId + '?limit=50')
  renderMessages(msgs)
  App.api('POST', '/chat/' + userId + '/read')

App.sendMessage(userId, content) →
  msg = App.api('POST', '/chat/' + userId, {content})
  renderMessage(msg, 'sent')

App.startPolling() →
  since = iso()
  interval = 5000
  poll():
    msgs = App.api('GET', '/chat/poll?since=' + since)
    si msgs.length > 0:
      since = msgs[msgs.length-1].created_at
      para cada msg → renderMessage(msg, 'received')
      interval = 5000  // volver a polling rápido
    sino:
      interval = min(interval * 1.5, 60000)  // back off
    setTimeout(poll, interval)
  poll()

// ─── STORY EDITOR ───
StoryEditor.open(bgImage) →
  compressImage(bgImage, 1080, 1920, 0.75).then(blob → {
    img.src = URL.createObjectURL(blob)
    drawCanvas = new Canvas(img.w, img.h)
    texts = []
    links = []
    mode = 'draw'
  })

StoryEditor.draw.start(x, y) → ctx.beginPath(); ctx.moveTo(x,y); drawing=true
StoryEditor.draw.move(x, y) → si drawing → ctx.lineTo(x,y); ctx.stroke()
StoryEditor.draw.end() → drawing = false

StoryEditor.addText(x, y) →
  div = crear div.story-text(contenteditable, x, y)
  makeDraggable(div)
  texts.push(div)

StoryEditor.addLink(x, y) →
  url = prompt('URL:')
  label = prompt('Label:')
  div = crear div.story-link(x, y, url, label)
  makeDraggable(div)
  links.push({div, url, label})

StoryEditor.export() →
  // compositar
  final = new Canvas(1080, 1920)
  final.drawImage(img)
  final.drawImage(drawCanvas)
  // textos se renderizan con html2canvas o measureText

  layers = {
    texts: texts.map(t → ({x: t.offsetLeft/container.w, y: t.offsetTop/container.h, text: t.innerText, ...styles})),
    links: links.map(l → ({x: l.div.offsetLeft/container.w, y: l.div.offsetTop/container.h, w: l.div.offsetWidth/container.w, h: l.div.offsetHeight/container.h, url: l.url, label: l.label}))
  }

  blob = compressImage(final, 1080, 1920, 0.75)
  fd = new FormData()
  fd.append('image', blob, 'story.webp')
  fd.append('layers', JSON.stringify(layers))
  App.upload('/stories', fd)

// ─── THEME ───
App.applyTheme(id) →
  tema = THEMES[id]
  root = document.documentElement.style
  Object.entries(tema).forEach(([k,v]) → root.setProperty('--'+k, v))

// ─── UTILS ───
makeDraggable(el) →
  el.onpointerdown = e → {
    startX = e.clientX - el.offsetLeft
    startY = e.clientY - el.offsetTop
    onpointermove = e → el.style.left = (e.clientX - startX) + 'px'; el.style.top = (e.clientY - startY) + 'px'
    onpointerup = () → removeEventListener
  }

groupBy(arr, key) → arr.reduce((m, x) → (m[x[key]] ??= []).push(x), m), {})

$(sel) → document.querySelector(sel)
$$(sel) → document.querySelectorAll(sel)
```

---

## REFACTORIZACIÓN: Patrones Encontrados

### Patrón 1: CRUD genérico
Todas las entidades siguen: list(page,limit), get(id), create(data), report/toggle(id).

```
// ANTES: 5 funciones por entidad × 4 entidades = 20 funciones
db.tweetList(page, limit) → SELECT ... FROM tweets ... LIMIT ? OFFSET ?
db.postList(page, limit)  → SELECT ... FROM posts  ... LIMIT ? OFFSET ?

// DESPUÉS: query builder parametrizado
db.list(table, {join, where, order, page, limit}) →
  SELECT ... FROM {table} {join} WHERE {where} ORDER BY {order} LIMIT {limit} OFFSET {(page-1)*limit}

// Pero OJO: esto añade complejidad innecesaria. Los queries son diferentes (joins, counts).
// DECISIÓN: mantener queries explícitos. Son ~2 líneas cada uno. La claridad vale más que la DRY.
```

### Patrón 2: Render genérico
Tweets y posts comparten: avatar + nombre coloreado + timeAgo + actions.

```
// Extraer: renderHeader(item) → avatar + username + time
renderHeader(item) →
  `<img class="avatar" src="/api/users/${item.user_id}/avatar.svg">
   <b style="color:${colorHex(item.color)}">${esc(item.username)}</b>
   <small>${timeAgo(item.created_at)}</small>`

// Cada modo añade su contenido específico
renderTweet(t) → renderHeader(t) + `<p>${linkify(esc(t.content))}</p>` + actions
renderPost(p) → renderHeader(p) + `<img src="...">` + `<p>...</p>` + actions
```

### Patrón 3: Feed paginado
Todos los feeds hacen lo mismo: cargar página, renderizar, botón "más".

```
// Extraer: loadFeed(endpoint, renderFn, container, page)
loadFeed(endpoint, renderFn, container, page) →
  items = App.api('GET', endpoint + '?page=' + page + '&limit=20')
  si page == 1 → container.innerHTML = ''
  items.forEach(item → container.append(renderFn(item)))
  si items.length == 20 → mostrar botón "más" con page+1
```

### Patrón 4: Auth header siempre igual
```
// Ya extraído en App.api() y App.upload()
// Un solo lugar donde se añade X-Miau header. Correcto.
```

### Patrón 5: Compresión con presets
```
// ANTES: cada sitio llama compressImage con params diferentes
compressImage(file, 1080, 1080, 0.8)   // posts
compressImage(file, 1080, 1920, 0.75)  // stories
compressImage(file, 800, 800, 0.7)     // chat

// DESPUÉS: presets con nombre
PRESETS = {
  post:  {maxW: 1080, maxH: 1080, quality: 0.8},
  story: {maxW: 1080, maxH: 1920, quality: 0.75},
  chat:  {maxW: 800,  maxH: 800,  quality: 0.7}
}
compress(file, preset) → compressImage(file, ...PRESETS[preset])
```

---

## RESULTADO FINAL: Funciones Necesarias

### Backend (4 archivos, ~800 líneas)

**middleware.ts (~80 líneas):**
- hash(text)
- tripcode(secret)
- esc(s)
- parseAuth(header)
- rateLimit(ip)
- auth(c)
- validateText(text, min, max)

**db.ts (~250 líneas):**
- 6 funciones user (create, get, getById, update, delete, list)
- 5 funciones tweet (list, get, replies, create, report)
- 5 funciones post (list, get, create, commentList, commentCreate)
- 2 funciones reaction (toggle, counts)
- 4 funciones story (list, create, view, cleanup)
- 5 funciones chat (convList, msgList, msgCreate, markRead, poll, unreadCount)
= 27 funciones de DB, promedio ~9 líneas cada una

**avatar.ts (~100 líneas):**
- seedRng(seed)
- catSvg(seed, color)

**index.ts (~300 líneas):**
- 20 rutas API, promedio ~15 líneas cada una

### Frontend (12 archivos, ~2500 líneas)

**app.js (~150 líneas):** init, go, showRegistration, applyTheme
**api.js (~30 líneas):** api, upload
**mode.tweets.js (~200 líneas):** enter, load, render, create, reply
**mode.posts.js (~250 líneas):** enter, load, render, create, comments
**mode.stories.js (~200 líneas):** enter, load, viewStories, show
**mode.chat.js (~300 líneas):** enter, loadConversations, openChat, send, poll
**story-editor.js (~350 líneas):** open, draw (start/move/end), addText, addLink, export
**media.js (~50 líneas):** compressImage, PRESETS, compress
**themes.js (~80 líneas):** THEMES, applyTheme
**colors.js (~60 líneas):** W3C subset, colorHex
**avatar.js (~50 líneas):** seedRng, catSvg (client mirror)
**toast.js (~30 líneas):** show

### Total: ~3300 líneas de código funcional

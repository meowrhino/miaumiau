import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './middleware'
import { auth, rateLimit, validateText, tripcode, esc } from './middleware'
import * as db from './db'
import { generateCatSvg, COLOR_NAMES } from './avatar'

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors())

// ─── Helpers ───
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' }
})
const err = (msg: string, status = 400) => json({ error: msg }, status)

// Telegram notification (fire-and-forget, never blocks)
function notify(env: Env, msg: string) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return
  const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
  }).catch(() => {}) // silent fail
}
const num = (v: string | undefined, fallback: number) => { const n = Number(v); return isNaN(n) ? fallback : n }

const requireAuth = async (c: any) => {
  const user = await auth(c)
  if (!user) return null
  return user
}

// ─── Users ───

app.get('/api/users', async (c) => {
  const users = await db.userList(c.env.DB)
  return json({ users: users.results, colors: COLOR_NAMES })
})

app.post('/api/users', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip, 5)) return err('Demasiadas peticiones', 429)

  const body = await c.req.json<{ username: string; secret: string; color: string; avatar_seed: number }>()
  const username = validateText(body.username, 1, 25)
  if (!username) return err('Nombre: 1-25 caracteres')
  if (!/^[a-zA-Z0-9_-]+$/.test(body.username)) return err('Nombre: solo letras, números, _ y -')
  if (!body.secret) return err('Falta secret')
  if (!COLOR_NAMES.includes(body.color)) return err('Color no válido')

  const existing = await db.userGet(c.env.DB, body.username)
  if (existing) return err('Nombre ya en uso')

  const trip = await tripcode(body.secret)
  const seed = body.avatar_seed || Math.floor(Math.random() * 0xFFFFFFFF)
  const user = await db.userCreate(c.env.DB, body.username, trip, body.color, seed)
  notify(c.env, `🐱 <b>nuevo gato!</b>\n${body.username} se ha unido a miaumiau (color: ${body.color})`)
  return json(user, 201)
})

app.put('/api/users/:id', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  if (user.id !== Number(c.req.param('id'))) return err('No autorizado', 403)

  const body = await c.req.json<{ color?: string; theme?: string; bio?: string; avatar_seed?: number }>()
  // Update avatar_seed if provided
  if (body.avatar_seed !== undefined) {
    await c.env.DB.prepare('UPDATE users SET avatar_seed = ? WHERE id = ?').bind(body.avatar_seed, user.id).run()
  }
  const updated = await db.userUpdate(c.env.DB, user.id,
    body.color ?? user.color,
    body.theme ?? user.theme,
    body.bio !== undefined ? esc(body.bio.slice(0, 200)) : user.bio
  )
  return json(updated)
})

app.post('/api/users/:id/key', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  if (user.id !== Number(c.req.param('id'))) return err('No autorizado', 403)

  const body = await c.req.json<{ new_secret: string }>()
  if (!body.new_secret || body.new_secret.length < 4 || body.new_secret.length > 32) {
    return err('Clave: 4-32 caracteres')
  }
  const newTrip = await tripcode(body.new_secret)
  await c.env.DB.prepare('UPDATE users SET tripcode = ? WHERE id = ?').bind(newTrip, user.id).run()
  return json({ ok: true })
})

app.delete('/api/users/:id', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  if (user.id !== Number(c.req.param('id'))) return err('No autorizado', 403)
  await db.userDelete(c.env.DB, user.id)
  return json({ ok: true })
})

app.get('/api/users/:id/avatar.svg', async (c) => {
  const user = await db.userGetById(c.env.DB, Number(c.req.param('id')))
  if (!user) return err('Usuario no encontrado', 404)
  const svg = generateCatSvg(user.avatar_seed, user.color)
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
  })
})

// ─── Tweets ───

app.get('/api/tweets', async (c) => {
  const page = num(c.req.query('page'), 1)
  const limit = Math.min(num(c.req.query('limit'), 20), 50)
  const tweets = await db.tweetList(c.env.DB, page, limit)
  return json(tweets.results)
})

app.get('/api/tweets/:id', async (c) => {
  const tweet = await db.tweetGet(c.env.DB, Number(c.req.param('id')))
  if (!tweet) return err('Tweet no encontrado', 404)
  const replies = await db.tweetReplies(c.env.DB, Number(c.req.param('id')))
  return json({ tweet, replies: replies.results })
})

app.post('/api/tweets', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip, 5)) return err('Demasiadas peticiones', 429)

  const body = await c.req.json<{ content: string; parent_id?: number }>()
  const content = validateText(body.content, 1, 1000)
  if (!content) return err('Contenido: 1-1000 caracteres')

  const tweet = await db.tweetCreate(c.env.DB, user.id, content, body.parent_id ?? null)
  notify(c.env, `💬 <b>${user.username}</b> miau:\n${content.slice(0, 200)}`)
  return json(tweet, 201)
})

app.post('/api/tweets/:id/report', async (c) => {
  await db.tweetReport(c.env.DB, Number(c.req.param('id')))
  return json({ ok: true })
})

// ─── Posts ───

app.get('/api/posts', async (c) => {
  const page = num(c.req.query('page'), 1)
  const limit = Math.min(num(c.req.query('limit'), 20), 50)
  const posts = await db.postList(c.env.DB, page, limit)
  return json(posts.results)
})

app.get('/api/posts/:id', async (c) => {
  const post = await db.postGet(c.env.DB, Number(c.req.param('id')))
  if (!post) return err('Post no encontrado', 404)
  const comments = await db.commentList(c.env.DB, Number(c.req.param('id')))
  return json({ post, comments: comments.results })
})

app.post('/api/posts', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip, 3)) return err('Demasiadas peticiones', 429)

  const form = await c.req.formData()
  const image = form.get('image') as File | null
  const caption = esc((form.get('caption') as string ?? '').slice(0, 500))
  if (!image) return err('Falta imagen')
  if (!image.type.startsWith('image/')) return err('Solo imágenes')
  if (image.size > 500_000) return err('Imagen demasiado grande (max 500KB)')

  const key = `p_${Date.now()}_${user.id}.webp`
  await c.env.STORAGE.put('media/posts/' + key, image.stream(), {
    httpMetadata: { contentType: 'image/webp' }
  })
  const post = await db.postCreate(c.env.DB, user.id, caption, key)
  notify(c.env, `📷 <b>${user.username}</b> nuevo post${caption ? ':\n' + caption.slice(0, 100) : ''}`)
  return json(post, 201)
})

app.post('/api/posts/:id/comments', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)

  const body = await c.req.json<{ content: string }>()
  const content = validateText(body.content, 1, 500)
  if (!content) return err('Contenido: 1-500 caracteres')

  const comment = await db.commentCreate(c.env.DB, Number(c.req.param('id')), user.id, content)
  return json(comment, 201)
})

// ─── BeReal ───

app.get('/api/bereal', async (c) => {
  const page = num(c.req.query('page'), 1)
  const limit = Math.min(num(c.req.query('limit'), 20), 50)
  const bereals = await c.env.DB.prepare(`
    SELECT b.*, u.username, u.color, u.avatar_seed
    FROM bereals b JOIN users u ON b.user_id = u.id
    ORDER BY b.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, (page - 1) * limit).all()
  return json(bereals.results)
})

app.post('/api/bereal', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip, 2)) return err('Demasiadas peticiones', 429)

  // Check if user already posted today
  const today = await c.env.DB.prepare(`
    SELECT id FROM bereals WHERE user_id = ? AND date(created_at) = date('now')
  `).bind(user.id).first()
  if (today) return err('Ya has publicado tu miau real hoy! vuelve manana')

  const form = await c.req.formData()
  const image = form.get('image') as File | null
  const caption = esc((form.get('caption') as string ?? '').slice(0, 200))
  if (!image) return err('Falta imagen')
  if (image.size > 500_000) return err('Imagen demasiado grande (max 500KB)')

  const key = `br_${Date.now()}_${user.id}.webp`
  await c.env.STORAGE.put('media/bereal/' + key, image.stream(), {
    httpMetadata: { contentType: 'image/webp' }
  })
  const bereal = await c.env.DB.prepare(
    'INSERT INTO bereals (user_id, media_key, caption) VALUES (?, ?, ?) RETURNING *'
  ).bind(user.id, key, caption).first()
  notify(c.env, `📸 <b>${user.username}</b> miau real${caption ? ':\n' + caption.slice(0, 100) : ''}`)
  return json(bereal, 201)
})

// ─── Reactions ───

app.post('/api/reactions', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)

  const body = await c.req.json<{ target_type: string; target_id: number; emoji?: string }>()
  if (!['tweet', 'post'].includes(body.target_type)) return err('Tipo no válido')
  const result = await db.reactionToggle(c.env.DB, user.id, body.target_type, body.target_id, body.emoji ?? '😻')
  return json({ toggled: !!result })
})

app.get('/api/reactions/:type/:id', async (c) => {
  const counts = await db.reactionCounts(c.env.DB, c.req.param('type'), Number(c.req.param('id')))
  return json(counts.results)
})

// ─── Stories ───

app.get('/api/stories', async (c) => {
  const stories = await db.storyList(c.env.DB)
  return json(stories.results)
})

app.post('/api/stories', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip, 3)) return err('Demasiadas peticiones', 429)

  const form = await c.req.formData()
  const image = form.get('image') as File | null
  const layers = (form.get('layers') as string) ?? '{}'
  if (!image) return err('Falta imagen')
  if (image.size > 300_000) return err('Imagen demasiado grande (max 300KB)')

  const key = `s_${Date.now()}_${user.id}.webp`
  await c.env.STORAGE.put('media/stories/' + key, image.stream(), {
    httpMetadata: { contentType: 'image/webp' }
  })
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString()
  const story = await db.storyCreate(c.env.DB, user.id, key, layers, expiresAt)
  return json(story, 201)
})

app.post('/api/stories/:id/view', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  await db.storyView(c.env.DB, Number(c.req.param('id')), user.id)
  return json({ ok: true })
})

// ─── Chat ───

app.get('/api/chat/conversations', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const convs = await db.conversationList(c.env.DB, user.id)
  return json(convs.results)
})

app.get('/api/chat/poll', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const since = c.req.query('since') ?? new Date(0).toISOString()
  const msgs = await db.messagePoll(c.env.DB, user.id, since)
  const unread = await db.unreadCount(c.env.DB, user.id)
  return json({ messages: msgs.results, unread: unread?.count ?? 0, serverTime: new Date().toISOString() })
})

app.get('/api/chat/:userId', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const otherId = Number(c.req.param('userId'))
  const before = c.req.query('before') ? Number(c.req.query('before')) : null
  const limit = Math.min(num(c.req.query('limit'), 50), 100)
  const msgs = await db.messageList(c.env.DB, user.id, otherId, before, limit)
  return json(msgs.results)
})

app.post('/api/chat/:userId', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip, 20)) return err('Demasiadas peticiones', 429)

  const receiverId = Number(c.req.param('userId'))
  const body = await c.req.json<{ content: string }>()
  const content = validateText(body.content, 1, 2000)
  if (!content) return err('Contenido: 1-2000 caracteres')

  const msg = await db.messageCreate(c.env.DB, user.id, receiverId, content, null)
  const receiver = await db.userGetById(c.env.DB, receiverId)
  notify(c.env, `✉️ <b>${user.username}</b> → <b>${receiver?.username ?? receiverId}</b>:\n${content.slice(0, 150)}`)
  return json(msg, 201)
})

app.post('/api/chat/:userId/read', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  await db.messageMarkRead(c.env.DB, user.id, Number(c.req.param('userId')))
  return json({ ok: true })
})

// ─── Friends ───

// Helper: get friend IDs for a user
async function getFriendIds(dbConn: D1Database, userId: number): Promise<number[]> {
  const rows = await dbConn.prepare(`
    SELECT CASE WHEN requester_id = ? THEN target_id ELSE requester_id END as friend_id
    FROM friendships WHERE status = 'accepted' AND (requester_id = ? OR target_id = ?)
  `).bind(userId, userId, userId).all<{ friend_id: number }>()
  return rows.results.map(r => r.friend_id)
}

app.get('/api/friends', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)

  const friends = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.color, u.avatar_seed, u.bio,
      CASE WHEN f.requester_id = ? THEN 'sent' ELSE 'received' END as direction
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.target_id ELSE f.requester_id END
    WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.target_id = ?)
  `).bind(user.id, user.id, user.id, user.id).all()

  const pending = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.color, u.avatar_seed, f.id as request_id
    FROM friendships f JOIN users u ON u.id = f.requester_id
    WHERE f.target_id = ? AND f.status = 'pending'
  `).bind(user.id).all()

  return json({ friends: friends.results, pending: pending.results })
})

app.post('/api/friends/request/:userId', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const targetId = Number(c.req.param('userId'))
  if (targetId === user.id) return err('No puedes ser amigo de ti mismo')

  // Check if already exists
  const existing = await c.env.DB.prepare(`
    SELECT id, status FROM friendships
    WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)
  `).bind(user.id, targetId, targetId, user.id).first<{ id: number; status: string }>()

  if (existing) {
    if (existing.status === 'accepted') return err('Ya sois amigos')
    return err('Solicitud ya enviada')
  }

  await c.env.DB.prepare('INSERT INTO friendships (requester_id, target_id) VALUES (?, ?)')
    .bind(user.id, targetId).run()
  const target = await db.userGetById(c.env.DB, targetId)
  notify(c.env, `🤝 <b>${user.username}</b> quiere ser amigo de <b>${target?.username ?? targetId}</b>`)
  return json({ ok: true }, 201)
})

app.post('/api/friends/accept/:requestId', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const requestId = Number(c.req.param('requestId'))
  await c.env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ? AND target_id = ?")
    .bind(requestId, user.id).run()
  return json({ ok: true })
})

app.post('/api/friends/reject/:requestId', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const requestId = Number(c.req.param('requestId'))
  await c.env.DB.prepare('DELETE FROM friendships WHERE id = ? AND target_id = ?')
    .bind(requestId, user.id).run()
  return json({ ok: true })
})

app.delete('/api/friends/:userId', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const otherId = Number(c.req.param('userId'))
  await c.env.DB.prepare(`
    DELETE FROM friendships
    WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)
  `).bind(user.id, otherId, otherId, user.id).run()
  return json({ ok: true })
})

// Search users (for adding friends)
app.get('/api/users/search', async (c) => {
  const q = c.req.query('q')
  if (!q || q.length < 1) return json([])
  const users = await c.env.DB.prepare(
    "SELECT id, username, color, avatar_seed, bio FROM users WHERE username LIKE ? LIMIT 10"
  ).bind('%' + q + '%').all()
  return json(users.results)
})

// ─── Media (R2) ───

app.get('/media/:path{.+}', async (c) => {
  const key = 'media/' + c.req.param('path')
  const obj = await c.env.STORAGE.get(key, { range: c.req.raw.headers })
  if (!obj) return err('No encontrado', 404)

  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=86400')
  headers.set('Accept-Ranges', 'bytes')
  if (obj.range && 'offset' in obj.range) {
    headers.set('Content-Range', `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length! - 1}/${obj.size}`)
    return new Response(obj.body, { status: 206, headers })
  }
  return new Response(obj.body, { headers })
})

// ─── Story Cleanup (scheduled) ───

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await db.storyCleanup(env.DB, env.STORAGE)
  }
}

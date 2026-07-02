import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, User } from './middleware'
import {
  auth, rateLimit, validateText, tripcode, esc,
  hashPassword, verifyPassword, issueToken, verifyToken, parseAuth,
  validateAccountName, validateDisplayName, validatePassword,
} from './middleware'
import * as db from './db'
import { generateCatSvg, colorHex, COLOR_NAMES } from './poporing'
import { ConversationDO } from './conversation'

// El DO debe re-exportarse desde el entrypoint del Worker.
export { ConversationDO }

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors())

// ─── Maintenance kill switch ───
// When system_flags.maintenance_mode = '1', refuse writes (POST/PUT/DELETE).
// GET still works (read-only mode). Telegram webhook is exempt so admin can toggle off.
app.use('/api/*', async (c, next) => {
  const method = c.req.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next()
  // Allow these endpoints even in maintenance (so admin can recover, users can see status)
  const path = new URL(c.req.url).pathname
  if (path === '/api/system') return next()
  const flag = await db.flagGet(c.env.DB, 'maintenance_mode').catch(() => null)
  if (flag?.value === '1') {
    return new Response(JSON.stringify({ error: 'miaumiau está en mantenimiento. vuelve en un rato 🐱', maintenance: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '300' },
    })
  }
  return next()
})

// ─── Helpers ───
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' }
})
const err = (msg: string, status = 400) => json({ error: msg }, status)

// Telegram: send message (returns promise)
function sendTelegram(env: Env, msg: string): Promise<void> {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return Promise.resolve()
  const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
  }).then(() => {}).catch(() => {})
}
// Fire-and-forget wrapper for non-webhook contexts
function notify(env: Env, msg: string) { sendTelegram(env, msg) }
const num = (v: string | undefined, fallback: number) => { const n = Number(v); return isNaN(n) ? fallback : n }

const requireAuth = async (c: any) => {
  const user = await auth(c)
  if (!user) return null
  return user
}

// Whitelist of accounts that may use admin endpoints. Server-side gate.
const ADMIN_ACCOUNTS = new Set(['manu'])

// Returns the user if admin, otherwise a Response with 401/403 ready to return.
const requireAdmin = async (c: any) => {
  const user = await auth(c)
  if (!user) return err('No autorizado', 401)
  const isAdmin = ADMIN_ACCOUNTS.has(user.account_name ?? '') || ADMIN_ACCOUNTS.has(user.username ?? '')
  if (!isAdmin) return err('Acceso restringido', 403)
  return user
}

// ─── Auth (v2) ───

app.post('/api/auth/register', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':register', 5)) return err('Demasiadas peticiones', 429)

  const body = await c.req.json<{
    account_name?: string; display_name?: string; password?: string;
    color?: string; avatar_seed?: number
  }>()
  const accountName = validateAccountName(body.account_name)
  if (!accountName) return err('Nombre de cuenta: 3-25 chars, solo a-z 0-9 _ -')
  const displayName = validateDisplayName(body.display_name)
  if (!displayName) return err('Nombre público: 1-25 chars')
  const password = validatePassword(body.password)
  if (!password) return err('Contraseña: 6-128 chars')
  if (!body.color || !COLOR_NAMES.includes(body.color)) return err('Color no válido')

  // Uniqueness checks
  const accExists = await db.userByAccountName(c.env.DB, accountName)
  if (accExists) return err('Nombre de cuenta ya en uso')
  const dispExists = await db.userByDisplayName(c.env.DB, displayName)
  if (dispExists) return err('Nombre público ya en uso')

  const passwordHash = await hashPassword(password)
  const seed = body.avatar_seed || Math.floor(Math.random() * 0xFFFFFFFF)
  const user = await db.userCreateV2(c.env.DB, accountName, displayName, passwordHash, body.color, seed)
  if (!user) return err('Error creando cuenta', 500)
  const token = await issueToken(c.env.AUTH_SECRET, user.id)
  notify(c.env, `🐱 <b>nuevo gato!</b>\n${displayName} (@${accountName}) se ha unido a miaumiau (color: ${body.color})`)
  return json({ user: publicUser(user), token }, 201)
})

app.post('/api/auth/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':login', 10)) return err('Demasiadas peticiones', 429)

  const body = await c.req.json<{ account_name?: string; password?: string }>()
  const accountName = validateAccountName(body.account_name)
  if (!accountName) return err('Cuenta o contraseña incorrectas', 401)
  const password = validatePassword(body.password)
  if (!password) return err('Cuenta o contraseña incorrectas', 401)

  const user = await db.userByAccountName(c.env.DB, accountName)
  if (!user || !user.password_hash) return err('Cuenta o contraseña incorrectas', 401)
  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return err('Cuenta o contraseña incorrectas', 401)

  const token = await issueToken(c.env.AUTH_SECRET, user.id)
  return json({ user: publicUser(user), token })
})

// Legacy v1 user → set v2 password (one-shot migration). Auth via X-Miau (legacy).
app.post('/api/auth/migrate', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':migrate', 5)) return err('Demasiadas peticiones', 429)

  const user = await auth(c)  // accepts X-Miau legacy
  if (!user) return err('No autorizado', 401)

  const body = await c.req.json<{ account_name?: string; display_name?: string; password?: string }>()
  const accountName = validateAccountName(body.account_name)
  if (!accountName) return err('Nombre de cuenta: 3-25 chars, solo a-z 0-9 _ -')
  const displayName = validateDisplayName(body.display_name)
  if (!displayName) return err('Nombre público: 1-25 chars')
  const password = validatePassword(body.password)
  if (!password) return err('Contraseña: 6-128 chars')

  // Check account_name uniqueness against OTHER users
  const accExists = await db.userByAccountName(c.env.DB, accountName)
  if (accExists && accExists.id !== user.id) return err('Nombre de cuenta ya en uso')
  const dispExists = await db.userByDisplayName(c.env.DB, displayName)
  if (dispExists && dispExists.id !== user.id) return err('Nombre público ya en uso')

  const passwordHash = await hashPassword(password)
  await c.env.DB.prepare(
    'UPDATE users SET account_name = ?, display_name = ?, password_hash = ? WHERE id = ?'
  ).bind(accountName, displayName, passwordHash, user.id).run()

  const updated = await db.userGetById(c.env.DB, user.id)
  if (!updated) return err('Error', 500)
  const token = await issueToken(c.env.AUTH_SECRET, updated.id)
  return json({ user: publicUser(updated), token })
})

// Strip private fields from user before sending to client
function publicUser(u: any) {
  return {
    id: u.id,
    account_name: u.account_name,
    username: u.display_name ?? u.username,  // alias for client compat
    display_name: u.display_name ?? u.username,
    color: u.color,
    theme: u.theme,
    avatar_seed: u.avatar_seed,
    bio: u.bio,
    created_at: u.created_at,
    needs_migration: !u.password_hash,  // client shows migrate prompt if true
  }
}

// ─── Users ───

app.get('/api/users', async (c) => {
  const users = await db.userList(c.env.DB)
  return json({ users: users.results, colors: COLOR_NAMES })
})

// Legacy v1 register — kept temporarily for clients that haven't updated.
// New clients should use /api/auth/register.
app.post('/api/users', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':register', 5)) return err('Demasiadas peticiones', 429)

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
  if (rateLimit(ip + ':tweet', 10)) return err('Demasiadas peticiones', 429)

  const body = await c.req.json<{ content: string; parent_id?: number }>()
  const content = validateText(body.content, 1, 1000)
  if (!content) return err('Contenido: 1-1000 caracteres')

  const tweet = await db.tweetCreate(c.env.DB, user.id, content, body.parent_id ?? null)
  notify(c.env, `💬 <b>${user.username}</b> miau:\n${content.slice(0, 200)}`)
  return json(tweet, 201)
})

app.post('/api/tweets/:id/report', async (c) => {
  const id = Number(c.req.param('id'))
  await db.tweetReport(c.env.DB, id)
  // Fetch context for the alert
  const tweet = await db.tweetGet(c.env.DB, id) as any
  if (tweet) {
    const reports = (tweet.reports ?? 0) + 1  // already incremented by query, fetch reflects it
    notify(c.env, `🚨 <b>tweet reportado</b> (${reports} reportes)\n@${tweet.username}: ${String(tweet.content).slice(0, 200)}\nLink: miaumiauonline.com/t/${id}`)
  }
  return json({ ok: true })
})

app.post('/api/posts/:id/report', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare(
    'UPDATE posts SET reports = reports + 1, hidden = CASE WHEN reports >= 4 THEN 1 ELSE hidden END WHERE id = ?'
  ).bind(id).run()
  const post = await db.postGet(c.env.DB, id) as any
  if (post) {
    const reports = (post.reports ?? 0)
    notify(c.env, `🚨 <b>post reportado</b> (${reports} reportes)\n@${post.username}: ${String(post.caption || '(sin caption)').slice(0, 200)}\nLink: miaumiauonline.com/p/${id}`)
  }
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
  if (rateLimit(ip + ':post', 5)) return err('Demasiadas peticiones', 429)

  const form = await c.req.formData()
  const image = form.get('image') as File | null
  const caption = esc((form.get('caption') as string ?? '').slice(0, 500))
  if (!image) return err('Falta imagen')
  if (image.type !== 'image/webp' && image.type !== 'image/jpeg') return err('Formato no soportado (webp o jpeg)')
  if (image.size > 500_000) return err('Imagen demasiado grande (max 500KB)')

  const ext = image.type === 'image/jpeg' ? 'jpg' : 'webp'
  const key = `p_${Date.now()}_${user.id}.${ext}`
  await c.env.STORAGE.put('media/posts/' + key, image.stream(), {
    httpMetadata: { contentType: image.type }
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

// ─── City Presence ───

const ZONE_VALID = new Set(['tweets','posts','stories','chat','bereal','profile','plaza','city'])

app.post('/api/city/presence', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':presence', 60)) return err('Demasiadas peticiones', 429)
  const body = await c.req.json<{ zone?: string | null; x?: number; y?: number }>()
  const zone = body.zone && ZONE_VALID.has(body.zone) ? body.zone : null
  const x = Math.max(0, Math.min(1280, Number(body.x) || 640))
  const y = Math.max(0, Math.min(720, Number(body.y) || 374))
  await db.presenceUpsert(c.env.DB, user.id, zone, x, y)
  return json({ ok: true })
})

app.get('/api/city/presence', async (c) => {
  // No auth required — anyone in the city sees other inhabitants
  const rows = await db.presenceList(c.env.DB, 90)
  return json(rows.results)
})

app.delete('/api/city/presence', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  await db.presenceClear(c.env.DB, user.id)
  return json({ ok: true })
})

// ─── City waves: ephemeral "decir hola" broadcast (sesión 10) ───

app.post('/api/city/wave', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':wave', 20)) return err('demasiados saludos', 429)
  const body = await c.req.json<{ to_user_id?: number }>()
  const toId = Number(body.to_user_id)
  if (!toId || toId === user.id) return err('destinatario inválido', 400)
  await db.waveInsert(c.env.DB, user.id, toId)
  // Best-effort cleanup so the table doesn't grow forever
  c.executionCtx.waitUntil(db.waveCleanup(c.env.DB))
  return json({ ok: true })
})

app.get('/api/city/waves', async (c) => {
  // Public — anyone in the city sees the heart bubbles
  const rows = await db.waveListRecent(c.env.DB, 8)
  return json(rows.results)
})

// ─── City chat EN VIVO (motor rumrum): WebSocket → ConversationDO ───
// Una sala por zona del mapa (sala = zona actual, o 'plaza'). El navegador no
// puede mandar headers en un WebSocket, así que la credencial viaja en el
// query: ?token=<bearer v2> o ?miau=<username#secret legacy>. El Worker valida
// aquí y reenvía al DO con `name`/`color` YA verificados (el DO se fía del
// query porque solo se llega a él a través de esta ruta).

app.get('/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') return err('se esperaba un websocket', 426)
  const url = new URL(c.req.url)

  let user: User | null = null
  const token = url.searchParams.get('token')
  const legacy = url.searchParams.get('miau')
  if (token) {
    const decoded = await verifyToken(c.env.AUTH_SECRET, token)
    if (decoded) {
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(decoded.userId).first<User>()
    }
  } else if (legacy) {
    const parsed = parseAuth(legacy)
    if (parsed) {
      const u = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
        .bind(parsed.username).first<User>()
      if (u && u.tripcode && (await tripcode(parsed.secret)) === u.tripcode) user = u
    }
  }
  if (!user) return err('No autorizado', 401)

  const roomParam = url.searchParams.get('room') ?? 'plaza'
  const room = ZONE_VALID.has(roomParam) ? roomParam : 'plaza'

  const fwd = new URL(c.req.url)
  fwd.searchParams.delete('token')
  fwd.searchParams.delete('miau')
  fwd.searchParams.set('room', room)
  fwd.searchParams.set('name', user.display_name ?? user.username ?? 'gato#' + user.id)
  fwd.searchParams.set('color', colorHex(user.color))

  const id = c.env.CITY_CHAT.idFromName(room)
  return c.env.CITY_CHAT.get(id).fetch(new Request(fwd.toString(), c.req.raw))
})

// ─── City chat: ephemeral proximity bubbles over avatars (sesión 13) ───

app.post('/api/city/chat', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':citychat', 20)) return err('demasiados mensajes, baja el ritmo 🐱', 429)
  const body = await c.req.json<{ content?: string; zone?: string | null }>()
  const content = validateText(body.content, 1, 120)
  if (!content) return err('mensaje: 1-120 caracteres')
  const zone = body.zone && ZONE_VALID.has(body.zone) ? body.zone : null
  await db.cityChatInsert(c.env.DB, user.id, zone, content)
  // Best-effort cleanup so the table doesn't grow forever
  c.executionCtx.waitUntil(db.cityChatCleanup(c.env.DB))
  return json({ ok: true }, 201)
})

app.get('/api/city/chat', async (c) => {
  // Public — anyone in the city sees the speech bubbles
  const rows = await db.cityChatListRecent(c.env.DB, 12)
  return json(rows.results)
})

// ─── Calendar events (sesión 12) ───
// Public: returns all upcoming events. Admins manage the table via /api/admin/events.

app.get('/api/events', async (c) => {
  const rows = await db.adminEventList(c.env.DB)
  return json(rows.results)
})

app.get('/api/admin/events', async (c) => {
  const user = await requireAdmin(c)
  if (user instanceof Response) return user
  const rows = await db.adminEventList(c.env.DB)
  return json(rows.results)
})

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

app.post('/api/admin/events', async (c) => {
  const user = await requireAdmin(c)
  if (user instanceof Response) return user
  const body = await c.req.json<{ date: string; title: string; desc?: string; emoji?: string }>()
  if (!isValidDate(body.date)) return err('fecha inválida (YYYY-MM-DD)')
  const title = validateText(body.title, 1, 80)
  if (!title) return err('título: 1-80 caracteres')
  const desc  = (body.desc  ?? '').toString().slice(0, 240)
  const emoji = (body.emoji ?? '📅').toString().slice(0, 8) || '📅'
  const row = await db.adminEventCreate(c.env.DB, body.date, title, desc, emoji)
  return json(row, 201)
})

app.put('/api/admin/events/:id', async (c) => {
  const user = await requireAdmin(c)
  if (user instanceof Response) return user
  const body = await c.req.json<{ date: string; title: string; desc?: string; emoji?: string }>()
  if (!isValidDate(body.date)) return err('fecha inválida (YYYY-MM-DD)')
  const title = validateText(body.title, 1, 80)
  if (!title) return err('título: 1-80 caracteres')
  const desc  = (body.desc  ?? '').toString().slice(0, 240)
  const emoji = (body.emoji ?? '📅').toString().slice(0, 8) || '📅'
  const row = await db.adminEventUpdate(c.env.DB, Number(c.req.param('id')), body.date, title, desc, emoji)
  if (!row) return err('no encontrado', 404)
  return json(row)
})

app.delete('/api/admin/events/:id', async (c) => {
  const user = await requireAdmin(c)
  if (user instanceof Response) return user
  await db.adminEventDelete(c.env.DB, Number(c.req.param('id')))
  return json({ ok: true })
})

// ─── System status (maintenance flag) ───

app.get('/api/system', async (c) => {
  const flag = await db.flagGet(c.env.DB, 'maintenance_mode')
  return json({ maintenance: flag?.value === '1' })
})

// ─── Tracking (analytics) ───
// Fire-and-forget event log. Auth optional (anon allowed). Rate limited per IP.
app.post('/api/track', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':track', 120)) return new Response(null, { status: 204 })
  const user = await auth(c)  // optional
  const body = await c.req.json<{ kind?: string; props?: unknown }>().catch(() => ({}))
  const kind = typeof body.kind === 'string' ? body.kind.slice(0, 64) : null
  if (!kind) return new Response(null, { status: 204 })
  // Best-effort write — never blocks the client
  try { await db.eventInsert(c.env.DB, user?.id ?? null, kind, body.props ?? null) } catch (_) {}
  return new Response(null, { status: 204 })
})

// ─── Admin Stats (owner-only) ───
app.get('/api/admin/stats', async (c) => {
  const user = await requireAdmin(c)
  if (user instanceof Response) return user
  const data = await db.stats(c.env.DB)
  return json(data)
})

// ─── BeReal ───

app.get('/api/bereal', async (c) => {
  const page = num(c.req.query('page'), 1)
  const limit = Math.min(num(c.req.query('limit'), 20), 50)
  const bereals = await c.env.DB.prepare(`
    SELECT b.*, COALESCE(u.display_name, u.username) AS username, u.color, u.avatar_seed
    FROM bereals b JOIN users u ON b.user_id = u.id
    ORDER BY b.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, (page - 1) * limit).all()
  return json(bereals.results)
})

app.post('/api/bereal', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':bereal', 5)) return err('Demasiadas peticiones', 429)

  // Check if user already posted today
  const today = await c.env.DB.prepare(`
    SELECT id FROM bereals WHERE user_id = ? AND date(created_at) = date('now')
  `).bind(user.id).first()
  if (today) return err('Ya has publicado tu miau real hoy! vuelve manana')

  const form = await c.req.formData()
  const image = form.get('image') as File | null
  const caption = esc((form.get('caption') as string ?? '').slice(0, 200))
  if (!image) return err('Falta imagen')
  if (image.type !== 'image/webp' && image.type !== 'image/jpeg') return err('Formato no soportado (webp o jpeg)')
  if (image.size > 500_000) return err('Imagen demasiado grande (max 500KB)')

  const ext = image.type === 'image/jpeg' ? 'jpg' : 'webp'
  const key = `br_${Date.now()}_${user.id}.${ext}`
  await c.env.STORAGE.put('media/bereal/' + key, image.stream(), {
    httpMetadata: { contentType: image.type }
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
  if (!['tweet', 'post', 'story', 'bereal'].includes(body.target_type)) return err('Tipo no válido')
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
  if (rateLimit(ip + ':story', 5)) return err('Demasiadas peticiones', 429)

  const form = await c.req.formData()
  const image = form.get('image') as File | null
  const layers = (form.get('layers') as string) ?? '{}'
  if (!image) return err('Falta imagen')
  if (image.type !== 'image/webp' && image.type !== 'image/jpeg') return err('Formato no soportado (webp o jpeg)')
  if (image.size > 300_000) return err('Imagen demasiado grande (max 300KB)')

  const ext = image.type === 'image/jpeg' ? 'jpg' : 'webp'
  const key = `s_${Date.now()}_${user.id}.${ext}`
  await c.env.STORAGE.put('media/stories/' + key, image.stream(), {
    httpMetadata: { contentType: image.type }
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

// Story comments (sesión 11) — short replies that decorate the viewer.
app.get('/api/stories/:id/comments', async (c) => {
  const rows = await db.storyCommentList(c.env.DB, Number(c.req.param('id')))
  return json(rows.results)
})

app.post('/api/stories/:id/comments', async (c) => {
  const user = await requireAuth(c)
  if (!user) return err('No autorizado', 401)
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (rateLimit(ip + ':storycmt', 30)) return err('Demasiados comentarios', 429)
  const body = await c.req.json<{ content: string }>()
  const content = validateText(body.content, 1, 200)
  if (!content) return err('Contenido: 1-200 caracteres')
  const row = await db.storyCommentCreate(c.env.DB, Number(c.req.param('id')), user.id, content)
  return json(row, 201)
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
  if (rateLimit(ip + ':chat', 30)) return err('Demasiadas peticiones', 429)

  const receiverId = Number(c.req.param('userId'))
  if (!Number.isFinite(receiverId) || receiverId <= 0) return err('Usuario inválido')
  if (receiverId === user.id) return err('No puedes chatearte a ti mismo')
  const receiver = await db.userGetById(c.env.DB, receiverId)
  if (!receiver) return err('Usuario no encontrado', 404)

  const body = await c.req.json<{ content: string }>()
  const content = validateText(body.content, 1, 2000)
  if (!content) return err('Contenido: 1-2000 caracteres')

  const msg = await db.messageCreate(c.env.DB, user.id, receiverId, content, null)
  notify(c.env, `✉️ <b>${user.username}</b> → <b>${receiver.username}</b>:\n${content.slice(0, 150)}`)
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
    SELECT u.id, COALESCE(u.display_name, u.username) AS username, u.color, u.avatar_seed, u.bio,
      CASE WHEN f.requester_id = ? THEN 'sent' ELSE 'received' END as direction
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.target_id ELSE f.requester_id END
    WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.target_id = ?)
  `).bind(user.id, user.id, user.id, user.id).all()

  const pending = await c.env.DB.prepare(`
    SELECT u.id, COALESCE(u.display_name, u.username) AS username, u.color, u.avatar_seed, f.id as request_id
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

// Search users (for adding friends) — searches display_name AND legacy username
app.get('/api/users/search', async (c) => {
  const q = c.req.query('q')
  if (!q || q.length < 1) return json([])
  const users = await c.env.DB.prepare(
    `SELECT id, COALESCE(display_name, username) AS username, color, avatar_seed, bio
     FROM users
     WHERE display_name LIKE ? OR username LIKE ?
     LIMIT 10`
  ).bind('%' + q + '%', '%' + q + '%').all()
  return json(users.results)
})

// ─── Public pages (OG-ready HTML + JSON API) ───

const ATTR_MAP: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}
const attr = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ATTR_MAP[c])
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')
// DB text is stored pre-escaped via esc(); decode for lengths/previews
const UNESC_MAP: Record<string, string> = {amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}
const unesc = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => UNESC_MAP[e])
const clip = (s: string, n: number) => { const t = unesc(s); return t.length > n ? t.slice(0, n - 1) + '…' : t }

async function renderPublicHtml(env: Env, req: Request, ctx: {
  title: string
  description: string
  image: string
  url: string
  type?: 'profile' | 'article' | 'website'
  bootstrap: unknown
}): Promise<Response> {
  const assetReq = new Request(new URL('/index.html', req.url).toString())
  const assetRes = await env.ASSETS.fetch(assetReq)
  let html = await assetRes.text()

  const meta = `<title>${attr(ctx.title)}</title>
  <meta name="description" content="${attr(ctx.description)}">
  <meta property="og:title" content="${attr(ctx.title)}">
  <meta property="og:description" content="${attr(ctx.description)}">
  <meta property="og:image" content="${attr(ctx.image)}">
  <meta property="og:url" content="${attr(ctx.url)}">
  <meta property="og:type" content="${ctx.type ?? 'website'}">
  <meta property="og:site_name" content="miaumiau">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(ctx.title)}">
  <meta name="twitter:description" content="${attr(ctx.description)}">
  <meta name="twitter:image" content="${attr(ctx.image)}">
  <link rel="canonical" href="${attr(ctx.url)}">
  <script>window.__PUBLIC_CONTEXT__ = ${safeJson(ctx.bootstrap)};</script>`

  html = html.replace(/<!-- meta:start -->[\s\S]*?<!-- meta:end -->/, meta)
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
  })
}

app.get('/api/public/users/:username', async (c) => {
  const username = c.req.param('username')
  const user = await db.userGet(c.env.DB, username)
  if (!user) return err('Usuario no encontrado', 404)

  const [tweets, posts, bereals] = await Promise.all([
    c.env.DB.prepare(`
      SELECT t.*, COALESCE(u.display_name, u.username) AS username, u.color, u.avatar_seed,
        (SELECT COUNT(*) FROM tweets r WHERE r.parent_id = t.id) as reply_count
      FROM tweets t JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ? AND t.parent_id IS NULL AND t.hidden = 0
      ORDER BY t.created_at DESC LIMIT 30
    `).bind(user.id).all(),
    c.env.DB.prepare(`
      SELECT p.*, COALESCE(u.display_name, u.username) AS username, u.color, u.avatar_seed,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comment_count
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.hidden = 0
      ORDER BY p.created_at DESC LIMIT 24
    `).bind(user.id).all(),
    c.env.DB.prepare(`
      SELECT b.*, COALESCE(u.display_name, u.username) AS username, u.color, u.avatar_seed
      FROM bereals b JOIN users u ON b.user_id = u.id
      WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 24
    `).bind(user.id).all().catch(() => ({ results: [] }))
  ])

  return json({
    user: {
      id: user.id, username: user.display_name ?? user.username, color: user.color,
      avatar_seed: user.avatar_seed, bio: user.bio, created_at: user.created_at
    },
    tweets: tweets.results,
    posts: posts.results,
    bereals: (bereals as any).results ?? []
  })
})

app.get('/u/:username', async (c) => {
  const username = c.req.param('username')
  const user = await db.userGet(c.env.DB, username)
  const url = new URL(c.req.url)
  if (!user) {
    return renderPublicHtml(c.env, c.req.raw, {
      title: `${username} no existe · miaumiau`,
      description: 'este gato no existe en miaumiau',
      image: `${url.origin}/favicon/favicon-32x32.png`,
      url: url.href,
      bootstrap: { kind: 'user_not_found', username }
    })
  }
  const bioText = user.bio ? unesc(user.bio) : ''
  return renderPublicHtml(c.env, c.req.raw, {
    title: `@${user.username} · miaumiau`,
    description: bioText || `el espacio de ${user.username} en miaumiau`,
    image: `${url.origin}/api/users/${user.id}/avatar.svg`,
    url: url.href,
    type: 'profile',
    bootstrap: { kind: 'user', username: user.username }
  })
})

app.get('/p/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const post = await db.postGet(c.env.DB, id) as any
  const url = new URL(c.req.url)
  if (!post) {
    return renderPublicHtml(c.env, c.req.raw, {
      title: 'post no encontrado · miaumiau',
      description: 'este post ya no existe',
      image: `${url.origin}/favicon/favicon-32x32.png`,
      url: url.href,
      bootstrap: { kind: 'post_not_found', id }
    })
  }
  const caption = post.caption ? clip(post.caption, 60) : ''
  return renderPublicHtml(c.env, c.req.raw, {
    title: caption ? `${caption} · @${post.username}` : `foto de @${post.username} · miaumiau`,
    description: caption || `una foto de ${post.username} en miaumiau`,
    image: `${url.origin}/media/posts/${post.media_key}`,
    url: url.href,
    type: 'article',
    bootstrap: { kind: 'post', id: post.id }
  })
})

app.get('/t/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const tweet = await db.tweetGet(c.env.DB, id) as any
  const url = new URL(c.req.url)
  if (!tweet) {
    return renderPublicHtml(c.env, c.req.raw, {
      title: 'miau no encontrado · miaumiau',
      description: 'este miau ya no existe',
      image: `${url.origin}/favicon/favicon-32x32.png`,
      url: url.href,
      bootstrap: { kind: 'tweet_not_found', id }
    })
  }
  const preview = clip(tweet.content, 200)
  return renderPublicHtml(c.env, c.req.raw, {
    title: `@${tweet.username}: ${clip(tweet.content, 60)} · miaumiau`,
    description: preview,
    image: `${url.origin}/api/users/${tweet.user_id}/avatar.svg`,
    url: url.href,
    type: 'article',
    bootstrap: { kind: 'tweet', id: tweet.id }
  })
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

// ─── Telegram Bot Webhook ───

app.post('/telegram/webhook', async (c) => {
  const body = await c.req.json<any>()
  const msg = body?.message
  if (!msg?.text || !msg?.chat?.id) return json({ ok: true })

  const chatId = String(msg.chat.id)
  const text = msg.text.trim().toLowerCase()

  // Only respond to the admin
  if (chatId !== c.env.TELEGRAM_CHAT_ID) return json({ ok: true })

  if (text === '/stats' || text === 'stats' || text === 'estado') {
    const d = c.env.DB
    const [users, tweets, posts, bereals, messages, convs, friendsAccepted, friendsPending] = await Promise.all([
      d.prepare('SELECT COUNT(*) as c FROM users').first<{c:number}>(),
      d.prepare('SELECT COUNT(*) as c FROM tweets').first<{c:number}>(),
      d.prepare('SELECT COUNT(*) as c FROM posts').first<{c:number}>(),
      d.prepare('SELECT COUNT(*) as c FROM bereals').first<{c:number}>(),
      d.prepare('SELECT COUNT(*) as c FROM messages').first<{c:number}>(),
      d.prepare('SELECT COUNT(*) as c FROM conversations').first<{c:number}>(),
      d.prepare("SELECT COUNT(*) as c FROM friendships WHERE status = 'accepted'").first<{c:number}>(),
      d.prepare("SELECT COUNT(*) as c FROM friendships WHERE status = 'pending'").first<{c:number}>(),
    ])

    // Recent users (last 7 days)
    const recent = await d.prepare(
      "SELECT COALESCE(display_name, username) AS username, color, created_at FROM users ORDER BY created_at DESC LIMIT 10"
    ).all<{username:string, color:string, created_at:string}>()

    const userList = recent.results.map(u =>
      `  · <b>${u.username}</b> (${u.color}) — ${u.created_at.slice(0,10)}`
    ).join('\n')

    // Stories active
    const stories = await d.prepare("SELECT COUNT(*) as c FROM stories WHERE expires_at > datetime('now')").first<{c:number}>()

    const reply = `📊 <b>miaumiau stats</b>\n\n` +
      `👤 <b>${users?.c ?? 0}</b> usuarios\n` +
      `💬 <b>${tweets?.c ?? 0}</b> miaus\n` +
      `📷 <b>${posts?.c ?? 0}</b> posts\n` +
      `📸 <b>${bereals?.c ?? 0}</b> miau reals\n` +
      `🔥 <b>${stories?.c ?? 0}</b> stories activas\n` +
      `✉️ <b>${messages?.c ?? 0}</b> mensajes en <b>${convs?.c ?? 0}</b> chats\n` +
      `🤝 <b>${friendsAccepted?.c ?? 0}</b> amistades · <b>${friendsPending?.c ?? 0}</b> pendientes\n\n` +
      `<b>ultimos usuarios:</b>\n${userList}`

    await sendTelegram(c.env, reply)
    return json({ ok: true })
  }

  if (text === '/help' || text === 'help' || text === 'ayuda') {
    await sendTelegram(c.env, `🐱 <b>miaumiau bot</b>\n\nComandos:\n· <b>stats</b> / <b>estado</b> — estadisticas completas\n· <b>maintenance on/off</b> — kill switch (devuelve 503 a todos)\n· <b>ayuda</b> — este mensaje\n\nRecibo alertas automaticas de toda la actividad.`)
    return json({ ok: true })
  }

  if (text.startsWith('maintenance') || text.startsWith('/maintenance')) {
    const arg = text.replace(/^\/?maintenance\s*/, '').trim()
    if (arg === 'on' || arg === '1' || arg === 'true') {
      await db.flagSet(c.env.DB, 'maintenance_mode', '1')
      await sendTelegram(c.env, `🛑 <b>maintenance ON</b>\nLa app está en modo mantenimiento. Solo lectura.`)
      return json({ ok: true })
    }
    if (arg === 'off' || arg === '0' || arg === 'false') {
      await db.flagSet(c.env.DB, 'maintenance_mode', '0')
      await sendTelegram(c.env, `✅ <b>maintenance OFF</b>\nApp restaurada.`)
      return json({ ok: true })
    }
    const cur = await db.flagGet(c.env.DB, 'maintenance_mode')
    await sendTelegram(c.env, `maintenance está <b>${cur?.value === '1' ? 'ON' : 'OFF'}</b>\nUsa <b>maintenance on</b> o <b>maintenance off</b>`)
    return json({ ok: true })
  }

  // Unknown command
  await sendTelegram(c.env, `miau? no entiendo. escribe <b>stats</b> o <b>ayuda</b>`)
  return json({ ok: true })
})

// ─── SPA catch-all: serve index.html for app routes (/tweets, /stories, etc.) ───
// Static assets (CSS, JS, images) are auto-served by the [assets] binding before this handler runs.
const SPA_ROUTES = new Set(['', 'tweets', 'stories', 'posts', 'chat', 'bereal', 'profile', 'city', 'admin'])
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  const path = url.pathname
  // Skip API/media/telegram (already 404'd by Hono if we got here)
  if (path.startsWith('/api/') || path.startsWith('/media/') || path.startsWith('/telegram')) {
    return err('No encontrado', 404)
  }
  // For SPA routes (and unknown routes), return index.html shell so the SPA boots
  const head = path.replace(/^\/|\/$/g, '').split('/')[0]
  if (SPA_ROUTES.has(head)) {
    const assetReq = new Request(new URL('/index.html', c.req.url).toString())
    const res = await c.env.ASSETS.fetch(assetReq)
    // Pass through but ensure cache headers don't pin a stale shell
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  }
  return err('No encontrado', 404)
})

// ─── Scheduled cleanup ───
// Runs on the cron defined in wrangler.toml. Trims expired stories (and their R2
// blobs), drops analytics events older than 90 days, and clears stale wave rows.

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await db.storyCleanup(env.DB, env.STORAGE)
    await env.DB.prepare("DELETE FROM events     WHERE created_at < datetime('now', '-90 days')").run()
    await env.DB.prepare("DELETE FROM city_waves WHERE created_at < datetime('now', '-1 hour')").run()
    await env.DB.prepare("DELETE FROM city_chat  WHERE created_at < datetime('now', '-1 hour')").run()
  }
}

// /api/v2/auth/* — register, login, logout.
import { Hono } from 'hono'
import {
  type Env, hashPassword, verifyPassword, issueToken,
  validateAccountName, validateDisplayName, validatePassword,
} from '../../middleware'
import { json, ok, err, readJson, clientIp } from '../util'
import { setSessionCookie, clearSessionCookie } from '../session'
import { rateLimit } from '../../middleware'

const auth = new Hono<{ Bindings: Env }>()

auth.post('/register', async (c) => {
  if (rateLimit(clientIp(c), 5, 60_000)) return err('demasiados intentos', 429)
  const body = await readJson<{ name?: string; password?: string }>(c)
  if (!body) return err('json inválido')

  const account = validateAccountName(body.name)
  const display = validateDisplayName(body.name)
  const password = validatePassword(body.password)
  if (!account || !display || !password) return err('nombre o contraseña inválidos')

  const taken = await c.env.DB
    .prepare('SELECT id FROM users WHERE account_name = ? OR LOWER(display_name) = LOWER(?)')
    .bind(account, display).first()
  if (taken) return err('nombre ya en uso', 409)

  const hash = await hashPassword(password)
  const seed = Math.floor(Math.random() * 1_000_000)
  // username (legacy v1) duplica account_name por NOT NULL en DBs antiguas;
  // a efectos v2 no se usa para login.
  const r = await c.env.DB
    .prepare(`INSERT INTO users (username, account_name, display_name, password_hash, avatar_seed, color)
              VALUES (?, ?, ?, ?, ?, 'Coral') RETURNING id`)
    .bind(account, account, display, hash, seed).first<{ id: number }>()
  if (!r) return err('no se pudo crear', 500)

  const token = await issueToken(c.env.AUTH_SECRET, r.id)
  return new Response(JSON.stringify({ id: r.id, name: display }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': setSessionCookie(token, c.req.url) },
  })
})

auth.post('/login', async (c) => {
  if (rateLimit(clientIp(c), 10, 60_000)) return err('demasiados intentos', 429)
  const body = await readJson<{ name?: string; password?: string }>(c)
  if (!body) return err('json inválido')

  const account = validateAccountName(body.name)
  if (!account || typeof body.password !== 'string') return err('credenciales inválidas', 401)

  const user = await c.env.DB
    .prepare('SELECT id, password_hash, display_name FROM users WHERE account_name = ?')
    .bind(account).first<{ id: number; password_hash: string; display_name: string }>()
  if (!user?.password_hash) return err('credenciales inválidas', 401)

  const okPw = await verifyPassword(body.password, user.password_hash)
  if (!okPw) return err('credenciales inválidas', 401)

  await c.env.DB.prepare('UPDATE users SET last_seen_at = datetime(\'now\') WHERE id = ?')
    .bind(user.id).run()

  const token = await issueToken(c.env.AUTH_SECRET, user.id)
  return new Response(JSON.stringify({ id: user.id, name: user.display_name }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': setSessionCookie(token, c.req.url) },
  })
})

auth.post('/logout', async (c) => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie(c.req.url) },
  })
})

export default auth

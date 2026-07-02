import type { Context } from 'hono'

// ─── Tipos ───
export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  ASSETS: Fetcher
  CITY_CHAT: DurableObjectNamespace
  TELEGRAM_TOKEN: string
  TELEGRAM_CHAT_ID: string
  AUTH_SECRET: string
}

export interface User {
  id: number
  // Legacy v1
  username: string | null
  tripcode: string | null
  // v2
  account_name: string | null
  display_name: string | null
  password_hash: string | null
  // Common
  color: string
  theme: string
  avatar_seed: number
  bio: string
  created_at: string
  last_seen_at: string
}

// ─── Crypto: tripcode (legacy v1) ───
export async function tripcode(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let num = 0n
  for (const b of bytes) num = (num << 8n) | BigInt(b)
  return num.toString(36).slice(0, 8)
}

// ─── Crypto: passwords (v2 — PBKDF2 SHA-256 via WebCrypto) ───
const PBKDF2_ITER = 100_000

const b64enc = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const b64dec = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256
  )
  return `pbkdf2$${PBKDF2_ITER}$${b64enc(salt)}$${b64enc(new Uint8Array(bits))}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iter = Number(parts[1])
  const salt = b64dec(parts[2])
  const expected = parts[3]
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256
  )
  // Constant-time-ish compare
  const got = b64enc(new Uint8Array(bits))
  if (got.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

// ─── Crypto: bearer tokens (v2 — HMAC-SHA256, no session table) ───
// Token format: base64url(`${userId}.${exp}`).${base64url(hmac)}
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30 // 30 days

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return b64enc(new Uint8Array(sig))
}

export async function issueToken(secret: string, userId: number, ttlSec = TOKEN_TTL_SEC): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const payload = `${userId}.${exp}`
  const sig = await hmac(secret, payload)
  return `${b64enc(new TextEncoder().encode(payload))}.${sig}`
}

export async function verifyToken(secret: string, token: string): Promise<{ userId: number; exp: number } | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  let payload: string
  try { payload = new TextDecoder().decode(b64dec(parts[0])) } catch { return null }
  const [userIdStr, expStr] = payload.split('.')
  const userId = Number(userIdStr)
  const exp = Number(expStr)
  if (!Number.isFinite(userId) || !Number.isFinite(exp)) return null
  if (exp < Math.floor(Date.now() / 1000)) return null
  const expectedSig = await hmac(secret, payload)
  if (parts[1].length !== expectedSig.length) return null
  let diff = 0
  for (let i = 0; i < expectedSig.length; i++) diff |= parts[1].charCodeAt(i) ^ expectedSig.charCodeAt(i)
  if (diff !== 0) return null
  return { userId, exp }
}

// ─── Sanitize ───
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ESC[c])

// ─── Parse legacy auth header ───
export function parseAuth(header: string): { username: string; secret: string } | null {
  const i = header.indexOf('#')
  if (i < 1) return null
  return { username: header.slice(0, i), secret: header.slice(i + 1) }
}

// ─── Rate Limit ───
const buckets = new Map<string, { count: number; reset: number }>()

export function rateLimit(ip: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now()
  let b = buckets.get(ip)
  if (!b || now > b.reset) b = { count: 0, reset: now + windowMs }
  b.count++
  buckets.set(ip, b)
  if (buckets.size > 200) {
    for (const [k, v] of buckets) { if (now > v.reset) buckets.delete(k) }
  }
  return b.count > max
}

// ─── Auth Middleware (v2 Bearer first, v1 X-Miau fallback) ───
export async function auth(c: Context<{ Bindings: Env }>): Promise<User | null> {
  // v2: Bearer token
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    const decoded = await verifyToken(c.env.AUTH_SECRET, token)
    if (!decoded) return null
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(decoded.userId).first<User>()
    return user ?? null
  }
  // v1: legacy tripcode
  const legacy = c.req.header('X-Miau')
  if (legacy) {
    const parsed = parseAuth(legacy)
    if (!parsed) return null
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(parsed.username).first<User>()
    if (!user || !user.tripcode) return null
    const trip = await tripcode(parsed.secret)
    if (trip !== user.tripcode) return null
    return user
  }
  return null
}

// ─── Validate ───
export function validateText(text: unknown, min: number, max: number): string | null {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length < min || trimmed.length > max) return null
  return esc(trimmed)
}

export function validateAccountName(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const t = s.trim().toLowerCase()
  if (t.length < 3 || t.length > 25) return null
  if (!/^[a-z0-9_-]+$/.test(t)) return null
  return t
}

export function validateDisplayName(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const t = s.trim()
  if (t.length < 1 || t.length > 25) return null
  // Allow letters/numbers/_/-/space, no special HTML chars (esc them)
  if (!/^[\p{L}\p{N}_\- ]+$/u.test(t)) return null
  return esc(t)
}

export function validatePassword(s: unknown): string | null {
  if (typeof s !== 'string') return null
  if (s.length < 6 || s.length > 128) return null
  return s
}

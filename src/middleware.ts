import type { Context } from 'hono'

// ─── Tipos ───
export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  TELEGRAM_TOKEN: string
  TELEGRAM_CHAT_ID: string
}

export interface User {
  id: number
  username: string
  tripcode: string | null
  color: string
  theme: string
  avatar_seed: number
  bio: string
  created_at: string
  last_seen_at: string
}

// ─── Crypto ───
export async function tripcode(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let num = 0n
  for (const b of bytes) num = (num << 8n) | BigInt(b)
  return num.toString(36).slice(0, 8)
}

// ─── Sanitize ───
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ESC[c])

// ─── Parse ───
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

// ─── Auth Middleware ───
export async function auth(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const header = c.req.header('X-Miau')
  if (!header) return null
  const parsed = parseAuth(header)
  if (!parsed) return null
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(parsed.username).first<User>()
  if (!user || !user.tripcode) return null
  const trip = await tripcode(parsed.secret)
  if (trip !== user.tripcode) return null
  return user
}

// ─── Validate ───
export function validateText(text: unknown, min: number, max: number): string | null {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length < min || trimmed.length > max) return null
  return esc(trimmed)
}

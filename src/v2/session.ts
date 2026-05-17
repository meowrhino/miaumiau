// Cookie de sesión v2 (HttpOnly) sobre el HMAC token que ya existe en middleware.ts.
import type { Context } from 'hono'
import type { Env, User } from '../middleware'
import { verifyToken } from '../middleware'

export const COOKIE = 'mm2'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 días

// Secure solo en producción HTTPS. En localhost (preview/dev) tiene que
// poderse setear sobre http o el navegador la descarta.
function flags(reqUrl: string): string {
  const secure = reqUrl.startsWith('https://') ? '; Secure' : ''
  return `; Path=/; HttpOnly; SameSite=Lax${secure}`
}

export function setSessionCookie(token: string, reqUrl: string): string {
  return `${COOKIE}=${token}; Max-Age=${MAX_AGE}${flags(reqUrl)}`
}

export function clearSessionCookie(reqUrl: string): string {
  return `${COOKIE}=; Max-Age=0${flags(reqUrl)}`
}

export function readSessionCookie(c: Context): string | null {
  const raw = c.req.header('Cookie') ?? ''
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    // Split solo en el primer '='. El valor puede contener '=' (base64 padding).
    const k = trimmed.slice(0, eq)
    const v = trimmed.slice(eq + 1)
    if (k === COOKIE && v) return v
  }
  return null
}

export async function currentUser(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const token = readSessionCookie(c)
  if (!token) return null
  const decoded = await verifyToken(c.env.AUTH_SECRET, token)
  if (!decoded) return null
  return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(decoded.userId).first<User>()
}

export async function requireUser(c: Context<{ Bindings: Env }>): Promise<User | Response> {
  const u = await currentUser(c)
  if (!u) return new Response(JSON.stringify({ error: 'no autenticado' }), { status: 401 })
  return u
}

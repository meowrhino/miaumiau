// Pequeños helpers compartidos por todas las rutas v2.
import type { Context } from 'hono'

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const ok = (data: unknown = { ok: true }) => json(data, 200)
export const err = (msg: string, status = 400) => json({ error: msg }, status)

export const clientIp = (c: Context) =>
  c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'anon'

export const readJson = async <T = any>(c: Context): Promise<T | null> => {
  try { return (await c.req.json()) as T } catch { return null }
}

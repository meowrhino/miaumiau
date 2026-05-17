// /api/v2/presence — heartbeat de posición y lista de quién está online.
// Polling por ahora; cuando se active el plan paid con Durable Objects, este
// archivo es lo único que necesita cambiar (mismo shape de respuesta).
import { Hono } from 'hono'
import type { Env } from '../../middleware'
import { ok, err, readJson } from '../util'
import { currentUser } from '../session'
import type { PresenceTick } from '../types'

const ONLINE_WINDOW_SEC = 30
const presence = new Hono<{ Bindings: Env }>()

presence.post('/', async (c) => {
  const me = await currentUser(c)
  if (!me) return err('no autenticado', 401)

  const body = await readJson<{ x?: number; y?: number; zone?: string }>(c)
  const x = Math.round(Number(body?.x ?? 0))
  const y = Math.round(Number(body?.y ?? 0))
  const zone = typeof body?.zone === 'string' ? body.zone.slice(0, 30) : null

  await c.env.DB.prepare(`
    INSERT INTO presence (user_id, x, y, zone, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET x = ?, y = ?, zone = ?, updated_at = datetime('now')
  `).bind(me.id, x, y, zone, x, y, zone).run()

  const cutoff = `datetime('now', '-${ONLINE_WINDOW_SEC} seconds')`
  const rows = await c.env.DB.prepare(`
    SELECT p.user_id AS id, p.x, p.y, p.updated_at,
           u.display_name, u.username, u.color, u.avatar_seed, u.bio
    FROM presence p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id != ? AND p.updated_at > ${cutoff}
    ORDER BY p.updated_at DESC
    LIMIT 30
  `).bind(me.id).all<any>()

  const tick: PresenceTick = {
    others: rows.results.map((r) => ({
      id: r.id,
      name: r.display_name ?? r.username ?? `miau${r.id}`,
      color: r.color,
      avatar_seed: r.avatar_seed,
      bio: r.bio ?? '',
      x: r.x, y: r.y, updated_at: r.updated_at,
    })),
  }
  return ok(tick)
})

export default presence

// /api/v2/boards/:zone — tablones por zona del pueblo (cronológico, sin replies).
import { Hono } from 'hono'
import { type Env, esc, rateLimit, validateText } from '../../middleware'
import { ok, err, readJson, clientIp } from '../util'
import { currentUser } from '../session'
import { ZONES, type BoardPost } from '../types'

const boards = new Hono<{ Bindings: Env }>()

const isZone = (z: string): z is typeof ZONES[number] => (ZONES as readonly string[]).includes(z)

boards.get('/:zone', async (c) => {
  const zone = c.req.param('zone')
  if (!isZone(zone)) return err('zona desconocida', 404)

  const rows = await c.env.DB.prepare(`
    SELECT p.id, p.zone, p.content, p.created_at,
           u.id AS uid, u.display_name, u.username, u.color, u.avatar_seed, u.bio
    FROM mm2_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.zone = ?
    ORDER BY p.created_at DESC
    LIMIT 50
  `).bind(zone).all<any>()

  const posts: BoardPost[] = rows.results.map((r) => ({
    id: r.id, zone: r.zone, content: r.content, created_at: r.created_at,
    user: {
      id: r.uid,
      name: r.display_name ?? r.username ?? `miau${r.uid}`,
      color: r.color,
      avatar_seed: r.avatar_seed,
      bio: r.bio ?? '',
    },
  }))
  return ok({ posts })
})

boards.post('/:zone', async (c) => {
  const u = await currentUser(c)
  if (!u) return err('no autenticado', 401)
  if (rateLimit(`post:${u.id}`, 6, 60_000)) return err('respira, vas muy rápido', 429)

  const zone = c.req.param('zone')
  if (!isZone(zone)) return err('zona desconocida', 404)

  const body = await readJson<{ content?: string }>(c)
  const content = validateText(body?.content, 1, 500)
  if (!content) return err('mensaje vacío o demasiado largo')

  const r = await c.env.DB
    .prepare(`INSERT INTO mm2_posts (zone, user_id, content) VALUES (?, ?, ?) RETURNING id, created_at`)
    .bind(zone, u.id, content).first<{ id: number; created_at: string }>()
  if (!r) return err('no se pudo postear', 500)

  return ok({
    id: r.id, zone, content, created_at: r.created_at,
    user: {
      id: u.id,
      name: u.display_name ?? u.username ?? `miau${u.id}`,
      color: u.color,
      avatar_seed: u.avatar_seed,
      bio: u.bio ?? '',
    },
  })
})

export default boards

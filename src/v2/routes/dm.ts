// /api/v2/dm/:userId — mensajes 1-a-1. Reusa la tabla messages existente.
import { Hono } from 'hono'
import { type Env, rateLimit, validateText } from '../../middleware'
import { ok, err, readJson } from '../util'
import { currentUser } from '../session'
import type { DmMessage } from '../types'

const dm = new Hono<{ Bindings: Env }>()

dm.get('/:userId', async (c) => {
  const me = await currentUser(c)
  if (!me) return err('no autenticado', 401)
  const other = Number(c.req.param('userId'))
  if (!Number.isFinite(other) || other === me.id) return err('id inválido')

  const rows = await c.env.DB.prepare(`
    SELECT id, sender_id AS from_id, receiver_id AS to_id, content, created_at
    FROM messages
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(me.id, other, other, me.id).all<DmMessage>()

  return ok({ messages: rows.results.reverse() })
})

dm.post('/:userId', async (c) => {
  const me = await currentUser(c)
  if (!me) return err('no autenticado', 401)
  if (rateLimit(`dm:${me.id}`, 30, 60_000)) return err('respira', 429)

  const other = Number(c.req.param('userId'))
  if (!Number.isFinite(other) || other === me.id) return err('id inválido')

  const body = await readJson<{ content?: string }>(c)
  const content = validateText(body?.content, 1, 1000)
  if (!content) return err('mensaje vacío')

  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(other).first()
  if (!exists) return err('usuario no existe', 404)

  const r = await c.env.DB
    .prepare(`INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?) RETURNING id, created_at`)
    .bind(me.id, other, content).first<{ id: number; created_at: string }>()
  if (!r) return err('no se pudo enviar', 500)

  const msg: DmMessage = { id: r.id, from_id: me.id, to_id: other, content, created_at: r.created_at }
  return ok(msg)
})

export default dm

// /api/v2/users/:id — perfil público (para tooltips, chat header, "casa" del poporing).
import { Hono } from 'hono'
import type { Env } from '../../middleware'
import { ok, err } from '../util'
import type { PublicUser } from '../types'

const users = new Hono<{ Bindings: Env }>()

users.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return err('id inválido')
  const u = await c.env.DB
    .prepare('SELECT id, display_name, username, color, avatar_seed, bio FROM users WHERE id = ?')
    .bind(id).first<any>()
  if (!u) return err('no existe', 404)
  const pub: PublicUser = {
    id: u.id,
    name: u.display_name ?? u.username ?? `miau${u.id}`,
    color: u.color,
    avatar_seed: u.avatar_seed,
    bio: u.bio ?? '',
  }
  return ok(pub)
})

export default users

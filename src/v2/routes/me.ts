// /api/v2/me — perfil del usuario actual (GET + PATCH para el cat editor).
import { Hono } from 'hono'
import type { Env } from '../../middleware'
import { ok, err, readJson } from '../util'
import { currentUser } from '../session'
import type { PublicUser } from '../types'

const me = new Hono<{ Bindings: Env }>()

me.get('/', async (c) => {
  const u = await currentUser(c)
  if (!u) return err('no autenticado', 401)
  const pub: PublicUser = {
    id: u.id,
    name: u.display_name ?? u.username ?? `miau${u.id}`,
    color: u.color,
    avatar_seed: u.avatar_seed,
    bio: u.bio ?? '',
  }
  return ok(pub)
})

me.patch('/', async (c) => {
  const u = await currentUser(c)
  if (!u) return err('no autenticado', 401)
  const body = await readJson<{ color?: string; bio?: string; avatar_seed?: number }>(c)
  if (!body) return err('json inválido')

  const sets: string[] = []
  const vals: any[] = []
  if (typeof body.color === 'string' && /^[a-zA-Z]+$|^#[0-9a-fA-F]{6}$/.test(body.color)) {
    sets.push('color = ?'); vals.push(body.color)
  }
  if (typeof body.bio === 'string' && body.bio.length <= 280) {
    sets.push('bio = ?'); vals.push(body.bio)
  }
  if (typeof body.avatar_seed === 'number' && Number.isFinite(body.avatar_seed)) {
    sets.push('avatar_seed = ?'); vals.push(body.avatar_seed | 0)
  }
  if (!sets.length) return err('nada que actualizar')

  vals.push(u.id)
  await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  return ok()
})

export default me

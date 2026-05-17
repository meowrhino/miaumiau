// Hono app del v2. Se monta en /api/v2 desde src/index.ts.
import { Hono } from 'hono'
import type { Env } from '../middleware'
import auth from './routes/auth'
import me from './routes/me'
import boards from './routes/boards'
import dm from './routes/dm'
import presence from './routes/presence'
import users from './routes/users'

const v2 = new Hono<{ Bindings: Env }>()

v2.get('/health', (c) => c.json({ ok: true, v: 2 }))
v2.route('/auth', auth)
v2.route('/me', me)
v2.route('/boards', boards)
v2.route('/dm', dm)
v2.route('/presence', presence)
v2.route('/users', users)

export default v2

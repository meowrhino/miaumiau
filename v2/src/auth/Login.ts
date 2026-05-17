// Pantalla de login/registro. DOM puro, sin Phaser.
import { api } from '../api'
import { me } from '../state'
import { toast } from '../ui/Toast'

export function renderLogin(root: HTMLElement): void {
  root.innerHTML = `
    <div class="mm-login">
      <h1>🐱 miaumiau</h1>
      <form>
        <input name="name" placeholder="tu nombre (a-z, 0-9, _, -)" autocomplete="username" required />
        <input name="password" type="password" placeholder="contraseña" autocomplete="current-password" required />
        <button type="submit">entrar</button>
        <button type="button" class="secondary">crear cuenta</button>
        <div class="err"></div>
      </form>
    </div>
  `

  const form = root.querySelector('form')!
  const errEl = form.querySelector('.err')!
  const inputs = form.querySelectorAll('input')
  const submitBtn = form.querySelector('button[type=submit]') as HTMLButtonElement
  const registerBtn = form.querySelector('button.secondary') as HTMLButtonElement

  const lock = (busy: boolean) => {
    inputs.forEach((i) => (i.disabled = busy))
    submitBtn.disabled = busy
    registerBtn.disabled = busy
  }

  const handle = async (action: 'login' | 'register') => {
    errEl.textContent = ''
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    const password = String(fd.get('password') ?? '')
    if (!name || !password) { errEl.textContent = 'rellena los dos campos'; return }
    lock(true)
    try {
      if (action === 'login') await api.login(name, password)
      else await api.register(name, password)
      const user = await api.me()
      me.set(user)
      toast(`¡hola, ${user.name}!`)
    } catch (e: any) {
      errEl.textContent = e?.message ?? 'algo ha ido mal'
    } finally {
      lock(false)
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); void handle('login') })
  registerBtn.addEventListener('click', () => { void handle('register') })
}

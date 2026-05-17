// HUD inferior: botones para abrir mi miau (cat editor) y salir de sesión.
import { api } from '../api'
import { me } from '../state'
import { openCatEditor } from './CatEditor'
import { toast } from './Toast'

export function mountHud(): () => void {
  const el = document.createElement('div')
  el.className = 'mm-hud'
  el.innerHTML = `
    <button class="miau">🐱 mi miau</button>
    <button class="logout">salir</button>
  `
  document.body.appendChild(el)

  ;(el.querySelector('.miau') as HTMLButtonElement).addEventListener('click', () => openCatEditor())
  ;(el.querySelector('.logout') as HTMLButtonElement).addEventListener('click', async () => {
    try { await api.logout(); me.set(null); toast('hasta luego') } catch { /* silent */ }
  })

  return () => el.remove()
}

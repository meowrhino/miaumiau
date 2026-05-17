// Modal del tablón. Lista cronológica + textarea para postear.
import { api, type BoardPost } from '../api'
import type { Zone } from '../config'
import { toast } from './Toast'
import { createPanel, type PanelHandle } from './Panel'

let current: { panel: PanelHandle; zone: Zone } | null = null

function timeAgo(ts: string): string {
  const t = new Date(ts.replace(' ', 'T') + 'Z').getTime()
  const diff = (Date.now() - t) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function renderPosts(body: HTMLElement, posts: BoardPost[]): void {
  body.innerHTML = ''
  if (!posts.length) {
    const empty = document.createElement('div')
    empty.style.opacity = '0.6'
    empty.style.textAlign = 'center'
    empty.style.padding = '20px'
    empty.textContent = 'aún no hay nada por aquí. ¡sé el primero!'
    body.appendChild(empty)
    return
  }
  for (const p of posts) {
    const el = document.createElement('div')
    el.className = 'mm-post'
    el.innerHTML = `
      <div class="meta"><span class="author"></span> · <span class="when"></span></div>
      <div class="content"></div>
    `
    ;(el.querySelector('.author') as HTMLElement).textContent = p.user.name
    ;(el.querySelector('.when') as HTMLElement).textContent = timeAgo(p.created_at)
    ;(el.querySelector('.content') as HTMLElement).textContent = p.content
    body.appendChild(el)
  }
}

const ZONE_TITLE: Record<Zone, string> = {
  plaza:    '🌳 plaza',
  cafe:     '☕ café — miaus rápidos',
  tablon:   '📌 tablón — del día',
  miradero: '🌙 miradero — notas de noche',
  polaroid: '📷 polaroid — qué ves',
  banquito: '🪑 banquito — conversación',
}

export function openBoard(zone: Zone): void {
  // Si ya está abierto el mismo tablón, no hacemos nada (evita el flash
  // "abre/cierra" cuando Phaser dispara pointerdown dos veces o el usuario
  // re-clickea el edificio).
  if (current?.zone === zone) return
  closeBoard()
  const panel = createPanel()
  panel.title.textContent = ZONE_TITLE[zone]

  panel.footer.innerHTML = `
    <textarea rows="2" placeholder="deja un miau…" maxlength="500"></textarea>
    <button>postear</button>
  `
  const ta = panel.footer.querySelector('textarea') as HTMLTextAreaElement
  const btn = panel.footer.querySelector('button') as HTMLButtonElement

  let posts: BoardPost[] = []

  const refresh = async () => {
    try {
      const r = await api.listBoard(zone)
      posts = r.posts
      renderPosts(panel.body, posts)
    } catch (e: any) {
      toast(e?.message ?? 'no se pudo cargar')
    }
  }

  const submit = async () => {
    const content = ta.value.trim()
    if (!content) return
    btn.disabled = true
    try {
      const p = await api.postBoard(zone, content)
      posts.unshift(p)
      renderPosts(panel.body, posts)
      ta.value = ''
    } catch (e: any) {
      toast(e?.message ?? 'no se pudo postear')
    } finally {
      btn.disabled = false
      ta.focus()
    }
  }

  btn.addEventListener('click', () => { void submit() })

  current = { panel, zone }
  panel.open()
  void refresh()
}

export function closeBoard(): void {
  if (!current) return
  current.panel.close()
  setTimeout(() => current?.panel.destroy(), 250)
  current = null
}

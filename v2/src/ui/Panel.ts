// Helper para crear un panel lateral (chat / board / editor). Devuelve los
// nodos clave para que cada panel concreto los rellene como quiera.
export interface PanelHandle {
  root: HTMLDivElement
  title: HTMLSpanElement
  body: HTMLDivElement
  footer: HTMLElement
  open(): void
  close(): void
  destroy(): void
  onClose(cb: () => void): void   // se dispara cuando el user cierra (X o Esc)
}

export function createPanel(): PanelHandle {
  const root = document.createElement('div')
  root.className = 'mm-panel'
  root.innerHTML = `
    <header>
      <span class="title"></span>
      <button class="close" aria-label="cerrar">×</button>
    </header>
    <div class="body"></div>
    <footer></footer>
  `
  document.body.appendChild(root)

  const title = root.querySelector('.title') as HTMLSpanElement
  const body = root.querySelector('.body') as HTMLDivElement
  const footer = root.querySelector('footer') as HTMLElement
  const closeBtn = root.querySelector('.close') as HTMLButtonElement

  let opening: number | null = null
  const closeCbs = new Set<() => void>()
  const open = () => { opening = requestAnimationFrame(() => { opening = null; root.classList.add('open') }) }
  const close = () => { if (opening != null) { cancelAnimationFrame(opening); opening = null } ; root.classList.remove('open') }
  const userClose = () => { close(); for (const cb of closeCbs) cb() }
  closeBtn.addEventListener('click', userClose)
  // Esc cierra el panel encima
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') userClose() }
  document.addEventListener('keydown', onKey)

  return {
    root, title, body, footer, open, close,
    onClose: (cb) => { closeCbs.add(cb) },
    destroy: () => { document.removeEventListener('keydown', onKey); root.remove() },
  }
}

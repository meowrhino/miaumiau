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
  const open = () => { opening = requestAnimationFrame(() => { opening = null; root.classList.add('open') }) }
  const close = () => { if (opening != null) { cancelAnimationFrame(opening); opening = null } ; root.classList.remove('open') }
  closeBtn.addEventListener('click', close)

  return {
    root, title, body, footer, open, close,
    destroy: () => root.remove(),
  }
}

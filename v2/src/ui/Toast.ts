// Toast simple. Una sola instancia DOM que se reusa.
const el = document.createElement('div')
el.className = 'mm-toast'
document.body.appendChild(el)

let hideTimer: number | null = null

export function toast(msg: string, ms = 2200): void {
  el.textContent = msg
  el.classList.add('show')
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => el.classList.remove('show'), ms)
}

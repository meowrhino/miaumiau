// Chat 1-a-1. Se abre al hacer click en otro poporing.
import { api, type DmMessage, type PublicUser } from '../api'
import { me } from '../state'
import { toast } from './Toast'
import { createPanel, type PanelHandle } from './Panel'

let current: { panel: PanelHandle; uid: number; timer: number | null } | null = null

function hourMin(ts: string): string {
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function renderMsgs(body: HTMLElement, msgs: DmMessage[]): void {
  const myId = me.get()?.id
  body.innerHTML = ''
  for (const m of msgs) {
    const el = document.createElement('div')
    el.className = 'mm-msg' + (m.from_id === myId ? ' me' : '')
    el.textContent = m.content
    el.title = hourMin(m.created_at)
    body.appendChild(el)
  }
  body.scrollTop = body.scrollHeight
}

export function openChat(other: PublicUser): void {
  // Si ya está abierto el chat con esta misma persona, no recrear.
  if (current?.uid === other.id) return
  closeChat()
  const panel = createPanel()
  panel.title.textContent = `miau con ${other.name}`

  panel.footer.innerHTML = `
    <input placeholder="escribe un miau…" maxlength="1000" />
    <button>enviar</button>
  `
  const input = panel.footer.querySelector('input') as HTMLInputElement
  const btn = panel.footer.querySelector('button') as HTMLButtonElement

  let msgs: DmMessage[] = []

  const refresh = async () => {
    try {
      const r = await api.listDm(other.id)
      msgs = r.messages
      renderMsgs(panel.body, msgs)
    } catch { /* silent */ }
  }

  const send = async () => {
    const content = input.value.trim()
    if (!content) return
    btn.disabled = true
    try {
      const m = await api.sendDm(other.id, content)
      msgs.push(m)
      renderMsgs(panel.body, msgs)
      input.value = ''
    } catch (e: any) {
      toast(e?.message ?? 'no se pudo enviar')
    } finally {
      btn.disabled = false
      input.focus()
    }
  }

  btn.addEventListener('click', () => { void send() })
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void send() })

  current = { panel, uid: other.id, timer: window.setInterval(refresh, 3000) }
  panel.onClose(() => { if (current?.timer) clearInterval(current.timer); current = null })
  panel.open()
  void refresh().then(() => input.focus())
}

export function closeChat(): void {
  if (!current) return
  if (current.timer) clearInterval(current.timer)
  current.panel.close()
  setTimeout(() => current?.panel.destroy(), 250)
  current = null
}

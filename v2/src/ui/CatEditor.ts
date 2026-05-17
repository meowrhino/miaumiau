// Customizador del poporing. Lo abre el botón "mi miau" del HUD.
// MVP: color (chips) + bio + dado para regenerar el avatar_seed.
import { api } from '../api'
import { me } from '../state'
import { toast } from './Toast'
import { createPanel, type PanelHandle } from './Panel'

const COLORS = ['Coral', 'Limón', 'Menta', 'Cielo', 'Lavanda', 'Melocotón', 'Crema', 'Rosa']

let current: { panel: PanelHandle } | null = null

export function openCatEditor(): void {
  closeCatEditor()
  const u = me.get()
  if (!u) return

  const panel = createPanel()
  panel.title.textContent = 'mi miau'

  panel.body.innerHTML = `
    <div>
      <div style="opacity:0.7;font-size:12px;margin-bottom:6px">color</div>
      <div class="chips" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <div style="margin-top:14px">
      <div style="opacity:0.7;font-size:12px;margin-bottom:6px">bio</div>
      <textarea class="bio" rows="3" maxlength="280" placeholder="qué te pasa por la cabeza"
        style="width:100%;font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #3a3a4e;background:#2a2a3e;color:#fff8e7;outline:none;resize:none"></textarea>
    </div>
    <button class="dado" style="margin-top:14px;font:inherit;padding:10px;border-radius:10px;border:1px solid #3a3a4e;background:transparent;color:#fff8e7;cursor:pointer">
      🎲 regenerar avatar
    </button>
  `

  panel.footer.innerHTML = `<button class="save" style="flex:1">guardar</button>`

  const chipsEl = panel.body.querySelector('.chips') as HTMLDivElement
  const bioEl = panel.body.querySelector('.bio') as HTMLTextAreaElement
  const dadoBtn = panel.body.querySelector('.dado') as HTMLButtonElement
  const saveBtn = panel.footer.querySelector('.save') as HTMLButtonElement

  let color = u.color
  let bio = u.bio
  let seed = u.avatar_seed

  const paintChips = () => {
    chipsEl.innerHTML = ''
    for (const c of COLORS) {
      const chip = document.createElement('button')
      chip.textContent = c
      chip.style.cssText = `font:inherit;padding:6px 10px;border-radius:999px;cursor:pointer;border:1px solid ${c === color ? '#ffb86c' : '#3a3a4e'};background:${c === color ? '#ffb86c' : '#2a2a3e'};color:${c === color ? '#1a1a2e' : '#fff8e7'}`
      chip.addEventListener('click', () => { color = c; paintChips() })
      chipsEl.appendChild(chip)
    }
  }
  paintChips()

  bioEl.value = bio
  bioEl.addEventListener('input', () => { bio = bioEl.value })

  dadoBtn.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1_000_000)
    toast('🎲 nuevo seed')
  })

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true
    try {
      await api.updateMe({ color, bio, avatar_seed: seed })
      me.set({ ...u, color, bio, avatar_seed: seed })
      toast('guardado ✨')
      closeCatEditor()
    } catch (e: any) {
      toast(e?.message ?? 'no se pudo guardar')
    } finally {
      saveBtn.disabled = false
    }
  })

  current = { panel }
  panel.open()
}

export function closeCatEditor(): void {
  if (!current) return
  current.panel.close()
  setTimeout(() => current?.panel.destroy(), 250)
  current = null
}

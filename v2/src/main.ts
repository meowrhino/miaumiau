// Entry point del v2. Decide si mostrar login o el mundo según la sesión.
import './styles.css'
import { api, type PublicUser } from './api'
import { me } from './state'
import { renderLogin } from './auth/Login'
import { startGame, stopGame } from './game/Game'
import { TOWN_EVENT } from './game/scenes/Town'
import { mountHud } from './ui/Hud'
import { openChat, closeChat } from './ui/ChatPanel'
import { openBoard, closeBoard } from './ui/BoardModal'
import { openCatEditor, closeCatEditor } from './ui/CatEditor'
import { ZONES, type Zone } from './config'

declare global { interface Window { __mm2_booted?: true } }
if (!window.__mm2_booted) { window.__mm2_booted = true; void start() }

async function start(): Promise<void> {
  const root = document.getElementById('app') as HTMLElement
  let cleanup: (() => void) | null = null
  let lastAuthed: boolean | null = null

  const mountWorld = () => {
    cleanup?.()
    root.innerHTML = ''
    const { town } = startGame(root)
    const hudOff = mountHud()
    town.bus.on(TOWN_EVENT.poporingClick, (user: PublicUser) => openChat(user))
    town.bus.on(TOWN_EVENT.buildingEnter, (id: string) => {
      // casita = tu casa = perfil propio → abre cat editor.
      // El resto son tablones por zona.
      if (id === 'casita') openCatEditor()
      else if ((ZONES as readonly string[]).includes(id)) openBoard(id as Zone)
    })
    cleanup = () => { hudOff(); closeChat(); closeBoard(); closeCatEditor(); stopGame() }
  }

  const mountLogin = () => {
    cleanup?.(); cleanup = null
    renderLogin(root)
  }

  me.on((u) => {
    const authed = !!u
    if (authed === lastAuthed) return
    lastAuthed = authed
    authed ? mountWorld() : mountLogin()
  })

  try { me.set(await api.me()) }
  catch { me.set(null) }
}

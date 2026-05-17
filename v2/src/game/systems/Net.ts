// Capa de red para presencia + posición de otros poporings.
// Implementación: polling HTTP cada 1s contra /api/v2/presence.
// Cuando activemos Durable Objects + WebSockets, este es el único archivo
// que cambia (la interfaz pública se mantiene).
import { api, type PresenceOther } from '../../api'
import { PRESENCE_HZ } from '../../config'

type Listener = (others: PresenceOther[]) => void

export class Net {
  private timer: number | null = null
  private listeners = new Set<Listener>()
  private pos = { x: 0, y: 0, zone: null as string | null }

  start(): void {
    if (this.timer != null) return
    const tickMs = Math.round(1000 / PRESENCE_HZ)
    const tick = async () => {
      try {
        const { others } = await api.presence(this.pos.x, this.pos.y, this.pos.zone)
        for (const l of this.listeners) l(others)
      } catch { /* silent — polling se reintenta */ }
    }
    void tick()
    this.timer = window.setInterval(tick, tickMs)
  }

  stop(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
  }

  updatePosition(x: number, y: number, zone: string | null = null): void {
    this.pos.x = Math.round(x)
    this.pos.y = Math.round(y)
    this.pos.zone = zone
  }

  onOthers(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
}

// Escena principal: el pueblo. Renderiza tilemap, dibuja edificios, controla
// el poporing del jugador (click-to-walk), pinta los otros poporings online, y
// emite eventos hacia el DOM cuando hay que abrir chat o entrar a un edificio.
import Phaser from 'phaser'
import { TILE, WORLD_W, WORLD_H, WALK_SPEED, PALETTE, ISLAND_COLS, ISLAND_ROWS } from '../../config'
import { BUILDINGS, TILES, isLand, buildingAt, tileColor } from '../world/island'
import { Poporing } from '../systems/Poporing'
import { Net } from '../systems/Net'
import { me } from '../../state'
import type { PresenceOther } from '../../api'

// Eventos que la escena emite hacia el DOM (main.ts los conecta a los paneles).
export const TOWN_EVENT = {
  poporingClick: 'town:poporingClick',
  buildingEnter: 'town:buildingEnter',
} as const

export class Town extends Phaser.Scene {
  // bus es un emitter propio (no el this.events built-in, que sólo existe
  // cuando la escena ya está añadida al SceneManager). main.ts se suscribe
  // a bus desde el momento en que se construye la Town.
  public readonly bus = new Phaser.Events.EventEmitter()
  private net = new Net()
  private player?: Poporing
  private targetX = 0
  private targetY = 0
  private moving = false
  private others = new Map<number, Poporing>()

  constructor() { super('Town') }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.bg)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)

    this.drawGround()
    this.drawBuildings()

    const meUser = me.get()
    if (!meUser) return  // protegido por main.ts, pero por si acaso

    const spawn = this.tileToWorld(Math.floor(ISLAND_COLS / 2), Math.floor(ISLAND_ROWS / 2))
    this.player = new Poporing(this, spawn.x, spawn.y, meUser)
    this.targetX = spawn.x
    this.targetY = spawn.y
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p))

    // Sync otros poporings al recibir tick de presencia
    this.net.onOthers((list) => this.applyOthers(list))
    this.net.updatePosition(this.player.x, this.player.y, null)
    this.net.start()

  }

  shutdown(): void { this.net.stop() }

  // ─── Render ───
  private drawGround(): void {
    const g = this.add.graphics().setDepth(-1000)
    for (let y = 0; y < ISLAND_ROWS; y++) {
      for (let x = 0; x < ISLAND_COLS; x++) {
        g.fillStyle(tileColor(TILES[y][x]), 1)
        g.fillRect(x * TILE, y * TILE, TILE, TILE)
      }
    }
  }

  private drawBuildings(): void {
    for (const b of BUILDINGS) {
      const px = b.x * TILE, py = b.y * TILE
      const w = b.w * TILE, h = b.h * TILE
      const g = this.add.graphics()
      g.setDepth(py + h - 10)
      // sombra
      g.fillStyle(0x000000, 0.18); g.fillEllipse(px + w / 2, py + h + 4, w * 0.85, 10)
      // pared
      g.fillStyle(PALETTE.cream, 1); g.fillRoundedRect(px, py + 8, w, h - 8, 4)
      // tejado
      g.fillStyle(0xff8b8b, 1)
      g.beginPath()
      g.moveTo(px - 4, py + 14)
      g.lineTo(px + w / 2, py - 6)
      g.lineTo(px + w + 4, py + 14)
      g.closePath()
      g.fillPath()
      // puerta + ventana
      g.fillStyle(0x6b4f3b, 1); g.fillRect(px + w / 2 - 6, py + h - 16, 12, 16)
      g.fillStyle(0xfff2b3, 1); g.fillCircle(px + 10, py + 18, 4)
      g.fillCircle(px + w - 10, py + 18, 4)
      // cartel emoji + label
      this.add.text(px + w / 2, py - 18, b.emoji, { fontSize: '18px' }).setOrigin(0.5).setDepth(py + h - 9)
      this.add.text(px + w / 2, py + h + 14, b.label, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#fff8e7',
        backgroundColor: 'rgba(26,26,46,0.6)', padding: { x: 4, y: 1 },
      }).setOrigin(0.5).setDepth(py + h - 9)
    }
  }

  // ─── Input ───
  private onPointer(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y)

    // ¿Click en otro poporing?
    for (const op of this.others.values()) {
      const dx = world.x - op.x, dy = world.y - op.y
      if (dx * dx + dy * dy < 18 * 18) {
        this.bus.emit(TOWN_EVENT.poporingClick, op.user)
        return
      }
    }

    // ¿Click en edificio?
    const bld = buildingAt(world.x, world.y)
    if (bld) {
      this.bus.emit(TOWN_EVENT.buildingEnter, bld.id)
      this.walkTo(bld.doorX * TILE + TILE / 2, bld.doorY * TILE + TILE / 2)
      return
    }

    // Click en suelo → walk si es tierra
    if (isLand(world.x, world.y)) this.walkTo(world.x, world.y)
  }

  private walkTo(x: number, y: number): void {
    this.targetX = x; this.targetY = y; this.moving = true
  }

  // ─── Update ───
  update(_t: number, delta: number): void {
    if (!this.player) return
    this.player.tickIdle(delta)

    if (this.moving) {
      const dx = this.targetX - this.player.x
      const dy = this.targetY - this.player.y
      const dist = Math.hypot(dx, dy)
      const step = (WALK_SPEED * delta) / 1000
      if (dist <= step) {
        this.player.x = this.targetX; this.player.y = this.targetY
        this.moving = false
      } else {
        const nx = this.player.x + (dx / dist) * step
        const ny = this.player.y + (dy / dist) * step
        // slide separado X/Y para resbalar por la costa
        if (isLand(nx, this.player.y)) this.player.x = nx
        if (isLand(this.player.x, ny)) this.player.y = ny
      }
      this.net.updatePosition(this.player.x, this.player.y)
    }
    for (const op of this.others.values()) op.tickIdle(delta)
  }

  // ─── Presencia ───
  private applyOthers(list: PresenceOther[]): void {
    const seen = new Set<number>()
    for (const o of list) {
      seen.add(o.id)
      let p = this.others.get(o.id)
      if (!p) {
        p = new Poporing(this, o.x, o.y, o)
        this.others.set(o.id, p)
      } else {
        p.setUser(o)
        // interpolación simple: tween a la nueva pos
        this.tweens.add({ targets: p, x: o.x, y: o.y, duration: 800, ease: 'Sine.easeOut' })
      }
    }
    for (const [id, p] of this.others) {
      if (!seen.has(id)) { p.destroy(); this.others.delete(id) }
    }
  }

  // ─── Helpers ───
  private tileToWorld(tx: number, ty: number) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }
  }
}

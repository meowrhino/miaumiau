// Escena principal: el pueblo. Pinta el suelo con tiles de Sprout Lands,
// edificios con sub-rects del house_sheet, árboles, y controla movimiento +
// presencia. Emite eventos hacia el DOM (chat, board) por town.bus.
import Phaser from 'phaser'
import { TILE, WORLD_W, WORLD_H, WALK_SPEED, PALETTE, ISLAND_COLS, ISLAND_ROWS } from '../../config'
import { BUILDINGS, TILES, TILE_WATER, TILE_PATH, TREES, GRASS_RECT, isLand, buildingAt, type SheetRect } from '../world/island'
import { Poporing } from '../systems/Poporing'
import { Net } from '../systems/Net'
import { me } from '../../state'
import type { PresenceOther } from '../../api'

export const TOWN_EVENT = {
  poporingClick: 'town:poporingClick',
  buildingEnter: 'town:buildingEnter',
} as const

// Emoji "sello" sobre el techo de cada zona — pista visual rápida de qué es.
const ZONE_BADGE: Record<string, string> = {
  cafe: '☕', tablon: '📌', miradero: '🌙', casita: '🏠',
}

export class Town extends Phaser.Scene {
  public readonly bus = new Phaser.Events.EventEmitter()
  private net = new Net()
  private player?: Poporing
  private targetX = 0
  private targetY = 0
  private moving = false
  private others = new Map<number, Poporing>()

  constructor() { super('Town') }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.water)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.registerFrames()

    this.drawWater()
    this.drawGrass()
    this.drawPaths()
    this.drawShore()
    this.drawTrees()
    this.drawBuildings()

    const meUser = me.get()
    if (!meUser) return

    const spawn = this.tileToWorld(Math.floor(ISLAND_COLS / 2), Math.floor(ISLAND_ROWS / 2))
    this.player = new Poporing(this, spawn.x, spawn.y, meUser)
    this.targetX = spawn.x; this.targetY = spawn.y
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p))

    this.net.onOthers((list) => this.applyOthers(list))
    this.net.updatePosition(this.player.x, this.player.y, null)
    this.net.start()
  }

  shutdown(): void { this.net.stop() }

  // ─── Frames ──────────────────────────────────────────────────────────
  // Phaser no soporta dibujar sub-rects arbitrarios de una imagen sin
  // registrarlos como frames. Lo hacemos una vez al inicio.
  private registerFrames(): void {
    const reg = (key: string, name: string, r: SheetRect) => {
      const tex = this.textures.get(key)
      if (tex && !tex.has(name)) tex.add(name, 0, r.sx, r.sy, r.sw, r.sh)
    }
    reg('sheet:grass', 'tile', GRASS_RECT)
    for (const b of BUILDINGS) reg(`sheet:${b.sheet}`, b.id, b.rect)
    TREES.forEach((d, i) => reg('sheet:trees', `t${i}`, d.rect))
  }

  // ─── Render ──────────────────────────────────────────────────────────
  private drawWater(): void {
    // Fondo de mar — un solo rect. El grass se pinta encima donde toca.
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, PALETTE.water)
      .setDepth(-2000)
  }

  private drawGrass(): void {
    // TileSprite tilea la textura del frame 'tile' del grass sheet sobre
    // toda la zona de tierra. Sale baratísimo (un solo draw call).
    for (let y = 0; y < ISLAND_ROWS; y++) {
      let runStart = -1
      for (let x = 0; x <= ISLAND_COLS; x++) {
        const isLandTile = x < ISLAND_COLS && TILES[y][x] !== TILE_WATER
        if (isLandTile && runStart === -1) runStart = x
        if (!isLandTile && runStart !== -1) {
          const w = (x - runStart) * TILE
          this.add.tileSprite(runStart * TILE, y * TILE, w, TILE, 'sheet:grass', 'tile')
            .setOrigin(0, 0).setDepth(-1500)
          runStart = -1
        }
      }
    }
  }

  private drawPaths(): void {
    // Camino marrón sobre el grass (rect plano, queda elegante y simple).
    for (let y = 0; y < ISLAND_ROWS; y++) {
      for (let x = 0; x < ISLAND_COLS; x++) {
        if (TILES[y][x] !== TILE_PATH) continue
        this.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, PALETTE.path)
          .setDepth(-1400)
      }
    }
  }

  private drawShore(): void {
    // Borde arenoso entre grass y agua (línea fina cream alrededor de cada
    // tile que tenga vecino de agua). Da el toque "isla" sin tilemap real.
    const g = this.add.graphics().setDepth(-1450)
    g.lineStyle(2, PALETTE.shore, 0.9)
    for (let y = 0; y < ISLAND_ROWS; y++) {
      for (let x = 0; x < ISLAND_COLS; x++) {
        if (TILES[y][x] === TILE_WATER) continue
        const top    = y === 0 || TILES[y - 1][x] === TILE_WATER
        const bottom = y === ISLAND_ROWS - 1 || TILES[y + 1][x] === TILE_WATER
        const left   = x === 0 || TILES[y][x - 1] === TILE_WATER
        const right  = x === ISLAND_COLS - 1 || TILES[y][x + 1] === TILE_WATER
        const px = x * TILE, py = y * TILE
        if (top)    { g.beginPath(); g.moveTo(px, py);            g.lineTo(px + TILE, py);            g.strokePath() }
        if (bottom) { g.beginPath(); g.moveTo(px, py + TILE);     g.lineTo(px + TILE, py + TILE);     g.strokePath() }
        if (left)   { g.beginPath(); g.moveTo(px, py);            g.lineTo(px, py + TILE);            g.strokePath() }
        if (right)  { g.beginPath(); g.moveTo(px + TILE, py);     g.lineTo(px + TILE, py + TILE);     g.strokePath() }
      }
    }
  }

  private drawTrees(): void {
    TREES.forEach((d, i) => {
      const px = d.x * TILE + TILE / 2
      const py = d.y * TILE + TILE / 2
      // Sprout trees son 32×48 — escalamos x2 para que tengan presencia.
      const img = this.add.image(px, py, 'sheet:trees', `t${i}`)
        .setOrigin(0.5, 0.85)
        .setScale(2)
      img.setDepth(py + 30)
    })
  }

  private drawBuildings(): void {
    for (const b of BUILDINGS) {
      const px = b.x * TILE + (b.w * TILE) / 2
      const py = b.y * TILE + (b.h * TILE) / 2
      // Casas son 64×64 en el sheet — escalamos para llenar la bbox.
      const scale = (b.w * TILE) / b.rect.sw
      const img = this.add.image(px, py, `sheet:${b.sheet}`, b.id)
        .setOrigin(0.5, 0.5)
        .setScale(scale)
      img.setDepth(py + (b.h * TILE) / 2 - 4)

      // Sello-emoji sobre el techo
      const badge = ZONE_BADGE[b.id] ?? ''
      if (badge) {
        this.add.text(px, b.y * TILE - 4, badge, { fontSize: '18px' })
          .setOrigin(0.5, 1).setDepth(py + (b.h * TILE) / 2 - 3)
      }
      // Label bajo el edificio
      this.add.text(px, (b.y + b.h) * TILE + 6, b.label, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#fff8e7',
        backgroundColor: 'rgba(26,26,46,0.6)', padding: { x: 4, y: 1 },
      }).setOrigin(0.5, 0).setDepth(py + (b.h * TILE) / 2 - 3)
    }
  }

  // ─── Input ──────────────────────────────────────────────────────────
  private onPointer(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y)

    for (const op of this.others.values()) {
      const dx = world.x - op.x, dy = world.y - op.y
      if (dx * dx + dy * dy < 18 * 18) {
        this.bus.emit(TOWN_EVENT.poporingClick, op.user)
        return
      }
    }
    const bld = buildingAt(world.x, world.y)
    if (bld) {
      this.bus.emit(TOWN_EVENT.buildingEnter, bld.id)
      this.walkTo(bld.doorX * TILE + TILE / 2, bld.doorY * TILE + TILE / 2)
      return
    }
    if (isLand(world.x, world.y)) this.walkTo(world.x, world.y)
  }

  private walkTo(x: number, y: number): void {
    this.targetX = x; this.targetY = y; this.moving = true
  }

  // ─── Update ─────────────────────────────────────────────────────────
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
        if (isLand(nx, this.player.y)) this.player.x = nx
        if (isLand(this.player.x, ny)) this.player.y = ny
      }
      this.net.updatePosition(this.player.x, this.player.y)
    }
    for (const op of this.others.values()) op.tickIdle(delta)
  }

  private applyOthers(list: PresenceOther[]): void {
    const seen = new Set<number>()
    for (const o of list) {
      seen.add(o.id)
      let p = this.others.get(o.id)
      if (!p) { p = new Poporing(this, o.x, o.y, o); this.others.set(o.id, p) }
      else {
        p.setUser(o)
        this.tweens.add({ targets: p, x: o.x, y: o.y, duration: 800, ease: 'Sine.easeOut' })
      }
    }
    for (const [id, p] of this.others) {
      if (!seen.has(id)) { p.destroy(); this.others.delete(id) }
    }
  }

  private tileToWorld(tx: number, ty: number) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }
  }
}

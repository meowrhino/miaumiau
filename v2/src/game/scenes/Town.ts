// Escena principal: el pueblo. Renderiza 3 islas + plaza + puentes con
// sprites de Sprout Lands. Controla movimiento y emite eventos hacia el
// DOM (chat / board / casita) por town.bus.
import Phaser from 'phaser'
import { WORLD_W, WORLD_H, WALK_SPEED, PALETTE } from '../../config'
import {
  ZONES, ISLANDS, PLAZA, FOUNTAIN, SPAWN, BRIDGES, LAMPS, TREES,
  DECO_BUILDINGS, GRASS_RECT, TREE_RECT_FOR,
  isLand, zoneAt, type DecoBuilding, type SheetRect,
} from '../world/island'
import { Poporing } from '../systems/Poporing'
import { Net } from '../systems/Net'
import { me } from '../../state'
import type { PresenceOther } from '../../api'

export const TOWN_EVENT = {
  poporingClick: 'town:poporingClick',
  buildingEnter: 'town:buildingEnter',   // payload: zoneId
} as const

export class Town extends Phaser.Scene {
  public readonly bus = new Phaser.Events.EventEmitter()
  private net = new Net()
  private player?: Poporing
  private targetX = 0
  private targetY = 0
  private moving = false
  private others = new Map<number, Poporing>()

  // Refs para animaciones
  private fountainJet?: Phaser.GameObjects.Graphics
  private fountainT = 0
  private runeRing?: Phaser.GameObjects.Graphics
  private millBlades?: Phaser.GameObjects.Graphics
  private millT = 0

  constructor() { super('Town') }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.waterDk)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.registerFrames()

    this.drawWater()
    this.drawIslandsAndPlaza()
    this.drawBridges()
    this.drawTrees()
    this.drawLamps()
    this.drawDecoBuildings()
    this.drawZones()
    this.drawSpawnRune()
    this.drawFountain()

    const meUser = me.get()
    if (!meUser) return

    this.player = new Poporing(this, SPAWN.x, SPAWN.y + 20, meUser)
    this.targetX = this.player.x; this.targetY = this.player.y
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p))

    this.net.onOthers((list) => this.applyOthers(list))
    this.net.updatePosition(this.player.x, this.player.y, null)
    this.net.start()
  }

  shutdown(): void { this.net.stop() }

  // ─── Frames ──────────────────────────────────────────────────────────
  private registerFrames(): void {
    const reg = (key: string, name: string, r: SheetRect) => {
      const tex = this.textures.get(key)
      if (tex && !tex.has(name)) tex.add(name, 0, r.sx, r.sy, r.sw, r.sh)
    }
    reg('sheet:grass', 'tile', GRASS_RECT)
    for (const z of ZONES) reg(`sheet:${z.sheet}`, z.id, z.rect)
    TREES.forEach((t, i) => reg('sheet:trees', `t${i}`, TREE_RECT_FOR(t.variant)))
  }

  // ─── Render: agua, islas, plaza ──────────────────────────────────────
  private drawWater(): void {
    // Fondo de mar plano con bandas de wave más oscuras (estática, evita
    // tween cost). Sparkles añadidos como ronda de puntos.
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, PALETTE.water).setDepth(-2000)
    const g = this.add.graphics().setDepth(-1990)
    g.fillStyle(PALETTE.waterDk, 0.25)
    for (let y = 0; y < WORLD_H; y += 14) g.fillRect(0, y, WORLD_W, 2)
    // Sparkles deterministas (no animados — añadir tween cuesta y pesa).
    g.fillStyle(0xffffff, 0.8)
    for (let i = 0; i < 60; i++) {
      const sx = (i * 71) % WORLD_W
      const sy = (i * 137) % WORLD_H
      // sólo pintar sparkles donde sea agua (fuera de islas/plaza/bridges)
      if (!isLand(sx, sy)) g.fillRect(sx, sy, 2, 1)
    }
  }

  private drawIslandsAndPlaza(): void {
    // Las islas son rounded rects → tileSprite con grass + máscara, pero
    // como Phaser no hace clip rounded fácilmente, pintamos un rect de grass
    // por isla (los corners "redondeados" se simulan con shoreline encima).
    for (const i of ISLANDS) {
      this.add.tileSprite(i.x, i.y, i.w, i.h, 'sheet:grass', 'tile')
        .setOrigin(0, 0).setDepth(-1500)
      this.drawShoreline(i.x, i.y, i.w, i.h, i.r)
    }
    // Plaza ellipse: cobble plano + rim shadow.
    const p = this.add.graphics().setDepth(-1500)
    p.fillStyle(PALETTE.path, 1)
    p.fillEllipse(PLAZA.x, PLAZA.y, PLAZA.rx * 2, PLAZA.ry * 2)
    // Rim suave
    p.lineStyle(2, 0x000000, 0.12)
    p.strokeEllipse(PLAZA.x, PLAZA.y, PLAZA.rx * 2, PLAZA.ry * 2)
    // Borde arenoso de la plaza (depth justo encima de la plaza)
    const shore = this.add.graphics().setDepth(-1490)
    shore.lineStyle(3, PALETTE.shore, 1)
    shore.strokeEllipse(PLAZA.x, PLAZA.y, PLAZA.rx * 2 + 6, PLAZA.ry * 2 + 6)
  }

  private drawShoreline(x: number, y: number, w: number, h: number, r: number): void {
    // Banda arenosa del contorno (outline con esquinas redondeadas).
    const g = this.add.graphics().setDepth(-1480)
    g.lineStyle(4, PALETTE.shore, 1)
    g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r)
  }

  // ─── Render: puentes ─────────────────────────────────────────────────
  private drawBridges(): void {
    for (const b of BRIDGES) {
      const g = this.add.graphics().setDepth(-1470)
      const dx = b.bx - b.ax, dy = b.by - b.ay
      const len = Math.hypot(dx, dy)
      const ux = dx / len, uy = dy / len
      const px = -uy, py = ux  // perpendicular unit
      const half = b.w / 2

      // Cuerda exterior (oscura)
      g.lineStyle(2, PALETTE.rope, 1)
      for (const sgn of [-1, 1]) {
        g.beginPath()
        g.moveTo(b.ax + sgn * px * half, b.ay + sgn * py * half)
        g.lineTo(b.bx + sgn * px * half, b.by + sgn * py * half)
        g.strokePath()
      }
      // Planks alternados
      const plankStep = 8
      const planks = Math.floor(len / plankStep)
      for (let i = 0; i < planks; i++) {
        const t1 = i / planks, t2 = (i + 1) / planks
        const cx1 = b.ax + ux * (len * t1),  cy1 = b.ay + uy * (len * t1)
        const cx2 = b.ax + ux * (len * t2),  cy2 = b.ay + uy * (len * t2)
        g.fillStyle(i % 2 === 0 ? PALETTE.plank : PALETTE.plankAlt, 1)
        g.beginPath()
        g.moveTo(cx1 + px * half, cy1 + py * half)
        g.lineTo(cx2 + px * half, cy2 + py * half)
        g.lineTo(cx2 - px * half, cy2 - py * half)
        g.lineTo(cx1 - px * half, cy1 - py * half)
        g.closePath()
        g.fillPath()
      }
    }
  }

  // ─── Render: árboles ─────────────────────────────────────────────────
  private drawTrees(): void {
    TREES.forEach((t, i) => {
      const img = this.add.image(t.x, t.y, 'sheet:trees', `t${i}`)
        .setOrigin(0.5, 0.85)
        .setScale(2)
      img.setDepth(t.y + 30)
    })
  }

  // ─── Render: lámparas con halo ───────────────────────────────────────
  private drawLamps(): void {
    for (const l of LAMPS) {
      // Halo cálido
      const halo = this.add.graphics().setDepth(l.y - 1)
      halo.fillStyle(PALETTE.lamp, 0.18)
      halo.fillCircle(l.x, l.y - 2, 32)
      halo.fillStyle(PALETTE.lamp, 0.28)
      halo.fillCircle(l.x, l.y - 2, 18)
      // Poste
      const g = this.add.graphics().setDepth(l.y + 1)
      g.fillStyle(PALETTE.ink, 1); g.fillRect(l.x - 1, l.y - 14, 2, 18)
      g.fillStyle(PALETTE.lamp, 1); g.fillCircle(l.x, l.y - 14, 4)
      g.lineStyle(1, PALETTE.ink, 1); g.strokeCircle(l.x, l.y - 14, 4)
    }
  }

  // ─── Render: deco buildings (cottages, mill, bakery, etc) ────────────
  private drawDecoBuildings(): void {
    for (const d of DECO_BUILDINGS) this.drawDeco(d)
  }

  private drawDeco(d: DecoBuilding): void {
    const g = this.add.graphics()
    const baseY = d.y, x = d.x
    switch (d.kind) {
      case 'cottage': this.drawCottage(g, x, baseY, d.h, d.seed ?? 0); break
      case 'mill':    this.drawMill(g, x, baseY, d.h); break
      case 'bakery':  this.drawBakery(g, x, baseY, d.h); break
      case 'workshop':this.drawWorkshop(g, x, baseY, d.h); break
      case 'barn':    this.drawBarn(g, x, baseY, d.h); break
      case 'stall':   this.drawStall(g, x, baseY, d.h, d.seed ?? 0); break
      case 'well':    this.drawWell(g, x, baseY, d.h); break
      case 'stage':   this.drawStage(g, x, baseY, d.h); break
    }
    g.setDepth(baseY)
  }

  private drawCottage(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number, seed: number): void {
    const w = h * 0.95
    const roofColors = [0xb96b4f, 0x8a99b2, 0xc99f5a, 0xa07a96]
    const roof = roofColors[seed % roofColors.length]
    // sombra
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, by + 4, w * 0.9, 8)
    // pared
    g.fillStyle(PALETTE.cream, 1); g.fillRoundedRect(x - w / 2, by - h * 0.65, w, h * 0.65, 3)
    // techo
    g.fillStyle(roof, 1)
    g.beginPath()
    g.moveTo(x - w / 2 - 3, by - h * 0.65 + 4)
    g.lineTo(x, by - h)
    g.lineTo(x + w / 2 + 3, by - h * 0.65 + 4)
    g.closePath(); g.fillPath()
    // ventana + puerta
    g.fillStyle(0xfff2b3, 1); g.fillCircle(x, by - h * 0.40, 3)
    g.fillStyle(PALETTE.rope, 1); g.fillRect(x - 4, by - 12, 8, 12)
  }

  private drawMill(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number): void {
    const w = h * 0.55
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, by + 4, w, 8)
    // torre piedra
    g.fillStyle(0xb5a892, 1); g.fillRect(x - w / 2, by - h, w, h)
    g.fillStyle(0x9b8e7a, 1); g.fillRect(x - w / 2, by - h, w, 8) // techo cap
    g.fillStyle(0xfff2b3, 1); g.fillCircle(x, by - h * 0.6, 4)
    // aspas (Graphics referenciado para girar en update)
    this.millBlades = this.add.graphics().setDepth(by + 1)
  }

  private drawBakery(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number): void {
    const w = h * 1.1
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x, by + 4, w, 9)
    g.fillStyle(0xd6745a, 1); g.fillRect(x - w / 2, by - h * 0.7, w, h * 0.7)  // ladrillo cálido
    g.fillStyle(0xa44b32, 1); g.fillRect(x - w / 2, by - h, w, h * 0.30)        // techo
    g.fillStyle(0xfff2b3, 1); g.fillRect(x - w / 2 + 5, by - h * 0.5, 8, 8)
    g.fillStyle(PALETTE.rope, 1); g.fillRect(x - 5, by - 16, 10, 16)
    // humo (3 nubecitas, depth alta)
    const smoke = this.add.graphics().setDepth(by + 100)
    smoke.fillStyle(0xffffff, 0.6)
    for (let i = 0; i < 3; i++) smoke.fillCircle(x + w / 2 - 6, by - h - 4 - i * 6, 3 + i)
  }

  private drawWorkshop(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number): void {
    const w = h * 1.0
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x, by + 4, w, 9)
    g.fillStyle(0x8a99b2, 1); g.fillRect(x - w / 2, by - h * 0.7, w, h * 0.7)
    g.fillStyle(0x55677e, 1); g.fillRect(x - w / 2, by - h, w, h * 0.30)
    // ventana con forge glow naranja
    g.fillStyle(0xff8a3c, 1); g.fillRect(x - 6, by - h * 0.45, 12, 10)
    g.fillStyle(0xffd58c, 0.7); g.fillCircle(x, by - h * 0.40, 4)
    g.fillStyle(PALETTE.rope, 1); g.fillRect(x - 5, by - 16, 10, 16)
  }

  private drawBarn(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number): void {
    const w = h * 1.1
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, by + 4, w, 8)
    g.fillStyle(0xa44b32, 1); g.fillRect(x - w / 2, by - h * 0.65, w, h * 0.65)
    g.fillStyle(0x7a3a25, 1)
    // techo abombado
    g.fillEllipse(x, by - h * 0.65, w * 1.05, h * 0.55)
    g.fillRect(x - w / 2, by - h * 0.65, w, 4)
    g.fillStyle(PALETTE.cream, 1)
    g.fillRect(x - 8, by - 18, 16, 18)
    g.fillStyle(PALETTE.rope, 1); g.fillRect(x - 1, by - 18, 2, 18)
  }

  private drawStall(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number, seed: number): void {
    const w = h * 1.2
    const awnings = [0xff7a7a, 0x7abfff, 0xc8e87a]
    const color = awnings[seed % awnings.length]
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, by + 4, w, 6)
    // postes
    g.fillStyle(PALETTE.rope, 1); g.fillRect(x - w / 2, by - h, 3, h); g.fillRect(x + w / 2 - 3, by - h, 3, h)
    // toldo
    g.fillStyle(color, 1)
    g.beginPath(); g.moveTo(x - w / 2 - 4, by - h * 0.7); g.lineTo(x + w / 2 + 4, by - h * 0.7); g.lineTo(x + w / 2 + 4, by - h * 0.5); g.lineTo(x - w / 2 - 4, by - h * 0.5); g.closePath(); g.fillPath()
    // mostrador
    g.fillStyle(0xb98852, 1); g.fillRect(x - w / 2, by - 10, w, 10)
  }

  private drawWell(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number): void {
    const r = h * 0.55
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, by + 4, r * 2.2, 6)
    g.fillStyle(0x8a8a8a, 1); g.fillCircle(x, by - r / 2, r)
    g.fillStyle(0x4a5a6e, 1); g.fillCircle(x, by - r / 2, r * 0.7)
    // techito
    g.fillStyle(0x7a3a25, 1)
    g.beginPath(); g.moveTo(x - r - 2, by - r * 1.2); g.lineTo(x, by - r * 1.9); g.lineTo(x + r + 2, by - r * 1.2); g.closePath(); g.fillPath()
    g.fillStyle(PALETTE.rope, 1); g.fillRect(x - 1, by - r * 1.9, 2, r * 0.7)
  }

  private drawStage(g: Phaser.GameObjects.Graphics, x: number, by: number, h: number): void {
    const w = h * 2
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x, by + 4, w * 0.9, 7)
    g.fillStyle(0xa44b32, 1); g.fillRect(x - w / 2, by - h * 0.4, w, h * 0.4)
    g.fillStyle(0xd6745a, 1); g.fillRect(x - w / 2, by - h * 0.4, w, 4)
    // cortina
    g.fillStyle(0xb22f4a, 1)
    g.fillRect(x - w / 2, by - h, w, h * 0.6)
    g.fillStyle(0x8a1c34, 1)
    for (let i = 0; i < 6; i++) g.fillRect(x - w / 2 + i * (w / 6), by - h, 2, h * 0.6)
  }

  // ─── Render: zonas (casas con sprite) ────────────────────────────────
  private drawZones(): void {
    for (const z of ZONES) {
      const scale = z.w / z.rect.sw
      const img = this.add.image(z.cx, z.cy, `sheet:${z.sheet}`, z.id)
        .setOrigin(0.5, 0.5).setScale(scale)
      img.setDepth(z.cy + z.h / 2 - 4)
      this.add.text(z.cx, z.cy - z.h / 2 - 4, z.badge, { fontSize: '20px' })
        .setOrigin(0.5, 1).setDepth(z.cy + z.h / 2 - 3)
      this.add.text(z.cx, z.cy + z.h / 2 + 6, z.label, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#fff8e7',
        backgroundColor: 'rgba(26,26,46,0.6)', padding: { x: 4, y: 1 },
      }).setOrigin(0.5, 0).setDepth(z.cy + z.h / 2 - 3)
    }
  }

  // ─── Render: runa de spawn ───────────────────────────────────────────
  private drawSpawnRune(): void {
    const { x, y } = SPAWN
    const g = this.add.graphics().setDepth(y - 1)
    g.fillStyle(PALETTE.rune, 0.18); g.fillCircle(x, y, 22)
    g.fillStyle(PALETTE.rune, 0.35); g.fillCircle(x, y, 12)
    this.runeRing = this.add.graphics().setDepth(y)
  }

  // ─── Render: fuente animada ──────────────────────────────────────────
  private drawFountain(): void {
    const { x, y, r } = FOUNTAIN
    const g = this.add.graphics().setDepth(y)
    // base
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x, y + r * 0.6, r * 2.3, 8)
    g.fillStyle(0x8a8a8a, 1); g.fillCircle(x, y, r)
    g.fillStyle(0x4ea3c7, 1); g.fillCircle(x, y, r * 0.78)
    g.fillStyle(0xb5a892, 1); g.fillCircle(x, y, r * 0.22)  // pilar central
    this.fountainJet = this.add.graphics().setDepth(y + 1)
  }

  // ─── Input ──────────────────────────────────────────────────────────
  private onPointer(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y)

    // ¿click en otro poporing? (radio 18 px)
    for (const op of this.others.values()) {
      const dx = world.x - op.x, dy = world.y - op.y
      if (dx * dx + dy * dy < 18 * 18) {
        this.bus.emit(TOWN_EVENT.poporingClick, op.user)
        return
      }
    }

    // ¿click en zona (casa)?
    const z = zoneAt(world.x, world.y)
    if (z) {
      this.bus.emit(TOWN_EVENT.buildingEnter, z.id)
      this.walkTo(z.doorX, z.doorY)
      return
    }

    if (isLand(world.x, world.y)) this.walkTo(world.x, world.y)
  }

  private walkTo(x: number, y: number): void {
    this.targetX = x; this.targetY = y; this.moving = true
  }

  // ─── Update ─────────────────────────────────────────────────────────
  update(_t: number, delta: number): void {
    this.fountainT += delta * 0.005
    this.millT += delta * 0.001
    this.animateFountain()
    this.animateRune()
    this.animateMill()

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

  private animateFountain(): void {
    if (!this.fountainJet) return
    const g = this.fountainJet
    g.clear()
    const { x, y } = FOUNTAIN
    const jetH = 14 + Math.sin(this.fountainT) * 3
    g.fillStyle(0x9fd8ff, 0.9); g.fillRect(x - 1, y - jetH, 2, jetH)
    g.fillStyle(0x9fd8ff, 0.7); g.fillCircle(x, y - jetH, 2)
    // gotitas
    for (let i = 0; i < 4; i++) {
      const t = (this.fountainT + i * 0.3) % 1.4
      const dx = (i % 2 === 0 ? -1 : 1) * t * 8
      const dy = -jetH + t * t * 14
      g.fillStyle(0x9fd8ff, 1 - t / 1.4); g.fillCircle(x + dx, y + dy, 1.5)
    }
  }

  private animateRune(): void {
    if (!this.runeRing) return
    const g = this.runeRing
    g.clear()
    const { x, y } = SPAWN
    const t = this.fountainT * 0.6
    g.lineStyle(2, PALETTE.rune, 0.9)
    g.beginPath()
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * Math.PI * 2 + t
      const a2 = ((i + 0.5) / 6) * Math.PI * 2 + t
      g.moveTo(x + Math.cos(a1) * 16, y + Math.sin(a1) * 16)
      g.lineTo(x + Math.cos(a2) * 16, y + Math.sin(a2) * 16)
    }
    g.strokePath()
  }

  private animateMill(): void {
    if (!this.millBlades) return
    const mill = DECO_BUILDINGS.find(d => d.kind === 'mill')
    if (!mill) return
    const g = this.millBlades
    g.clear()
    const cx = mill.x + 14, cy = mill.y - mill.h + 12
    g.lineStyle(3, PALETTE.cream, 1)
    for (let i = 0; i < 4; i++) {
      const a = this.millT * 2 + (i * Math.PI) / 2
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22)
      g.strokePath()
    }
    g.fillStyle(PALETTE.ink, 1); g.fillCircle(cx, cy, 2)
  }

  // ─── Presencia ──────────────────────────────────────────────────────
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
}


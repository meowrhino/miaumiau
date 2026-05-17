// Sprite procedural del poporing — un Container con Graphics + texto del nombre.
// Color e idle dependen del PublicUser. Cero PNG, todo dibujado.
import Phaser from 'phaser'
import type { PublicUser } from '../../api'

const COLOR_MAP: Record<string, number> = {
  Coral: 0xff8b8b, Limón: 0xfff59d, Menta: 0xa8e6cf, Cielo: 0x9fd8ff,
  Lavanda: 0xc9b6f0, Melocotón: 0xffd6a5, Crema: 0xfff8e7, Rosa: 0xffc8dd,
}

function colorOf(user: PublicUser): number {
  if (user.color.startsWith('#')) return parseInt(user.color.slice(1), 16)
  return COLOR_MAP[user.color] ?? 0xffd6a5
}

export class Poporing extends Phaser.GameObjects.Container {
  public uid: number
  private gfx: Phaser.GameObjects.Graphics
  private nameLabel: Phaser.GameObjects.Text
  private bobT = 0

  constructor(scene: Phaser.Scene, x: number, y: number, public user: PublicUser) {
    super(scene, x, y)
    this.uid = user.id
    this.gfx = scene.add.graphics()
    this.nameLabel = scene.add.text(0, -22, user.name, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#fff8e7',
      backgroundColor: 'rgba(26,26,46,0.7)', padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 1)
    this.add([this.gfx, this.nameLabel])
    this.draw()
    scene.add.existing(this as Phaser.GameObjects.GameObject)
    this.setDepth(y)
  }

  setUser(user: PublicUser): void {
    this.user = user
    this.nameLabel.setText(user.name)
    this.draw()
  }

  draw(): void {
    const g = this.gfx
    g.clear()
    const c = colorOf(this.user)
    // sombra dura (más opaca = se pega al suelo)
    g.fillStyle(0x000000, 0.32)
    g.fillEllipse(0, 7, 24, 7)
    // cuerpo (gota)
    g.fillStyle(c, 1)
    g.fillRoundedRect(-11, -14, 22, 18, 9)
    g.fillCircle(-6, -14, 4)
    g.fillCircle(6, -14, 4)
    // ojos
    g.fillStyle(0x2a2a3a, 1)
    g.fillCircle(-4, -7, 1.4)
    g.fillCircle(4, -7, 1.4)
    // boquita
    g.lineStyle(1, 0x2a2a3a, 1)
    g.beginPath(); g.moveTo(-2, -3); g.lineTo(0, -2); g.lineTo(2, -3); g.strokePath()
  }

  tickIdle(deltaMs: number): void {
    this.bobT += deltaMs * 0.004
    this.gfx.y = Math.sin(this.bobT) * 0.7
    this.setDepth(this.y)
  }
}

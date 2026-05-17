// Configuración + instancia de Phaser. Una sola Game viva por sesión.
import Phaser from 'phaser'
import { PALETTE } from '../config'
import { Boot } from './scenes/Boot'
import { Town } from './scenes/Town'

let game: Phaser.Game | null = null

// Resolución interna fija: el canvas siempre dibuja a 1280×720, y CSS lo
// escala para llenar el parent. Más robusto que RESIZE (que se vuelve 0×0
// si el parent todavía no tiene tamaño cuando Phaser mide).
const RENDER_W = 1280
const RENDER_H = 720

export function startGame(parent: HTMLElement): { game: Phaser.Game; town: Town } {
  if (game) game.destroy(true)
  const town = new Town()
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: `#${PALETTE.bg.toString(16).padStart(6, '0')}`,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: RENDER_W,
      height: RENDER_H,
    },
    scene: [Boot, town],
    pixelArt: false,
    banner: false,
  })
  return { game, town }
}

export function stopGame(): void {
  if (game) { game.destroy(true); game = null }
}

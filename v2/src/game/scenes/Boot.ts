// Escena de arranque. Por ahora no carga assets (poporing es procedural).
// Cuando metamos sprites del Sprout pack, se preloadan aquí.
import Phaser from 'phaser'

export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }

  preload(): void {
    // Aquí irán: this.load.image('tile_grass', '/img/tiles/grass_sheet.png'), etc.
  }

  create(): void {
    this.scene.start('Town')
  }
}

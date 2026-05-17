// Carga los sheets de Sprout Lands antes de arrancar Town.
// Los assets viven en /img/ (servidos por Cloudflare ASSETS desde public/).
import Phaser from 'phaser'

export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }

  preload(): void {
    this.load.image('sheet:grass',  '/img/tiles/grass_sheet.png')
    this.load.image('sheet:house',  '/img/buildings/house_sheet.png')
    this.load.image('sheet:trees',  '/img/deco/trees_sheet.png')
    this.load.image('sheet:hut',    '/img/deco/hut_sheet.png')
    this.load.image('sheet:brick',  '/img/deco/brick_sheet.png')
  }

  create(): void {
    this.scene.start('Town')
  }
}

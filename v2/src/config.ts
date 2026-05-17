// Constantes globales — todo lo "afinable" del juego pasa por aquí.

export const TILE = 32                // tamaño del tile en px (para el grass)
export const WORLD_W = 1280           // ancho del mundo en px
export const WORLD_H = 720            // alto del mundo en px

export const WALK_SPEED = 180         // px / segundo
export const PRESENCE_HZ = 1          // ticks/s del polling de presencia

export const API_BASE = '/api/v2'

// Paleta cozy.
export const PALETTE = {
  bg:       0x1a1a2e,
  water:    0x4ea3c7,
  waterDk:  0x3d8aaf,
  shore:    0xe9d8a6,
  grass:    0x88c070,
  grassAlt: 0x77b35f,
  path:     0xd9b380,
  plank:    0xb98852,
  plankAlt: 0xa57442,
  rope:     0x6b4f3b,
  ink:      0x2a2a3a,
  cream:    0xfff8e7,
  lamp:     0xffd58c,
  rune:     0xc9b6f0,
} as const

// 6 zonas + plaza. casita (perfil propio) NO es una zona de tablón.
export const ZONES = ['plaza', 'cafe', 'tablon', 'miradero', 'polaroid', 'banquito'] as const
export type Zone = typeof ZONES[number]

// Constantes globales — todo lo "afinable" del juego pasa por aquí.

export const TILE = 32                // tamaño del tile en px
export const ISLAND_COLS = 30
export const ISLAND_ROWS = 22
export const WORLD_W = ISLAND_COLS * TILE
export const WORLD_H = ISLAND_ROWS * TILE

export const WALK_SPEED = 110         // px / segundo
export const PRESENCE_HZ = 1          // ticks por segundo del polling de presencia

export const API_BASE = '/api/v2'

// Colores de la paleta cozy — usados para el poporing y los tablones.
export const PALETTE = {
  bg:       0x1a1a2e,
  water:    0x4ea3c7,
  shore:    0xe9d8a6,
  grass:    0x88c070,
  grassAlt: 0x77b35f,
  path:     0xd9b380,
  ink:      0x2a2a3a,
  cream:    0xfff8e7,
} as const

export const ZONES = ['plaza', 'cafe', 'tablon', 'miradero'] as const
export type Zone = typeof ZONES[number]

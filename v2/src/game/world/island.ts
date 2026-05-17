// Tilemap de la isla MVP. Una matriz simple — 0 agua, 1 hierba, 2 hierba alt,
// 3 camino. Phaser dibuja cada tile como un rectángulo coloreado.
// Cuando exportemos a Tiled, solo cambia el cargador del tilemap.
import { ISLAND_COLS, ISLAND_ROWS, TILE, PALETTE } from '../../config'

export const TILE_WATER = 0
export const TILE_GRASS = 1
export const TILE_GRASS_ALT = 2
export const TILE_PATH = 3

export type TileKind = 0 | 1 | 2 | 3

export interface Building {
  id: string          // identifica la zona/tablón al entrar
  label: string       // texto que se muestra sobre el edificio
  emoji: string
  // bbox en tiles
  x: number; y: number; w: number; h: number
  // punto de entrada (doormat) en tiles
  doorX: number; doorY: number
}

// Lake-style island: agua en el borde, hierba dentro, un camino central
// con la fuente/plaza, y cuatro edificios principales.
function buildTiles(): TileKind[][] {
  const cols = ISLAND_COLS, rows = ISLAND_ROWS
  const t: TileKind[][] = []
  for (let y = 0; y < rows; y++) {
    const row: TileKind[] = []
    for (let x = 0; x < cols; x++) {
      // Borde de agua de 2 tiles + esquinas suaves
      const insetX = Math.min(x, cols - 1 - x)
      const insetY = Math.min(y, rows - 1 - y)
      const isWater = insetX < 2 || insetY < 2 || (insetX + insetY < 4)
      if (isWater) { row.push(TILE_WATER); continue }
      // Hierba con variante en damero suave
      row.push(((x * 7 + y * 11) % 9 === 0 ? TILE_GRASS_ALT : TILE_GRASS) as TileKind)
    }
    t.push(row)
  }
  // Camino horizontal y vertical en cruz
  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)
  for (let x = 4; x < cols - 4; x++) t[cy][x] = TILE_PATH
  for (let y = 4; y < rows - 4; y++) t[y][cx] = TILE_PATH
  return t
}

export const TILES = buildTiles()

export const BUILDINGS: Building[] = [
  { id: 'cafe',     label: 'café',     emoji: '☕', x: 6,  y: 5,  w: 3, h: 3, doorX: 7,  doorY: 8 },
  { id: 'tablon',   label: 'tablón',   emoji: '📌', x: 21, y: 5,  w: 3, h: 3, doorX: 22, doorY: 8 },
  { id: 'miradero', label: 'miradero', emoji: '🌙', x: 6,  y: 14, w: 3, h: 3, doorX: 7,  doorY: 14 },
  { id: 'casita',   label: 'tu casa',  emoji: '🏠', x: 21, y: 14, w: 3, h: 3, doorX: 22, doorY: 14 },
]

export function isLand(px: number, py: number): boolean {
  const tx = Math.floor(px / TILE)
  const ty = Math.floor(py / TILE)
  if (tx < 0 || ty < 0 || tx >= ISLAND_COLS || ty >= ISLAND_ROWS) return false
  return TILES[ty][tx] !== TILE_WATER
}

// Devuelve el edificio cuya doorbox contiene el punto, o null.
export function buildingAt(px: number, py: number): Building | null {
  const tx = Math.floor(px / TILE)
  const ty = Math.floor(py / TILE)
  for (const b of BUILDINGS) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return b
  }
  return null
}

export function tileColor(t: TileKind): number {
  switch (t) {
    case TILE_WATER:     return PALETTE.water
    case TILE_GRASS:     return PALETTE.grass
    case TILE_GRASS_ALT: return PALETTE.grassAlt
    case TILE_PATH:      return PALETTE.path
  }
}

// Tilemap + capa de edificios. Tiles son 32×32 px y se pintan con
// grass_sheet (Sprout Lands). Los edificios usan house_sheet con un
// sub-rect distinto por zona.
import { ISLAND_COLS, ISLAND_ROWS, TILE, PALETTE } from '../../config'

export const TILE_WATER = 0
export const TILE_GRASS = 1
export const TILE_PATH = 2
export type TileKind = 0 | 1 | 2

export interface SheetRect { sx: number; sy: number; sw: number; sh: number }

export interface Building {
  id: string
  label: string
  sheet: 'house' | 'brick' | 'hut'
  rect: SheetRect
  x: number; y: number; w: number; h: number  // bbox en tiles
  doorX: number; doorY: number                // doormat en tiles
}

export interface Decoration {
  sheet: 'trees'
  rect: SheetRect
  x: number; y: number   // tile coords
}

// ─── Sub-rects de los sheets de Sprout Lands ─────────────────────────────
// Tomados del legacy (city.config.js). Cada zona tiene su variante de techo.
export const GRASS_RECT: SheetRect = { sx: 96, sy: 224, sw: 16, sh: 16 }

const HOUSE_RECT = (col: number, row: number): SheetRect =>
  ({ sx: col * 64, sy: row * 64, sw: 64, sh: 64 })

// Grid del house_sheet (3×3, 64×64 c/u): blue, green, pink / yellow, orange, brown / red, purple, gray
const HOUSE = {
  blue:   HOUSE_RECT(0, 0), green:  HOUSE_RECT(1, 0), pink:   HOUSE_RECT(2, 0),
  yellow: HOUSE_RECT(0, 1), orange: HOUSE_RECT(1, 1), brown:  HOUSE_RECT(2, 1),
  red:    HOUSE_RECT(0, 2), purple: HOUSE_RECT(1, 2), gray:   HOUSE_RECT(2, 2),
}

const TREE_RECTS: SheetRect[] = [
  { sx: 0,   sy: 0, sw: 32, sh: 48 },
  { sx: 32,  sy: 0, sw: 32, sh: 48 },
  { sx: 96,  sy: 0, sw: 32, sh: 48 },
  { sx: 160, sy: 0, sw: 32, sh: 48 },
]

// ─── Layout de la isla ───────────────────────────────────────────────────
function buildTiles(): TileKind[][] {
  const cols = ISLAND_COLS, rows = ISLAND_ROWS
  const t: TileKind[][] = []
  for (let y = 0; y < rows; y++) {
    const row: TileKind[] = []
    for (let x = 0; x < cols; x++) {
      const insetX = Math.min(x, cols - 1 - x)
      const insetY = Math.min(y, rows - 1 - y)
      // Borde de mar + esquinas redondeadas
      const isWater = insetX < 2 || insetY < 2 || (insetX + insetY < 4)
      row.push(isWater ? TILE_WATER : TILE_GRASS)
    }
    t.push(row)
  }
  // Camino en cruz hacia los 4 edificios
  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)
  for (let x = 4; x < cols - 4; x++) t[cy][x] = TILE_PATH
  for (let y = 4; y < rows - 4; y++) t[y][cx] = TILE_PATH
  return t
}

export const TILES = buildTiles()

export const BUILDINGS: Building[] = [
  { id: 'cafe',     label: 'café',     sheet: 'house', rect: HOUSE.orange, x: 5,  y: 4,  w: 4, h: 4, doorX: 7,  doorY: 8 },
  { id: 'tablon',   label: 'tablón',   sheet: 'house', rect: HOUSE.blue,   x: 21, y: 4,  w: 4, h: 4, doorX: 23, doorY: 8 },
  { id: 'miradero', label: 'miradero', sheet: 'house', rect: HOUSE.purple, x: 5,  y: 13, w: 4, h: 4, doorX: 7,  doorY: 13 },
  { id: 'casita',   label: 'tu casa',  sheet: 'house', rect: HOUSE.pink,   x: 21, y: 13, w: 4, h: 4, doorX: 23, doorY: 13 },
]

// Árboles decorativos esparcidos por la isla (no colisionan, sólo deco).
export const TREES: Decoration[] = [
  { sheet: 'trees', rect: TREE_RECTS[0], x: 3,  y: 4 },
  { sheet: 'trees', rect: TREE_RECTS[1], x: 12, y: 3 },
  { sheet: 'trees', rect: TREE_RECTS[2], x: 17, y: 3 },
  { sheet: 'trees', rect: TREE_RECTS[3], x: 26, y: 4 },
  { sheet: 'trees', rect: TREE_RECTS[1], x: 2,  y: 11 },
  { sheet: 'trees', rect: TREE_RECTS[3], x: 14, y: 12 },
  { sheet: 'trees', rect: TREE_RECTS[0], x: 27, y: 11 },
  { sheet: 'trees', rect: TREE_RECTS[2], x: 4,  y: 19 },
  { sheet: 'trees', rect: TREE_RECTS[1], x: 12, y: 19 },
  { sheet: 'trees', rect: TREE_RECTS[3], x: 17, y: 19 },
  { sheet: 'trees', rect: TREE_RECTS[0], x: 26, y: 19 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────
export function isLand(px: number, py: number): boolean {
  const tx = Math.floor(px / TILE)
  const ty = Math.floor(py / TILE)
  if (tx < 0 || ty < 0 || tx >= ISLAND_COLS || ty >= ISLAND_ROWS) return false
  return TILES[ty][tx] !== TILE_WATER
}

export function buildingAt(px: number, py: number): Building | null {
  const tx = Math.floor(px / TILE)
  const ty = Math.floor(py / TILE)
  for (const b of BUILDINGS) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return b
  }
  return null
}

export function pathColor(): number { return PALETTE.path }

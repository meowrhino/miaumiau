// Geometría del pueblo: 3 islas + plaza central + puentes que las conectan.
// Coordenadas absolutas en px (world = 1280×720). Reusa el layout del
// legacy (city.config.js).
import { WORLD_W, WORLD_H } from '../../config'

export interface SheetRect { sx: number; sy: number; sw: number; sh: number }

// ─── Sheets de Sprout Lands ──────────────────────────────────────────────
// Múltiples variantes de hierba — esparcir random rompe el aspecto plano.
// (Sprout grass_sheet bottom tiene 3 bloques grandes con variedad interna.)
export const GRASS_VARIANTS: SheetRect[] = [
  { sx: 16,  sy: 240, sw: 16, sh: 16 }, // plain 1
  { sx: 48,  sy: 256, sw: 16, sh: 16 }, // plain 2
  { sx: 96,  sy: 224, sw: 16, sh: 16 }, // plain 3
  { sx: 112, sy: 256, sw: 16, sh: 16 }, // con detalle
  { sx: 32,  sy: 336, sw: 16, sh: 16 }, // con flor
  { sx: 96,  sy: 320, sw: 16, sh: 16 }, // con flor alt
]
export const GRASS_RECT = GRASS_VARIANTS[0]   // fallback usado en deco

const HOUSE_RECT = (col: number, row: number): SheetRect =>
  ({ sx: col * 64, sy: row * 64, sw: 64, sh: 64 })

// Grid del house_sheet (3×3 de 64×64): blue/green/pink / yellow/orange/brown / red/purple/gray
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

// ─── Islas y plaza ───────────────────────────────────────────────────────
export const ISLAND_R = 36
export interface Island { id: 'nw' | 'ne' | 'se'; x: number; y: number; w: number; h: number; r: number }

export const ISLANDS: Island[] = [
  { id: 'nw', x: 40,  y: 60,  w: 400, h: 290, r: ISLAND_R },
  { id: 'ne', x: 820, y: 40,  w: 420, h: 320, r: ISLAND_R },
  { id: 'se', x: 760, y: 460, w: 480, h: 240, r: ISLAND_R },
]

// Plaza central (ellipse).
export const PLAZA = { x: 640, y: 490, rx: 180, ry: 120 }
export const FOUNTAIN = { x: 640, y: 510, r: 28 }
export const SPAWN = { x: 640, y: 420 }

// Bridges plaza ↔ islas. (ax,ay) está dentro de la plaza, (bx,by) dentro
// de la isla → solapamiento que evita gaps de agua.
export interface Bridge { ax: number; ay: number; bx: number; by: number; w: number }
export const BRIDGES: Bridge[] = [
  { ax: 510, ay: 410, bx: 415, by: 335, w: 26 }, // plaza → NW
  { ax: 770, ay: 410, bx: 850, by: 345, w: 26 }, // plaza → NE
  { ax: 810, ay: 510, bx: 770, by: 510, w: 26 }, // plaza → SE
]

// Lámparas (una por puente, en el midpoint).
export const LAMPS = BRIDGES.map(b => ({
  x: Math.round((b.ax + b.bx) / 2),
  y: Math.round((b.ay + b.by) / 2),
}))

// ─── Zonas funcionales (con sprite de casa) ──────────────────────────────
export type ZoneId = 'cafe' | 'tablon' | 'miradero' | 'polaroid' | 'banquito' | 'casita'

export interface Zone {
  id: ZoneId
  label: string
  badge: string                    // emoji-sello sobre el techo
  sheet: 'house'
  rect: SheetRect
  // bbox del sprite render (centro x/y, ancho/alto)
  cx: number; cy: number; w: number; h: number
  // doormat (donde aterriza el poporing al entrar)
  doorX: number; doorY: number
}

export const ZONES: Zone[] = [
  // ─── ISLA NW (relax / social) ───
  { id: 'cafe',     label: 'el café',     badge: '☕', sheet: 'house', rect: HOUSE.orange, cx: 170, cy: 170, w: 112, h: 112, doorX: 170, doorY: 240 },
  { id: 'tablon',   label: 'el tablón',   badge: '📌', sheet: 'house', rect: HOUSE.blue,   cx: 330, cy: 250, w: 112, h: 112, doorX: 330, doorY: 320 },
  // ─── ISLA NE (visual / alta) ───
  { id: 'miradero', label: 'el miradero', badge: '🌙', sheet: 'house', rect: HOUSE.purple, cx: 940,  cy: 150, w: 112, h: 112, doorX: 940,  doorY: 220 },
  { id: 'polaroid', label: 'la polaroid', badge: '📷', sheet: 'house', rect: HOUSE.yellow, cx: 1140, cy: 250, w: 112, h: 112, doorX: 1140, doorY: 320 },
  // ─── ISLA SE (íntima / cozy) ───
  { id: 'banquito', label: 'el banquito', badge: '🪑', sheet: 'house', rect: HOUSE.green,  cx: 890,  cy: 550, w: 112, h: 112, doorX: 890,  doorY: 620 },
  { id: 'casita',   label: 'tu casa',     badge: '🏠', sheet: 'house', rect: HOUSE.pink,   cx: 1110, cy: 610, w: 112, h: 112, doorX: 1110, doorY: 680 },
]

// ─── Edificios decorativos (sin zona, sólo deco) ─────────────────────────
export type DecoKind = 'cottage' | 'mill' | 'bakery' | 'workshop' | 'barn' | 'stall' | 'well' | 'stage'

export interface DecoBuilding {
  kind: DecoKind
  x: number; y: number     // anchor inferior-centro
  h: number                // alto en px (ancho derivado)
  seed?: number            // para variar colores en cottage/stall
}

export const DECO_BUILDINGS: DecoBuilding[] = [
  // ISLA NW
  { kind: 'cottage', seed: 11, x: 100,  y: 120, h: 80 },
  { kind: 'cottage', seed: 44, x: 410,  y: 130, h: 80 },
  // ISLA NE
  { kind: 'cottage', seed: 22, x: 840,  y: 110, h: 80 },
  { kind: 'cottage', seed: 33, x: 1210, y: 110, h: 80 },
  { kind: 'mill',    x: 1190, y: 320,  h: 130 },
  // ISLA SE
  { kind: 'bakery',   x: 800,  y: 680, h: 90 },
  { kind: 'workshop', x: 1210, y: 540, h: 90 },
  { kind: 'barn',     x: 1010, y: 690, h: 75 },
  // PLAZA
  { kind: 'well',  x: 720, y: 540, h: 50 },
  { kind: 'stage', x: 560, y: 540, h: 42 },
  { kind: 'stall', seed: 7,  x: 580, y: 458, h: 48 },
  { kind: 'stall', seed: 13, x: 700, y: 458, h: 48 },
]

// ─── Árboles ─────────────────────────────────────────────────────────────
export interface TreeDeco { variant: number; x: number; y: number }
export const TREES: TreeDeco[] = [
  // NW
  { variant: 0, x: 60,  y: 110 }, { variant: 1, x: 260, y: 80  },
  { variant: 2, x: 90,  y: 320 }, { variant: 3, x: 420, y: 300 },
  // NE
  { variant: 0, x: 830, y: 70  }, { variant: 3, x: 1090, y: 70 },
  { variant: 1, x: 1240, y: 350 },
  // SE
  { variant: 2, x: 770, y: 480 }, { variant: 0, x: 1230, y: 560 },
  { variant: 3, x: 1000, y: 690 },
]
export const TREE_RECT_FOR = (v: number): SheetRect => TREE_RECTS[v % TREE_RECTS.length]

// ─── NPCs ambientales (poporings estáticos que dan vida sin ser jugadores) ─
export interface AmbientNpc { x: number; y: number; color: number; name?: string }
export const AMBIENT_NPCS: AmbientNpc[] = [
  // NW — alrededor del café
  { x: 215, y: 235, color: 0xffb86c, name: 'pep' },          // junto al café
  { x: 280, y: 305, color: 0xa8e6cf },                       // entre café y tablón
  // NE — junto al miradero / mill
  { x: 985, y: 215, color: 0xc9b6f0, name: 'lulu' },         // junto al miradero
  { x: 1175, y: 365, color: 0xffd6a5 },                      // junto al mill
  // SE — banquito / casita / bakery
  { x: 845, y: 615, color: 0xff8b8b, name: 'kiki' },         // junto al banquito
  { x: 850, y: 680, color: 0xfff59d },                       // junto a la bakery
  // PLAZA — la zona más viva
  { x: 600, y: 510, color: 0x9fd8ff, name: 'tuto' },         // junto al stage
  { x: 700, y: 530, color: 0xffc8dd },                       // junto al well
]

// ─── Flores en racimos (clusters de 3-5 flores en spots fijos) ───────────
// Color RGB de cada pétalo; el grass sheet ya trae variantes con flores, pero
// añadir racimos extra dibujados con primitivas concentra el ojo.
export interface FlowerCluster { x: number; y: number; color: number; n: number }
export const FLOWER_CLUSTERS: FlowerCluster[] = [
  // NW
  { x: 130, y: 200, color: 0xff8b8b, n: 4 },
  { x: 380, y: 180, color: 0xfff59d, n: 5 },
  { x: 100, y: 290, color: 0xffc8dd, n: 3 },
  // NE
  { x: 870, y: 130, color: 0xff8b8b, n: 4 },
  { x: 1180, y: 95,  color: 0xfff59d, n: 3 },
  { x: 1060, y: 340, color: 0xc9b6f0, n: 5 },
  // SE
  { x: 800, y: 510, color: 0xff8b8b, n: 4 },
  { x: 950, y: 670, color: 0xffc8dd, n: 4 },
  { x: 1100, y: 480, color: 0xfff59d, n: 3 },
  // Plaza (junto a stalls)
  { x: 525, y: 480, color: 0xff8b8b, n: 3 },
  { x: 750, y: 480, color: 0xc9b6f0, n: 3 },
]

// ─── Props "contra pared" — barriles, sacos, macetas junto a cada zona ───
export interface WallProp { x: number; y: number; kind: 'barrel' | 'sack' | 'pot' | 'box' }
export const WALL_PROPS: WallProp[] = [
  // cada par junto a una zone (cerca del doormat)
  { x: 115, y: 220, kind: 'barrel' },                      // café
  { x: 225, y: 215, kind: 'pot' },
  { x: 280, y: 295, kind: 'sack' },                        // tablón
  { x: 380, y: 290, kind: 'box' },
  { x: 880, y: 195, kind: 'barrel' },                      // miradero
  { x: 1000, y: 195, kind: 'pot' },
  { x: 1085, y: 295, kind: 'sack' },                       // polaroid
  { x: 1195, y: 295, kind: 'barrel' },
  { x: 835, y: 595, kind: 'pot' },                         // banquito
  { x: 945, y: 595, kind: 'box' },
  { x: 1055, y: 655, kind: 'sack' },                       // casita
  { x: 1165, y: 655, kind: 'pot' },
]

// ─── Colisión: ¿este punto está en tierra firme? ─────────────────────────
function pointInRoundedRect(px: number, py: number, rect: Island): boolean {
  const { x, y, w, h, r } = rect
  if (px < x || py < y || px > x + w || py > y + h) return false
  // Cuatro esquinas recortadas por arco de radio r
  const corners = [
    { cx: x + r,     cy: y + r,     vx: x,     vy: y     },
    { cx: x + w - r, cy: y + r,     vx: x + w, vy: y     },
    { cx: x + r,     cy: y + h - r, vx: x,     vy: y + h },
    { cx: x + w - r, cy: y + h - r, vx: x + w, vy: y + h },
  ]
  for (const c of corners) {
    if ((px - c.vx) * (px - c.vx) + (py - c.vy) * (py - c.vy) > 0) {
      // dentro de la "esquina cuadrada" pero fuera del rectángulo central
      const inXCorner = (c.vx === x ? px < x + r : px > x + w - r)
      const inYCorner = (c.vy === y ? py < y + r : py > y + h - r)
      if (inXCorner && inYCorner) {
        const dx = px - c.cx, dy = py - c.cy
        if (dx * dx + dy * dy > r * r) return false
      }
    }
  }
  return true
}

function pointInEllipse(px: number, py: number, e: typeof PLAZA): boolean {
  const dx = (px - e.x) / e.rx
  const dy = (py - e.y) / e.ry
  return dx * dx + dy * dy <= 1
}

function pointInBridge(px: number, py: number, b: Bridge): boolean {
  // Proyectamos el punto sobre el segmento (ax,ay)-(bx,by). Si la distancia
  // perpendicular es ≤ w/2 y la proyección cae en [0,1], es puente.
  const vx = b.bx - b.ax, vy = b.by - b.ay
  const len2 = vx * vx + vy * vy
  if (len2 === 0) return false
  const t = ((px - b.ax) * vx + (py - b.ay) * vy) / len2
  if (t < 0 || t > 1) return false
  const projX = b.ax + t * vx, projY = b.ay + t * vy
  const dx = px - projX, dy = py - projY
  return dx * dx + dy * dy <= (b.w / 2) * (b.w / 2)
}

export function islandAt(px: number, py: number): Island | null {
  for (const i of ISLANDS) if (pointInRoundedRect(px, py, i)) return i
  return null
}
export function inPlaza(px: number, py: number): boolean { return pointInEllipse(px, py, PLAZA) }
export function inBridge(px: number, py: number): boolean {
  for (const b of BRIDGES) if (pointInBridge(px, py, b)) return true
  return false
}
export function isLand(px: number, py: number): boolean {
  if (px < 0 || py < 0 || px > WORLD_W || py > WORLD_H) return false
  return !!islandAt(px, py) || inPlaza(px, py) || inBridge(px, py)
}

// ─── Click sobre zona: ¿este punto cae en el bbox de alguna casa? ────────
export function zoneAt(px: number, py: number): Zone | null {
  for (const z of ZONES) {
    if (px >= z.cx - z.w / 2 && px <= z.cx + z.w / 2 &&
        py >= z.cy - z.h / 2 && py <= z.cy + z.h / 2) return z
  }
  return null
}

// Generador procedural de gatos SVG
// Determinista: mismo seed + color = mismo gato siempre

function seedRng(seed: number) {
  let state = seed | 0
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) | 0; return (state >>> 0) / 0xFFFFFFFF }
  const int = (n: number) => Math.floor(next() * n)
  const pick = <T>(arr: T[]) => arr[int(arr.length)]
  return { next, int, pick }
}

// Colores derivados del color base del usuario
function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `rgb(${r},${g},${b})`
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `rgb(${r},${g},${b})`
}

// Lookup rápido de colores W3C (subconjunto)
const COLORS: Record<string, string> = {
  Coral: '#FF7F50', Tomato: '#FF6347', OrangeRed: '#FF4500', Gold: '#FFD700',
  Orange: '#FFA500', Khaki: '#F0E68C', Lime: '#00FF00', MediumSeaGreen: '#3CB371',
  Teal: '#008080', Turquoise: '#40E0D0', SteelBlue: '#4682B4', DodgerBlue: '#1E90FF',
  SlateBlue: '#6A5ACD', BlueViolet: '#8A2BE2', Orchid: '#DA70D6', HotPink: '#FF69B4',
  Crimson: '#DC143C', Salmon: '#FA8072', Peru: '#CD853F', SaddleBrown: '#8B4513',
  Olive: '#808000', DarkCyan: '#008B8B', MidnightBlue: '#191970', Indigo: '#4B0082',
  RosyBrown: '#BC8F8F', CadetBlue: '#5F9EA0', MediumPurple: '#9370DB', PaleVioletRed: '#DB7093',
  DarkOrange: '#FF8C00', LimeGreen: '#32CD32', DeepSkyBlue: '#00BFFF', Plum: '#DDA0DD'
}

export function colorHex(name: string): string {
  return COLORS[name] ?? '#808080'
}

export const COLOR_NAMES = Object.keys(COLORS)

export function generateCatSvg(seed: number, colorName: string): string {
  const r = seedRng(seed)
  const base = colorHex(colorName)
  const light = lighten(base, 40)
  const dark = darken(base, 40)
  const pink = '#FFB6C1'

  // Body shape
  const bodies = [
    `<ellipse cx="32" cy="38" rx="18" ry="16"/>`,                    // redondo
    `<ellipse cx="32" cy="38" rx="14" ry="18"/>`,                    // delgado
    `<ellipse cx="32" cy="38" rx="20" ry="14"/>`,                    // gordito
    `<ellipse cx="32" cy="40" rx="13" ry="12"/>`,                    // pequeño
  ]

  // Ears
  const ears = [
    `<polygon points="16,22 12,8 24,18"/><polygon points="48,22 52,8 40,18"/>`,       // puntudo
    `<polygon points="16,22 14,10 24,18"/><polygon points="48,22 50,10 40,18"/>
     <line x1="14" y1="10" x2="18" y2="16" stroke="${dark}" stroke-width="1.5"/>
     <line x1="50" y1="10" x2="46" y2="16" stroke="${dark}" stroke-width="1.5"/>`,     // doblado
    `<polygon points="16,22 10,6 24,18"/><polygon points="48,22 54,6 40,18"/>`,        // largo
    `<polygon points="18,22 14,12 26,18"/><polygon points="46,22 50,12 38,18"/>`,      // redondeado
  ]

  // Inner ears
  const innerEar = `<polygon points="17,20 14,12 22,18" fill="${pink}" opacity="0.6"/>
    <polygon points="47,20 50,12 42,18" fill="${pink}" opacity="0.6"/>`

  // Eyes
  const eyes = [
    `<circle cx="26" cy="30" r="3" fill="#fff"/><circle cx="38" cy="30" r="3" fill="#fff"/>
     <circle cx="27" cy="30" r="1.5" fill="#222"/><circle cx="39" cy="30" r="1.5" fill="#222"/>`,  // redondo
    `<ellipse cx="26" cy="30" rx="3" ry="2" fill="#fff"/><ellipse cx="38" cy="30" rx="3" ry="2" fill="#fff"/>
     <ellipse cx="27" cy="30" rx="1.5" ry="1" fill="#222"/><ellipse cx="39" cy="30" rx="1.5" ry="1" fill="#222"/>`, // rasgado
    `<circle cx="26" cy="30" r="4" fill="#fff"/><circle cx="38" cy="30" r="4" fill="#fff"/>
     <circle cx="27" cy="29" r="2" fill="#222"/><circle cx="39" cy="29" r="2" fill="#222"/>
     <circle cx="28" cy="28" r="0.8" fill="#fff"/><circle cx="40" cy="28" r="0.8" fill="#fff"/>`,  // grande
    `<line x1="23" y1="30" x2="29" y2="30" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>
     <line x1="35" y1="30" x2="41" y2="30" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>`, // dormilón
    `<circle cx="26" cy="30" r="3" fill="#fff"/><circle cx="27" cy="30" r="1.5" fill="#222"/>
     <line x1="35" y1="30" x2="41" y2="30" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>`, // guiño
  ]

  // Nose
  const nose = `<polygon points="32,34 30,32 34,32" fill="${pink}"/>`

  // Mouth
  const mouths = [
    `<path d="M29,36 Q32,39 35,36" fill="none" stroke="#222" stroke-width="1"/>`,              // sonrisa
    `<path d="M29,36 Q32,38 35,36" fill="none" stroke="#222" stroke-width="1"/>
     <text x="31" y="37" font-size="4" fill="#222">ω</text>`,                                   // :3
    `<ellipse cx="32" cy="37" rx="2.5" ry="2" fill="#222"/>
     <ellipse cx="32" cy="36.5" rx="1.5" ry="0.8" fill="${pink}"/>`,                            // abierto
    `<path d="M29,36 Q32,39 35,36" fill="none" stroke="#222" stroke-width="1"/>
     <ellipse cx="33" cy="38" rx="1" ry="2" fill="${pink}"/>`,                                  // lengua
  ]

  // Whiskers
  const whiskers = [
    `<line x1="8" y1="32" x2="22" y2="33" stroke="#222" stroke-width="0.5"/>
     <line x1="8" y1="36" x2="22" y2="35" stroke="#222" stroke-width="0.5"/>
     <line x1="42" y1="33" x2="56" y2="32" stroke="#222" stroke-width="0.5"/>
     <line x1="42" y1="35" x2="56" y2="36" stroke="#222" stroke-width="0.5"/>`,  // normal
    `<line x1="4" y1="30" x2="22" y2="33" stroke="#222" stroke-width="0.5"/>
     <line x1="4" y1="36" x2="22" y2="35" stroke="#222" stroke-width="0.5"/>
     <line x1="42" y1="33" x2="60" y2="30" stroke="#222" stroke-width="0.5"/>
     <line x1="42" y1="35" x2="60" y2="36" stroke="#222" stroke-width="0.5"/>`,  // largos
    `<line x1="8" y1="34" x2="22" y2="33" stroke="#222" stroke-width="0.5"/>
     <line x1="8" y1="40" x2="22" y2="36" stroke="#222" stroke-width="0.5"/>
     <line x1="42" y1="33" x2="56" y2="34" stroke="#222" stroke-width="0.5"/>
     <line x1="42" y1="36" x2="56" y2="40" stroke="#222" stroke-width="0.5"/>`,  // caídos
  ]

  // Tail
  const tails = [
    `<path d="M50,42 Q58,30 54,22" fill="none" stroke="${base}" stroke-width="4" stroke-linecap="round"/>`,  // curvado
    `<path d="M50,42 L56,26" fill="none" stroke="${base}" stroke-width="4" stroke-linecap="round"/>`,         // recto
    `<path d="M50,42 Q60,32 52,20" fill="none" stroke="${base}" stroke-width="5" stroke-linecap="round"/>`,  // esponjoso
  ]

  // Pattern overlay
  const patterns = [
    '',  // sólido
    `<line x1="24" y1="26" x2="20" y2="22" stroke="${dark}" stroke-width="1.5" opacity="0.4"/>
     <line x1="28" y1="24" x2="26" y2="20" stroke="${dark}" stroke-width="1.5" opacity="0.4"/>
     <line x1="36" y1="24" x2="38" y2="20" stroke="${dark}" stroke-width="1.5" opacity="0.4"/>
     <line x1="40" y1="26" x2="44" y2="22" stroke="${dark}" stroke-width="1.5" opacity="0.4"/>`,  // tabby
    `<ellipse cx="32" cy="42" rx="12" ry="8" fill="#fff" opacity="0.7"/>`,                          // tuxedo
    `<circle cx="24" cy="36" r="4" fill="${dark}" opacity="0.3"/>
     <circle cx="38" cy="42" r="3" fill="${dark}" opacity="0.3"/>`,                                 // calico
    `<circle cx="26" cy="36" r="2" fill="${dark}" opacity="0.3"/>
     <circle cx="38" cy="34" r="1.5" fill="${dark}" opacity="0.3"/>
     <circle cx="34" cy="44" r="2" fill="${dark}" opacity="0.3"/>`,                                 // manchas
  ]

  // Accessories
  const accessories = [
    '',  // ninguno
    `<polygon points="32,18 28,14 36,14" fill="#FF1493"/>`,                                // lazo
    `<rect x="28" y="6" width="8" height="5" rx="1" fill="#222"/>
     <rect x="26" y="10" width="12" height="2" rx="1" fill="#222"/>`,                      // sombrero
    `<circle cx="26" cy="30" r="5" fill="none" stroke="#222" stroke-width="0.8"/>
     <circle cx="38" cy="30" r="5" fill="none" stroke="#222" stroke-width="0.8"/>
     <line x1="31" y1="30" x2="33" y2="30" stroke="#222" stroke-width="0.8"/>`,            // gafas
    `<rect x="24" y="46" width="16" height="3" rx="1.5" fill="${dark}"/>
     <circle cx="32" cy="47.5" r="2" fill="gold"/>`,                                       // collar
    `<circle cx="12" cy="10" r="3" fill="#FF69B4"/><circle cx="12" cy="10" r="1.5" fill="#FFD700"/>`, // flor
  ]

  const body = r.int(bodies.length)
  const ear = r.int(ears.length)
  const eye = r.int(eyes.length)
  const mouth = r.int(mouths.length)
  const pattern = r.int(patterns.length)
  const whisker = r.int(whiskers.length)
  const tail = r.int(tails.length)
  const accessory = r.int(accessories.length)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="${base}">
    ${tails[tail]}
    <g>${ears[ear]}</g>
    ${innerEar}
    ${bodies[body]}
    ${patterns[pattern]}
  </g>
  ${eyes[eye]}
  ${nose}
  ${mouths[mouth]}
  ${whiskers[whisker]}
  ${accessories[accessory]}
</svg>`
}

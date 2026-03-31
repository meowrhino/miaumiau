// Server-side cat SVG generator v2 — mirrors public/js/avatar.js
// Deterministic: same seed + color = same cat

function seedRng(seed: number) {
  let state = seed | 0
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) | 0; return (state >>> 0) / 0xFFFFFFFF }
  const int = (n: number) => Math.floor(next() * n)
  return { next, int }
}

function hexToHsl(hex: string): [number, number, number] {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hsl(h: number, s: number, l: number) { return `hsl(${h},${s}%,${l}%)` }

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

export function colorHex(name: string): string { return COLORS[name] ?? '#808080' }
export const COLOR_NAMES = Object.keys(COLORS)

export function generateCatSvg(seed: number, colorName: string): string {
  const r = seedRng(seed)
  const base = colorHex(colorName)
  const [h, s, l] = hexToHsl(base)

  const fur = hsl(h, s, Math.max(l, 45))
  const furLight = hsl(h, Math.max(s - 10, 20), Math.min(l + 20, 85))
  const furDark = hsl(h, s, Math.max(l - 15, 25))
  const nose = hsl((h + 10) % 360, 50, 70)
  const innerEar = hsl((h + 5) % 360, 60, 75)
  const pupil = hsl(h, 15, 15)

  const bodyType = r.int(3)
  const earType = r.int(3)
  const eyeType = r.int(5)
  const mouthType = r.int(4)
  const patternType = r.int(5)
  const accessoryType = r.int(8)
  const tailType = r.int(3)
  const cheeks = r.int(2)

  const eyeY = 30
  const noseY = 34

  const bodies = [
    `<ellipse cx="32" cy="37" rx="16" ry="15" fill="${fur}"/><ellipse cx="32" cy="40" rx="13" ry="10" fill="${furLight}" opacity="0.5"/>`,
    `<ellipse cx="32" cy="37" rx="14" ry="16" fill="${fur}"/><ellipse cx="32" cy="40" rx="11" ry="10" fill="${furLight}" opacity="0.5"/>`,
    `<ellipse cx="32" cy="38" rx="18" ry="14" fill="${fur}"/><ellipse cx="32" cy="41" rx="15" ry="9" fill="${furLight}" opacity="0.5"/>`,
  ]

  const ears = [
    `<path d="M18,24 L14,8 L26,20Z" fill="${fur}"/><path d="M46,24 L50,8 L38,20Z" fill="${fur}"/><path d="M19,22 L16,12 L24,20Z" fill="${innerEar}" opacity="0.6"/><path d="M45,22 L48,12 L40,20Z" fill="${innerEar}" opacity="0.6"/>`,
    `<path d="M16,22 Q12,10 24,18" fill="${fur}"/><path d="M48,22 Q52,10 40,18" fill="${fur}"/><path d="M18,20 Q15,13 23,18" fill="${innerEar}" opacity="0.5"/><path d="M46,20 Q49,13 41,18" fill="${innerEar}" opacity="0.5"/>`,
    `<path d="M16,22 L13,12 L25,19Z" fill="${fur}"/><path d="M48,22 L51,12 L39,19Z" fill="${fur}"/><path d="M16,20 Q15,16 22,19" fill="${furDark}" opacity="0.3"/><path d="M48,20 Q49,16 42,19" fill="${furDark}" opacity="0.3"/>`,
  ]

  const eyes = [
    `<circle cx="25" cy="${eyeY}" r="3.5" fill="#fff"/><circle cx="39" cy="${eyeY}" r="3.5" fill="#fff"/><circle cx="26" cy="${eyeY}" r="2" fill="${pupil}"/><circle cx="40" cy="${eyeY}" r="2" fill="${pupil}"/><circle cx="27" cy="${eyeY - 1}" r="0.7" fill="#fff"/><circle cx="41" cy="${eyeY - 1}" r="0.7" fill="#fff"/>`,
    `<circle cx="25" cy="${eyeY}" r="4.5" fill="#fff"/><circle cx="39" cy="${eyeY}" r="4.5" fill="#fff"/><circle cx="26" cy="${eyeY}" r="2.5" fill="${pupil}"/><circle cx="40" cy="${eyeY}" r="2.5" fill="${pupil}"/><circle cx="27.5" cy="${eyeY - 1.5}" r="1" fill="#fff"/><circle cx="41.5" cy="${eyeY - 1.5}" r="1" fill="#fff"/>`,
    `<path d="M22,${eyeY} Q25,${eyeY - 2} 28,${eyeY}" fill="none" stroke="${pupil}" stroke-width="1.5" stroke-linecap="round"/><path d="M36,${eyeY} Q39,${eyeY - 2} 42,${eyeY}" fill="none" stroke="${pupil}" stroke-width="1.5" stroke-linecap="round"/>`,
    `<circle cx="25" cy="${eyeY}" r="3.5" fill="#fff"/><circle cx="26" cy="${eyeY}" r="2" fill="${pupil}"/><circle cx="27" cy="${eyeY - 1}" r="0.7" fill="#fff"/><path d="M36,${eyeY} Q39,${eyeY - 2} 42,${eyeY}" fill="none" stroke="${pupil}" stroke-width="1.5" stroke-linecap="round"/>`,
    `<circle cx="25" cy="${eyeY}" r="3.5" fill="hsl(${(h + 60) % 360},70%,60%)"/><circle cx="39" cy="${eyeY}" r="3.5" fill="hsl(${(h + 60) % 360},70%,60%)"/><ellipse cx="25" cy="${eyeY}" rx="1" ry="3" fill="${pupil}"/><ellipse cx="39" cy="${eyeY}" rx="1" ry="3" fill="${pupil}"/>`,
  ]

  const noseEl = `<ellipse cx="32" cy="${noseY}" rx="1.8" ry="1.3" fill="${nose}"/>`
  const mouths = [
    `<path d="M29,${noseY + 2} Q32,${noseY + 4.5} 35,${noseY + 2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/>`,
    `<path d="M32,${noseY + 1} Q29,${noseY + 3.5} 27,${noseY + 2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/><path d="M32,${noseY + 1} Q35,${noseY + 3.5} 37,${noseY + 2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/>`,
    `<ellipse cx="32" cy="${noseY + 3}" rx="2" ry="1.5" fill="${pupil}"/><ellipse cx="32" cy="${noseY + 2.5}" rx="1.2" ry="0.6" fill="${nose}" opacity="0.5"/>`,
    `<path d="M29,${noseY + 2} Q32,${noseY + 4.5} 35,${noseY + 2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/><ellipse cx="32" cy="${noseY + 4}" rx="1.2" ry="2" fill="#f87"/>`,
  ]

  const whiskers = `<line x1="10" y1="32" x2="22" y2="33.5" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/><line x1="10" y1="36" x2="22" y2="35" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/><line x1="42" y1="33.5" x2="54" y2="32" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/><line x1="42" y1="35" x2="54" y2="36" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/>`
  const cheekEl = cheeks ? `<circle cx="22" cy="34" r="3" fill="#f99" opacity="0.25"/><circle cx="42" cy="34" r="3" fill="#f99" opacity="0.25"/>` : ''

  const tails = [
    `<path d="M48,40 Q56,30 52,18" fill="none" stroke="${fur}" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M48,40 Q58,35 55,22 Q53,16 50,20" fill="none" stroke="${fur}" stroke-width="3.5" stroke-linecap="round"/>`,
    `<path d="M48,40 Q54,32 50,24" fill="none" stroke="${fur}" stroke-width="5" stroke-linecap="round"/>`,
  ]

  const patterns = [
    '',
    `<path d="M28,22 L26,18" stroke="${furDark}" stroke-width="1.2" opacity="0.3" stroke-linecap="round"/><path d="M32,21 L32,17" stroke="${furDark}" stroke-width="1.2" opacity="0.3" stroke-linecap="round"/><path d="M36,22 L38,18" stroke="${furDark}" stroke-width="1.2" opacity="0.3" stroke-linecap="round"/>`,
    `<ellipse cx="32" cy="42" rx="12" ry="7" fill="#fff" opacity="0.6"/>`,
    `<circle cx="22" cy="35" r="3" fill="${furDark}" opacity="0.15"/><circle cx="40" cy="38" r="2.5" fill="${furDark}" opacity="0.15"/><circle cx="35" cy="44" r="2" fill="${furDark}" opacity="0.15"/>`,
    `<path d="M22,26 Q32,22 42,26 Q42,34 32,36 Q22,34 22,26Z" fill="${furDark}" opacity="0.15"/>`,
  ]

  const accessories = [
    '', '', '',
    `<circle cx="19" cy="14" r="2.5" fill="#f55"/><circle cx="15" cy="14" r="2.5" fill="#f55"/><circle cx="17" cy="14" r="1.5" fill="#c33"/>`,
    `<circle cx="25" cy="${eyeY}" r="5" fill="none" stroke="${pupil}" stroke-width="0.8"/><circle cx="39" cy="${eyeY}" r="5" fill="none" stroke="${pupil}" stroke-width="0.8"/><line x1="30" y1="${eyeY}" x2="34" y2="${eyeY}" stroke="${pupil}" stroke-width="0.8"/>`,
    `<path d="M20,45 Q32,48 44,45" fill="none" stroke="${hsl((h + 180) % 360, 60, 50)}" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="47" r="2" fill="gold" stroke="#b8860b" stroke-width="0.5"/>`,
    `<rect x="27" y="8" width="10" height="6" rx="1" fill="${pupil}"/><rect x="24" y="13" width="16" height="2.5" rx="1" fill="${pupil}"/>`,
    `<circle cx="44" cy="14" r="2" fill="#f9a"/><circle cx="46" cy="12" r="2" fill="#f9a"/><circle cx="48" cy="14" r="2" fill="#f9a"/><circle cx="46" cy="16" r="2" fill="#f9a"/><circle cx="46" cy="14" r="1.2" fill="#fd5"/>`,
  ]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${tails[tailType]}
  ${ears[earType]}
  ${bodies[bodyType]}
  ${patterns[patternType]}
  ${whiskers}
  ${eyes[eyeType]}
  ${noseEl}
  ${mouths[mouthType]}
  ${cheekEl}
  ${accessories[accessoryType]}
</svg>`
}

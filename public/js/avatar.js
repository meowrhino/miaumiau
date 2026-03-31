// Client-side cat avatar generator v2
// Softer shapes, bezier curves, more personality

function seedRng(seed) {
  let state = seed | 0
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) | 0; return (state >>> 0) / 0xFFFFFFFF }
  const int = n => Math.floor(next() * n)
  return { next, int }
}

function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)` }

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255
  let g = parseInt(hex.slice(3,5),16)/255
  let b = parseInt(hex.slice(5,7),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h = 0, s = 0, l = (max+min)/2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    if (max === r) h = ((g-b)/d + (g < b ? 6 : 0))/6
    else if (max === g) h = ((b-r)/d + 2)/6
    else h = ((r-g)/d + 4)/6
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)]
}

function generateCatSvg(seed, colorName) {
  const r = seedRng(seed)
  const base = colorHex(colorName)
  const [h, s, l] = hexToHsl(base)

  // Derived colors
  const fur = hsl(h, s, Math.max(l, 45))
  const furLight = hsl(h, Math.max(s-10, 20), Math.min(l+20, 85))
  const furDark = hsl(h, s, Math.max(l-15, 25))
  const nose = hsl((h+10)%360, 50, 70)
  const innerEar = hsl((h+5)%360, 60, 75)
  const eyeWhite = '#fff'
  const pupil = hsl(h, 15, 15)

  // Traits
  const bodyType = r.int(3)  // 0=round 1=normal 2=chonky
  const earType = r.int(3)   // 0=pointy 1=round 2=folded
  const eyeType = r.int(5)   // 0=round 1=big 2=sleepy 3=wink 4=slit
  const mouthType = r.int(4) // 0=smile 1=cat 2=open 3=tongue
  const patternType = r.int(5) // 0=none 1=tabby 2=bicolor 3=spots 4=mask
  const accessoryType = r.int(8) // 0-2=none 3=bow 4=glasses 5=collar 6=hat 7=flower
  const tailType = r.int(3)
  const cheeks = r.int(2)

  // Body shapes (centered at 32,36)
  const bodies = [
    // round
    `<ellipse cx="32" cy="37" rx="16" ry="15" fill="${fur}"/>
     <ellipse cx="32" cy="40" rx="13" ry="10" fill="${furLight}" opacity="0.5"/>`,
    // normal
    `<ellipse cx="32" cy="37" rx="14" ry="16" fill="${fur}"/>
     <ellipse cx="32" cy="40" rx="11" ry="10" fill="${furLight}" opacity="0.5"/>`,
    // chonky
    `<ellipse cx="32" cy="38" rx="18" ry="14" fill="${fur}"/>
     <ellipse cx="32" cy="41" rx="15" ry="9" fill="${furLight}" opacity="0.5"/>`,
  ]

  // Ears
  const ears = [
    // pointy
    `<path d="M18,24 L14,8 L26,20Z" fill="${fur}"/><path d="M46,24 L50,8 L38,20Z" fill="${fur}"/>
     <path d="M19,22 L16,12 L24,20Z" fill="${innerEar}" opacity="0.6"/>
     <path d="M45,22 L48,12 L40,20Z" fill="${innerEar}" opacity="0.6"/>`,
    // round
    `<path d="M16,22 Q12,10 24,18" fill="${fur}" stroke="${furDark}" stroke-width="0.5"/>
     <path d="M48,22 Q52,10 40,18" fill="${fur}" stroke="${furDark}" stroke-width="0.5"/>
     <path d="M18,20 Q15,13 23,18" fill="${innerEar}" opacity="0.5"/>
     <path d="M46,20 Q49,13 41,18" fill="${innerEar}" opacity="0.5"/>`,
    // folded (scottish fold)
    `<path d="M16,22 L13,12 L25,19Z" fill="${fur}"/>
     <path d="M48,22 L51,12 L39,19Z" fill="${fur}"/>
     <path d="M16,20 Q15,16 22,19" fill="${furDark}" opacity="0.3"/>
     <path d="M48,20 Q49,16 42,19" fill="${furDark}" opacity="0.3"/>`,
  ]

  // Eyes
  const eyeY = 30
  const eyes = [
    // round
    `<circle cx="25" cy="${eyeY}" r="3.5" fill="${eyeWhite}"/>
     <circle cx="39" cy="${eyeY}" r="3.5" fill="${eyeWhite}"/>
     <circle cx="26" cy="${eyeY}" r="2" fill="${pupil}"/>
     <circle cx="40" cy="${eyeY}" r="2" fill="${pupil}"/>
     <circle cx="27" cy="${eyeY-1}" r="0.7" fill="#fff"/>
     <circle cx="41" cy="${eyeY-1}" r="0.7" fill="#fff"/>`,
    // big
    `<circle cx="25" cy="${eyeY}" r="4.5" fill="${eyeWhite}"/>
     <circle cx="39" cy="${eyeY}" r="4.5" fill="${eyeWhite}"/>
     <circle cx="26" cy="${eyeY}" r="2.5" fill="${pupil}"/>
     <circle cx="40" cy="${eyeY}" r="2.5" fill="${pupil}"/>
     <circle cx="27.5" cy="${eyeY-1.5}" r="1" fill="#fff"/>
     <circle cx="41.5" cy="${eyeY-1.5}" r="1" fill="#fff"/>`,
    // sleepy (happy lines)
    `<path d="M22,${eyeY} Q25,${eyeY-2} 28,${eyeY}" fill="none" stroke="${pupil}" stroke-width="1.5" stroke-linecap="round"/>
     <path d="M36,${eyeY} Q39,${eyeY-2} 42,${eyeY}" fill="none" stroke="${pupil}" stroke-width="1.5" stroke-linecap="round"/>`,
    // wink
    `<circle cx="25" cy="${eyeY}" r="3.5" fill="${eyeWhite}"/>
     <circle cx="26" cy="${eyeY}" r="2" fill="${pupil}"/>
     <circle cx="27" cy="${eyeY-1}" r="0.7" fill="#fff"/>
     <path d="M36,${eyeY} Q39,${eyeY-2} 42,${eyeY}" fill="none" stroke="${pupil}" stroke-width="1.5" stroke-linecap="round"/>`,
    // slit pupils
    `<circle cx="25" cy="${eyeY}" r="3.5" fill="hsl(${(h+60)%360},70%,60%)"/>
     <circle cx="39" cy="${eyeY}" r="3.5" fill="hsl(${(h+60)%360},70%,60%)"/>
     <ellipse cx="25" cy="${eyeY}" rx="1" ry="3" fill="${pupil}"/>
     <ellipse cx="39" cy="${eyeY}" rx="1" ry="3" fill="${pupil}"/>
     <circle cx="26" cy="${eyeY-1}" r="0.5" fill="rgba(255,255,255,0.6)"/>
     <circle cx="40" cy="${eyeY-1}" r="0.5" fill="rgba(255,255,255,0.6)"/>`,
  ]

  // Nose + mouth
  const noseY = 34
  const noseEl = `<ellipse cx="32" cy="${noseY}" rx="1.8" ry="1.3" fill="${nose}"/>`
  const mouths = [
    // smile
    `<path d="M29,${noseY+2} Q32,${noseY+4.5} 35,${noseY+2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/>`,
    // cat mouth (:3)
    `<path d="M32,${noseY+1} Q29,${noseY+3.5} 27,${noseY+2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/>
     <path d="M32,${noseY+1} Q35,${noseY+3.5} 37,${noseY+2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/>`,
    // small open
    `<ellipse cx="32" cy="${noseY+3}" rx="2" ry="1.5" fill="${pupil}"/>
     <ellipse cx="32" cy="${noseY+2.5}" rx="1.2" ry="0.6" fill="${nose}" opacity="0.5"/>`,
    // tongue
    `<path d="M29,${noseY+2} Q32,${noseY+4.5} 35,${noseY+2}" fill="none" stroke="${pupil}" stroke-width="0.8" stroke-linecap="round"/>
     <ellipse cx="32" cy="${noseY+4}" rx="1.2" ry="2" fill="#f87"/>`,
  ]

  // Whiskers
  const whiskers = `
    <line x1="10" y1="32" x2="22" y2="33.5" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/>
    <line x1="10" y1="36" x2="22" y2="35" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/>
    <line x1="42" y1="33.5" x2="54" y2="32" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/>
    <line x1="42" y1="35" x2="54" y2="36" stroke="${furDark}" stroke-width="0.4" opacity="0.5"/>`

  // Cheek blush
  const cheekEl = cheeks
    ? `<circle cx="22" cy="34" r="3" fill="#f99" opacity="0.25"/>
       <circle cx="42" cy="34" r="3" fill="#f99" opacity="0.25"/>`
    : ''

  // Tail
  const tails = [
    `<path d="M48,40 Q56,30 52,18" fill="none" stroke="${fur}" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M48,40 Q58,35 55,22 Q53,16 50,20" fill="none" stroke="${fur}" stroke-width="3.5" stroke-linecap="round"/>`,
    `<path d="M48,40 Q54,32 50,24" fill="none" stroke="${fur}" stroke-width="5" stroke-linecap="round"/>`,
  ]

  // Patterns
  const patterns = [
    '', // solid
    // tabby stripes on forehead
    `<path d="M28,22 L26,18" stroke="${furDark}" stroke-width="1.2" opacity="0.3" stroke-linecap="round"/>
     <path d="M32,21 L32,17" stroke="${furDark}" stroke-width="1.2" opacity="0.3" stroke-linecap="round"/>
     <path d="M36,22 L38,18" stroke="${furDark}" stroke-width="1.2" opacity="0.3" stroke-linecap="round"/>`,
    // bicolor belly
    `<ellipse cx="32" cy="42" rx="12" ry="7" fill="#fff" opacity="0.6"/>`,
    // spots
    `<circle cx="22" cy="35" r="3" fill="${furDark}" opacity="0.15"/>
     <circle cx="40" cy="38" r="2.5" fill="${furDark}" opacity="0.15"/>
     <circle cx="35" cy="44" r="2" fill="${furDark}" opacity="0.15"/>`,
    // mask (darker face)
    `<path d="M22,26 Q32,22 42,26 Q42,34 32,36 Q22,34 22,26Z" fill="${furDark}" opacity="0.15"/>`,
  ]

  // Accessories
  const accessories = [
    '', '', '', // 0-2: none (higher probability of no accessory)
    // bow on ear
    `<circle cx="19" cy="14" r="2.5" fill="#f55"/>
     <circle cx="15" cy="14" r="2.5" fill="#f55"/>
     <circle cx="17" cy="14" r="1.5" fill="#c33"/>`,
    // glasses
    `<circle cx="25" cy="${eyeY}" r="5" fill="none" stroke="${pupil}" stroke-width="0.8"/>
     <circle cx="39" cy="${eyeY}" r="5" fill="none" stroke="${pupil}" stroke-width="0.8"/>
     <line x1="30" y1="${eyeY}" x2="34" y2="${eyeY}" stroke="${pupil}" stroke-width="0.8"/>
     <line x1="20" y1="${eyeY}" x2="16" y2="${eyeY-2}" stroke="${pupil}" stroke-width="0.8"/>
     <line x1="44" y1="${eyeY}" x2="48" y2="${eyeY-2}" stroke="${pupil}" stroke-width="0.8"/>`,
    // collar with bell
    `<path d="M20,45 Q32,48 44,45" fill="none" stroke="${hsl((h+180)%360, 60, 50)}" stroke-width="2.5" stroke-linecap="round"/>
     <circle cx="32" cy="47" r="2" fill="gold" stroke="#b8860b" stroke-width="0.5"/>`,
    // tiny hat
    `<rect x="27" y="8" width="10" height="6" rx="1" fill="${pupil}"/>
     <rect x="24" y="13" width="16" height="2.5" rx="1" fill="${pupil}"/>`,
    // flower
    `<circle cx="44" cy="14" r="2" fill="#f9a"/>
     <circle cx="46" cy="12" r="2" fill="#f9a"/>
     <circle cx="48" cy="14" r="2" fill="#f9a"/>
     <circle cx="46" cy="16" r="2" fill="#f9a"/>
     <circle cx="46" cy="14" r="1.2" fill="#fd5"/>`,
  ]

  const body = bodies[bodyType]
  const ear = ears[earType]
  const eye = eyes[eyeType]
  const mouth = mouths[mouthType]
  const tail = tails[tailType]
  const pattern = patterns[patternType]
  const accessory = accessories[accessoryType]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${tail}
  ${ear}
  ${body}
  ${pattern}
  ${whiskers}
  ${eye}
  ${noseEl}
  ${mouth}
  ${cheekEl}
  ${accessory}
</svg>`
}

// Trait metadata for the cat editor
const CAT_TRAITS = {
  body:      { name: 'cuerpo',    count: 3, labels: ['redondo', 'normal', 'gordito'] },
  ear:       { name: 'orejas',    count: 3, labels: ['puntudas', 'redondas', 'dobladas'] },
  eye:       { name: 'ojos',      count: 5, labels: ['redondos', 'grandes', 'dormilones', 'guiño', 'rasgados'] },
  mouth:     { name: 'boca',      count: 4, labels: ['sonrisa', ':3', 'abierta', 'lengua'] },
  pattern:   { name: 'patron',    count: 5, labels: ['liso', 'tabby', 'bicolor', 'manchas', 'mascara'] },
  accessory: { name: 'accesorio', count: 8, labels: ['nada', 'nada', 'nada', 'lazo', 'gafas', 'collar', 'sombrero', 'flor'] },
  tail:      { name: 'cola',      count: 3, labels: ['curvada', 'elegante', 'esponjosa'] },
  cheeks:    { name: 'mejillas',  count: 2, labels: ['sin', 'sonrojadas'] },
}

// Generate from explicit traits (used by editor)
function generateCatSvgFromTraits(colorName, traits) {
  // Pack traits into a fake seed that produces those exact values
  // Simpler: just modify generateCatSvg to accept optional overrides
  const base = colorHex(colorName)
  const [h, s, l] = hexToHsl(base)
  const fur = hsl(h, s, Math.max(l, 45))
  const furLight = hsl(h, Math.max(s-10, 20), Math.min(l+20, 85))
  const furDark = hsl(h, s, Math.max(l-15, 25))
  const noseC = hsl((h+10)%360, 50, 70)
  const innerEar = hsl((h+5)%360, 60, 75)
  const pupil = hsl(h, 15, 15)
  const eyeY = 30, noseY = 34

  // Same arrays as generateCatSvg (reusing by calling with a seed that matches)
  // For simplicity, we generate with a temp seed and override
  // Actually the cleanest way: build a seed from the traits
  let packed = 0
  packed = traits.body + packed * 3
  packed = traits.ear + packed * 3
  packed = traits.eye + packed * 5
  packed = traits.mouth + packed * 4
  packed = traits.pattern + packed * 5
  packed = traits.accessory + packed * 8
  packed = traits.tail + packed * 3
  packed = traits.cheeks + packed * 2

  // We need a seed that produces these exact traits.
  // Brute-force is impractical. Instead, let's just duplicate the SVG assembly.
  // The simplest approach: pass traits directly to a builder.

  // Actually, let me just call generateCatSvg with a custom RNG that returns preset values
  const values = [traits.body, traits.ear, traits.eye, traits.mouth, traits.pattern, traits.accessory, traits.tail, traits.cheeks]
  let idx = 0
  const fakeRng = { int: () => values[idx++], next: () => 0.5 }

  // We need to reconstruct... this is getting messy. Let me just use the simplest approach:
  // Store traits as avatar_seed by encoding them.
  return generateCatSvg(traitsToSeed(traits), colorName)
}

// Encode traits into a seed that will reproduce them
function traitsToSeed(traits) {
  // We need to find a seed where seedRng produces exactly these trait values.
  // Since the RNG is deterministic, we can brute-force (it's fast for small spaces).
  for (let seed = 0; seed < 1000000; seed++) {
    const r = seedRng(seed)
    if (r.int(3) === traits.body &&
        r.int(3) === traits.ear &&
        r.int(5) === traits.eye &&
        r.int(4) === traits.mouth &&
        r.int(5) === traits.pattern &&
        r.int(8) === traits.accessory &&
        r.int(3) === traits.tail &&
        r.int(2) === traits.cheeks) {
      return seed
    }
  }
  return 42 // fallback
}

// Decode seed to traits
function seedToTraits(seed) {
  const r = seedRng(seed)
  return {
    body: r.int(3), ear: r.int(3), eye: r.int(5), mouth: r.int(4),
    pattern: r.int(5), accessory: r.int(8), tail: r.int(3), cheeks: r.int(2)
  }
}

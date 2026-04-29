// Subconjunto curado de colores W3C para identidad de usuario
const COLORS = {
  Coral: '#FF7F50', Tomato: '#FF6347', OrangeRed: '#FF4500', Gold: '#FFD700',
  Orange: '#FFA500', Khaki: '#F0E68C', Lime: '#00FF00', MediumSeaGreen: '#3CB371',
  Teal: '#008080', Turquoise: '#40E0D0', SteelBlue: '#4682B4', DodgerBlue: '#1E90FF',
  SlateBlue: '#6A5ACD', BlueViolet: '#8A2BE2', Orchid: '#DA70D6', HotPink: '#FF69B4',
  Crimson: '#DC143C', Salmon: '#FA8072', Peru: '#CD853F', SaddleBrown: '#8B4513',
  Olive: '#808000', DarkCyan: '#008B8B', MidnightBlue: '#191970', Indigo: '#4B0082',
  RosyBrown: '#BC8F8F', CadetBlue: '#5F9EA0', MediumPurple: '#9370DB', PaleVioletRed: '#DB7093',
  DarkOrange: '#FF8C00', LimeGreen: '#32CD32', DeepSkyBlue: '#00BFFF', Plum: '#DDA0DD'
}

const colorHex = name => {
  if (typeof name === 'string' && name[0] === '#') return name
  return COLORS[name] ?? '#808080'
}
const COLOR_NAMES = Object.keys(COLORS)

function renderColorGrid(container, selected, onSelect) {
  container.innerHTML = ''
  for (const name of COLOR_NAMES) {
    const el = document.createElement('button')
    el.className = 'color-swatch' + (name === selected ? ' active' : '')
    el.style.background = COLORS[name]
    el.title = name
    el.onclick = () => {
      container.querySelectorAll('.active').forEach(e => e.classList.remove('active'))
      el.classList.add('active')
      onSelect(name)
    }
    container.appendChild(el)
  }
}

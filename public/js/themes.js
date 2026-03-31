// 8 temas visuales — CSS variables
const THEMES = {
  oscuro:    { bg:'#1a1a2e', bg2:'#16213e', bg3:'#0f3460', surface:'#1a1a2e', border:'#333', text:'#e0e0e0', muted:'#888', accent:'#e94560', faint:'#444' },
  claro:     { bg:'#fafafa', bg2:'#f0f0f0', bg3:'#e8e8e8', surface:'#fff',    border:'#ddd', text:'#222',    muted:'#666', accent:'#e94560', faint:'#ccc' },
  terminal:  { bg:'#0a0a0a', bg2:'#111',    bg3:'#1a1a1a', surface:'#0a0a0a', border:'#333', text:'#00ff00', muted:'#008800', accent:'#00ff00', faint:'#222' },
  oceano:    { bg:'#0b1929', bg2:'#0d2137', bg3:'#132f4c', surface:'#0b1929', border:'#1e4976', text:'#b2bac2', muted:'#5a7a9a', accent:'#5090d3', faint:'#1e3a5f' },
  atardecer: { bg:'#1a1423', bg2:'#2d1b3d', bg3:'#3d2456', surface:'#1a1423', border:'#4a2d6a', text:'#e8d5f5', muted:'#9a7bb5', accent:'#ff6b9d', faint:'#3a2050' },
  nord:      { bg:'#2e3440', bg2:'#3b4252', bg3:'#434c5e', surface:'#2e3440', border:'#4c566a', text:'#eceff4', muted:'#7b88a1', accent:'#88c0d0', faint:'#3b4252' },
  monokai:   { bg:'#272822', bg2:'#2d2e27', bg3:'#383830', surface:'#272822', border:'#49483e', text:'#f8f8f2', muted:'#75715e', accent:'#f92672', faint:'#3e3d32' },
  vampiro:   { bg:'#1e1f29', bg2:'#282a36', bg3:'#343746', surface:'#1e1f29', border:'#44475a', text:'#f8f8f2', muted:'#6272a4', accent:'#ff79c6', faint:'#383a4a' }
}

const THEME_NAMES = Object.keys(THEMES)

function applyTheme(id) {
  const t = THEMES[id] ?? THEMES.oscuro
  const s = document.documentElement.style
  for (const [k, v] of Object.entries(t)) s.setProperty('--' + k, v)
}

function renderThemeGrid(container, selected, onSelect) {
  container.innerHTML = ''
  for (const name of THEME_NAMES) {
    const t = THEMES[name]
    const el = document.createElement('button')
    el.className = 'theme-swatch' + (name === selected ? ' active' : '')
    el.style.background = t.bg
    el.style.color = t.accent
    el.style.borderColor = name === selected ? t.accent : t.border
    el.textContent = name
    el.onclick = () => {
      container.querySelectorAll('.active').forEach(e => e.classList.remove('active'))
      el.classList.add('active')
      onSelect(name)
    }
    container.appendChild(el)
  }
}

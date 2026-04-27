// World layer: per-habitat fullscreen backgrounds + ambient life + day/night tint
;(function () {
  const HABITATS = {
    tweets: {
      // Café cálido / interior con lámparas
      sky:  'linear-gradient(180deg, #f5cb86 0%, #f0a85a 60%, #c9683f 100%)',
      far:  'radial-gradient(ellipse 90% 60% at 50% 80%, rgba(255,180,90,0.55), transparent 70%)',
      mid:  'radial-gradient(circle at 12% 65%, rgba(255,235,180,0.8) 0%, transparent 18%), radial-gradient(circle at 88% 70%, rgba(255,235,180,0.7) 0%, transparent 20%)',
      near: 'linear-gradient(180deg, transparent 65%, rgba(80,40,20,0.18) 100%)',
      ambient: 'spark',
    },
    stories: {
      // Noche profunda con luna
      sky:  'linear-gradient(180deg, #1d1646 0%, #2d1b5a 40%, #5b2870 80%, #8e3a82 100%)',
      far:  'radial-gradient(circle at 78% 18%, #f6f0c8 0 22px, rgba(246,240,200,0.4) 22px 32px, transparent 40px)',
      mid:  'radial-gradient(circle at 15% 80%, rgba(150,100,200,0.4), transparent 40%), radial-gradient(circle at 70% 75%, rgba(180,120,220,0.3), transparent 40%)',
      near: 'linear-gradient(180deg, transparent 70%, rgba(0,0,30,0.4) 100%)',
      ambient: 'firefly',
    },
    posts: {
      // Plaza de día / cielo abierto
      sky:  'linear-gradient(180deg, #b8e0f0 0%, #a8d6e8 50%, #f5e4c0 100%)',
      far:  'radial-gradient(ellipse 70% 40% at 50% 35%, rgba(255,255,255,0.6), transparent 60%)',
      mid:  'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.85) 0 30px, transparent 50px), radial-gradient(circle at 75% 18%, rgba(255,255,255,0.75) 0 24px, transparent 40px)',
      near: 'linear-gradient(180deg, transparent 75%, rgba(110,80,40,0.18) 100%)',
      ambient: 'bird',
    },
    chat: {
      // Taberna acogedora / bosque al atardecer
      sky:  'linear-gradient(180deg, #4a5f3a 0%, #6b7a48 50%, #b89060 100%)',
      far:  'radial-gradient(ellipse 90% 50% at 50% 75%, rgba(180,144,96,0.5), transparent 70%)',
      mid:  'radial-gradient(circle at 18% 70%, rgba(255,210,140,0.65) 0%, transparent 18%), radial-gradient(circle at 82% 78%, rgba(255,210,140,0.55) 0%, transparent 18%)',
      near: 'linear-gradient(180deg, transparent 70%, rgba(40,30,20,0.32) 100%)',
      ambient: 'moth',
    },
    bereal: {
      // Cielo medio día / nubes
      sky:  'linear-gradient(180deg, #b3dff5 0%, #f5d088 70%, #e88c52 100%)',
      far:  'radial-gradient(ellipse 60% 30% at 50% 30%, rgba(255,255,255,0.65), transparent 70%)',
      mid:  'radial-gradient(ellipse 30% 8% at 25% 30%, rgba(255,255,255,0.85), transparent 70%), radial-gradient(ellipse 25% 6% at 70% 22%, rgba(255,255,255,0.8), transparent 70%)',
      near: 'linear-gradient(180deg, transparent 80%, rgba(120,60,30,0.2) 100%)',
      ambient: 'cloud',
    },
    profile: {
      // Tu cuarto / interior con ventana
      sky:  'linear-gradient(180deg, #c8a8d8 0%, #b890c8 40%, #8a5ca8 100%)',
      far:  'radial-gradient(ellipse 80% 60% at 50% 80%, rgba(180,120,200,0.5), transparent 70%)',
      mid:  'radial-gradient(circle at 30% 30%, rgba(240,220,255,0.6), transparent 35%), radial-gradient(circle at 75% 65%, rgba(200,160,230,0.4), transparent 40%)',
      near: 'linear-gradient(180deg, transparent 70%, rgba(60,30,80,0.28) 100%)',
      ambient: 'sparkle',
    },
    map: {
      // Pueblo de día (cuando se abre el mapa modal)
      sky:  'linear-gradient(180deg, #aed6e8 0%, #f0c89a 70%, #c98564 100%)',
      far:  'radial-gradient(ellipse 80% 50% at 50% 80%, rgba(180,120,80,0.4), transparent 70%)',
      mid:  '',
      near: '',
      ambient: 'bird',
    },
    city: {
      // Pueblo desde la ciudad walkable — cielo abierto, suelo cálido
      sky:  'linear-gradient(180deg, #b8e0f0 0%, #d8c896 60%, #c98564 100%)',
      far:  'radial-gradient(ellipse 70% 40% at 50% 30%, rgba(255,255,255,0.5), transparent 60%)',
      mid:  '',
      near: '',
      ambient: 'bird',
    },
  }

  let currentHabitat = null
  let ambientTimer = null

  function applyHabitat(name) {
    const cfg = HABITATS[name] || HABITATS.tweets
    if (currentHabitat === name) return
    currentHabitat = name
    const root = document.documentElement
    root.dataset.habitat = name
    setLayer('worldSky',  cfg.sky)
    setLayer('worldFar',  cfg.far)
    setLayer('worldMid',  cfg.mid)
    setLayer('worldNear', cfg.near)
    spawnAmbient(cfg.ambient)
  }

  function setLayer(id, css) {
    const el = document.getElementById(id)
    if (!el) return
    el.style.background = css || ''
  }

  function spawnAmbient(kind) {
    const layer = document.getElementById('worldAmbient')
    if (!layer) return
    layer.innerHTML = ''
    layer.dataset.kind = kind
    if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null }
    if (!kind) return

    // Continuous particles (firefly, sparkle, spark)
    if (['firefly', 'sparkle', 'spark'].includes(kind)) {
      const count = kind === 'firefly' ? 18 : kind === 'sparkle' ? 14 : 10
      for (let i = 0; i < count; i++) layer.appendChild(makeParticle(kind))
      return
    }

    // Cloud bands (drift slowly across)
    if (kind === 'cloud') {
      for (let i = 0; i < 4; i++) layer.appendChild(makeCloud(i))
      return
    }

    // Crossing creatures (bird, moth) — recurring spawn
    if (kind === 'bird' || kind === 'moth') {
      const fire = () => {
        layer.appendChild(makeCrosser(kind))
        // Cleanup older crossers (keep max 4)
        const crossers = layer.querySelectorAll('.world-crosser')
        if (crossers.length > 4) crossers[0].remove()
        ambientTimer = setTimeout(fire, 30000 + Math.random() * 60000)
      }
      ambientTimer = setTimeout(fire, 4000 + Math.random() * 4000)
      return
    }
  }

  function makeParticle(kind) {
    const dot = document.createElement('span')
    dot.className = 'world-particle world-' + kind
    dot.style.left = Math.random() * 100 + '%'
    dot.style.top  = (15 + Math.random() * 75) + '%'
    dot.style.animationDelay    = (Math.random() * 6) + 's'
    dot.style.animationDuration = (5 + Math.random() * 6) + 's'
    return dot
  }

  function makeCloud(i) {
    const c = document.createElement('span')
    c.className = 'world-cloud'
    c.style.top = (5 + i * 14) + '%'
    c.style.animationDelay = (-i * 30) + 's'
    c.style.animationDuration = (110 + i * 20) + 's'
    c.style.opacity = 0.55 + Math.random() * 0.25
    c.style.transform = `scale(${0.7 + Math.random() * 0.6})`
    return c
  }

  function makeCrosser(kind) {
    const c = document.createElement('span')
    c.className = 'world-crosser world-crosser-' + kind
    c.style.top = (10 + Math.random() * 50) + '%'
    c.style.animationDuration = (14 + Math.random() * 8) + 's'
    return c
  }

  // Day/night tint based on local hour: warm midday → cool night → candle 22-04h
  function applyDayNightTint() {
    const tint = document.getElementById('worldTint')
    if (!tint) return
    const h = new Date().getHours()
    let css = ''
    if (h >= 6 && h < 11)   css = 'rgba(255, 220, 170, 0.05)'  // morning
    else if (h >= 11 && h < 16) css = 'rgba(255, 255, 230, 0.02)' // midday
    else if (h >= 16 && h < 19) css = 'rgba(255, 180, 120, 0.06)' // golden
    else if (h >= 19 && h < 22) css = 'rgba(180, 130, 200, 0.08)' // dusk
    else                        css = 'rgba(40, 20, 80, 0.10)'    // night/candle
    tint.style.background = css
  }

  window.World = {
    applyHabitat,
    init() {
      applyHabitat('tweets')
      applyDayNightTint()
      setInterval(applyDayNightTint, 5 * 60 * 1000)
    },
    HABITATS,
  }
})()

// ─── Story Editor ───
const StoryEditor = {
  canvas: null,
  ctx: null,
  drawing: false,
  tool: 'draw',
  drawColor: '#ffffff',
  drawSize: 4,
  eraser: false,
  texts: [],
  links: [],
  bgBlob: null,

  open() {
    $('#storyEditor').hidden = false
    if (window.Pet) Pet.hide()
    StoryEditor.texts = []
    StoryEditor.links = []
    StoryEditor.bgBlob = null
    StoryEditor.tool = 'draw'
    StoryEditor.eraser = false
    $('#storyEditorBg').src = ''
    $('#storyEditorOverlays').innerHTML = ''

    const canvas = $('#storyEditorDraw')
    StoryEditor.canvas = canvas
    StoryEditor.ctx = canvas.getContext('2d')

    // pointer events for drawing
    canvas.onpointerdown = StoryEditor._onDown
    canvas.onpointermove = StoryEditor._onMove
    canvas.onpointerup = StoryEditor._onUp
    canvas.onpointerleave = StoryEditor._onUp

    // click for text/link placement
    canvas.onclick = StoryEditor._onClick
  },

  close() {
    $('#storyEditor').hidden = true
    if (window.Pet && App.user) Pet.show()
  },

  async loadImage(file) {
    if (!file) return
    const blob = await compressImage(file, 'story')
    StoryEditor.bgBlob = blob
    const url = URL.createObjectURL(blob)
    const img = $('#storyEditorBg')
    img.src = url
    img.onload = () => {
      const container = $('#storyEditorCanvas')
      const canvas = StoryEditor.canvas
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
      StoryEditor.ctx = canvas.getContext('2d')
    }
  },

  setTool(tool) {
    StoryEditor.tool = tool
    StoryEditor.eraser = false
    $$('.story-editor-toolbar button[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool)
    })
  },

  toggleEraser() {
    StoryEditor.eraser = !StoryEditor.eraser
  },

  // ─── Drawing ───
  _onDown(e) {
    if (StoryEditor.tool !== 'draw') return
    StoryEditor.drawing = true
    const ctx = StoryEditor.ctx
    ctx.beginPath()
    ctx.moveTo(e.offsetX, e.offsetY)
    ctx.strokeStyle = StoryEditor.eraser ? 'rgba(0,0,0,1)' : StoryEditor.drawColor
    ctx.lineWidth = StoryEditor.drawSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (StoryEditor.eraser) ctx.globalCompositeOperation = 'destination-out'
    else ctx.globalCompositeOperation = 'source-over'
  },

  _onMove(e) {
    if (!StoryEditor.drawing) return
    StoryEditor.ctx.lineTo(e.offsetX, e.offsetY)
    StoryEditor.ctx.stroke()
  },

  _onUp() {
    StoryEditor.drawing = false
  },

  // ─── Text & Link placement ───
  _onClick(e) {
    if (StoryEditor.tool === 'draw') return

    const container = $('#storyEditorOverlays')
    const rect = container.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (StoryEditor.tool === 'text') {
      StoryEditor._addText(x, y, container)
    } else if (StoryEditor.tool === 'link') {
      StoryEditor._addLink(x, y, container)
    }
  },

  _addText(x, y, container) {
    const el = document.createElement('div')
    el.className = 'story-overlay-text'
    el.contentEditable = true
    el.style.left = (x * 100) + '%'
    el.style.top = (y * 100) + '%'
    el.style.color = StoryEditor.drawColor
    el.textContent = 'texto'
    container.appendChild(el)
    el.focus()
    StoryEditor._makeDraggable(el)
    StoryEditor.texts.push(el)
  },

  _addLink(x, y, container) {
    const url = prompt('URL:')
    if (!url) return
    const label = prompt('Texto del link:', url) || url
    const el = document.createElement('div')
    el.className = 'story-overlay-link'
    el.style.left = (x * 100) + '%'
    el.style.top = (y * 100) + '%'
    el.textContent = label
    el.dataset.url = url
    container.appendChild(el)
    StoryEditor._makeDraggable(el)
    StoryEditor.links.push(el)
  },

  _makeDraggable(el) {
    let startX, startY, origLeft, origTop, dragging = false
    el.addEventListener('pointerdown', e => {
      if (el.contentEditable === 'true' && StoryEditor.tool === 'text') return
      dragging = true
      startX = e.clientX
      startY = e.clientY
      origLeft = el.offsetLeft
      origTop = el.offsetTop
      e.preventDefault()
    })
    document.addEventListener('pointermove', e => {
      if (!dragging) return
      el.style.left = (origLeft + e.clientX - startX) + 'px'
      el.style.top = (origTop + e.clientY - startY) + 'px'
    })
    document.addEventListener('pointerup', () => { dragging = false })
  },

  // ─── Publish ───
  async publish() {
    if (!StoryEditor.bgBlob) { showToast('selecciona una imagen primero'); return }

    const container = $('#storyEditorCanvas')
    const w = container.offsetWidth
    const h = container.offsetHeight

    // build layers JSON
    const layers = {
      texts: StoryEditor.texts.map(el => ({
        x: el.offsetLeft / w,
        y: el.offsetTop / h,
        text: el.textContent,
        size: parseInt(getComputedStyle(el).fontSize) || 24,
        color: el.style.color || '#fff'
      })),
      links: StoryEditor.links.map(el => ({
        x: el.offsetLeft / w,
        y: el.offsetTop / h,
        w: el.offsetWidth / w,
        h: el.offsetHeight / h,
        url: el.dataset.url,
        label: el.textContent
      }))
    }

    // Composite: bg image + draw canvas → final webp
    const img = $('#storyEditorBg')
    const canvas = new OffscreenCanvas(1080, 1920)
    const ctx = canvas.getContext('2d')
    // draw background
    const bgBitmap = await createImageBitmap(StoryEditor.bgBlob)
    ctx.drawImage(bgBitmap, 0, 0, 1080, 1920)
    // draw canvas overlay (scaled)
    const drawCanvas = StoryEditor.canvas
    if (drawCanvas.width > 0) ctx.drawImage(drawCanvas, 0, 0, 1080, 1920)

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.75 })

    const fd = new FormData()
    fd.append('image', blob, 'story.webp')
    fd.append('layers', JSON.stringify(layers))

    try {
      await API.upload('/stories', fd)
      StoryEditor.close()
      // Refresh the stories sheet (it lives inside the city map now)
      if (window.App && App.activeSheet === 'stories' && App.enter_stories) App.enter_stories()
      else App.go('city', { sheet: 'stories' })
      showToast('story publicada')
    } catch (e) { showToast(e.message) }
  }
}

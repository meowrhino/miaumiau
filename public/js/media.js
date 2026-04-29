// Compresión de imagen client-side. Tries the modern createImageBitmap +
// OffscreenCanvas + WebP path first (fast, low memory) and falls back to
// classic <img> + <canvas> + toBlob for iOS Safari <15 and older mobile
// browsers where OffscreenCanvas / WebP encode are missing.
const MEDIA_PRESETS = {
  post:  { maxW: 1080, maxH: 1080, quality: 0.80 },
  story: { maxW: 1080, maxH: 1920, quality: 0.75 },
  chat:  { maxW: 800,  maxH: 800,  quality: 0.70 }
}

const _hasModern = typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function'

async function _compressLegacy(file, maxW, maxH, quality) {
  // Classic path: HTMLImageElement + HTMLCanvasElement.toBlob.
  // Works on every browser including iOS Safari <15.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
        const w = Math.max(1, Math.round(img.naturalWidth * ratio))
        const h = Math.max(1, Math.round(img.naturalHeight * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        // Try WebP first; if the encoder isn't available the callback gets
        // null/undefined and we retry with JPEG (universally supported).
        const tryEncode = (mime, q) => new Promise(res => canvas.toBlob(b => res(b), mime, q))
        tryEncode('image/webp', quality).then(blob => {
          if (blob) { URL.revokeObjectURL(url); resolve(blob); return }
          tryEncode('image/jpeg', quality).then(b2 => {
            URL.revokeObjectURL(url)
            b2 ? resolve(b2) : reject(new Error('no se pudo procesar la imagen'))
          })
        })
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('no se pudo cargar la imagen'))
    }
    img.src = url
  })
}

async function compressImage(file, preset) {
  const { maxW, maxH, quality } = MEDIA_PRESETS[preset] ?? MEDIA_PRESETS.post
  if (_hasModern) {
    try {
      const img = await createImageBitmap(file)
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
      const w = Math.max(1, Math.round(img.width * ratio))
      const h = Math.max(1, Math.round(img.height * ratio))
      const canvas = new OffscreenCanvas(w, h)
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
      if (blob) return blob
    } catch (_) { /* fall through to legacy */ }
  }
  return _compressLegacy(file, maxW, maxH, quality)
}

function formatSize(bytes) {
  return bytes < 1024 ? bytes + ' B'
    : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1048576).toFixed(1) + ' MB'
}

// Compresión de imagen client-side a WebP
const MEDIA_PRESETS = {
  post:  { maxW: 1080, maxH: 1080, quality: 0.80 },
  story: { maxW: 1080, maxH: 1920, quality: 0.75 },
  chat:  { maxW: 800,  maxH: 800,  quality: 0.70 }
}

async function compressImage(file, preset) {
  const { maxW, maxH, quality } = MEDIA_PRESETS[preset] ?? MEDIA_PRESETS.post
  const img = await createImageBitmap(file)
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)
  const canvas = new OffscreenCanvas(w, h)
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas.convertToBlob({ type: 'image/webp', quality })
}

function formatSize(bytes) {
  return bytes < 1024 ? bytes + ' B'
    : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1048576).toFixed(1) + ' MB'
}

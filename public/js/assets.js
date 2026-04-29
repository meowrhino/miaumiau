// Assets — image preloader for the city.
// Loads PNG sprites in parallel, exposes Assets.get(key). If a key fails,
// it lands in Assets.failed and the renderer falls back to the procedural
// sprite from sprites.js.
;(function () {
  const Assets = {
    images: {},
    failed: new Set(),
    loaded: false,
    loading: false,
    progress: 0,

    load(manifest) {
      if (Assets.loading || Assets.loaded) return Promise.resolve()
      Assets.loading = true
      const entries = Object.entries(manifest || {})
      if (entries.length === 0) {
        Assets.loaded = true
        Assets.loading = false
        return Promise.resolve()
      }
      let done = 0
      return Promise.all(entries.map(([key, src]) =>
        new Promise(resolve => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => {
            Assets.images[key] = img
            done++
            Assets.progress = done / entries.length
            resolve()
          }
          img.onerror = () => {
            Assets.failed.add(key)
            done++
            Assets.progress = done / entries.length
            resolve()
          }
          img.src = src
        })
      )).then(() => {
        Assets.loaded = true
        Assets.loading = false
        if (Assets.failed.size > 0) {
          // Surface but don't block — fallback sprites take over for missing keys.
          console.info('[assets] missing:', Array.from(Assets.failed).join(', '))
        }
      })
    },

    get(key) {
      const img = Assets.images[key]
      return (img && img.complete && img.naturalWidth > 0) ? img : null
    },

    has(key) {
      return !!Assets.images[key]
    },
  }
  window.Assets = Assets
})()

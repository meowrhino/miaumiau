// Tiny analytics helper.
// Fire-and-forget POST to /api/track. Never throws, never blocks.
// Use sendBeacon when available (sends on page unload too).
;(function () {
  const ENDPOINT = '/api/track'

  function track(kind, props) {
    if (!kind) return
    const body = JSON.stringify({ kind, props: props || null })
    try {
      // sendBeacon is best-effort + survives page unload, but ignores auth headers
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon(ENDPOINT, blob)
        return
      }
    } catch (_) {}
    // Fallback: regular fetch
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    } catch (_) {}
  }

  window.track = track
})()

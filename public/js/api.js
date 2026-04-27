// API wrapper — un solo lugar para auth headers
// v2: Bearer token (preferred). v1 legacy: X-Miau (only for users that haven't migrated).
const API = {
  _authHeaders() {
    const headers = {}
    const user = App?.user
    if (!user) return headers
    if (user.token) {
      headers['Authorization'] = 'Bearer ' + user.token
    } else if (user.secret && user.username) {
      // legacy users still use tripcode until they migrate
      headers['X-Miau'] = user.username + '#' + user.secret
    }
    return headers
  },

  async fetch(method, path, body) {
    const headers = API._authHeaders()
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(body)
    }
    const resp = await fetch('/api' + path, { method, headers, body })
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      throw new Error(data.error ?? resp.statusText)
    }
    return resp.json()
  },

  get: (path) => API.fetch('GET', path),
  post: (path, body) => API.fetch('POST', path, body),
  put: (path, body) => API.fetch('PUT', path, body),
  del: (path) => API.fetch('DELETE', path),

  async upload(path, formData) {
    const headers = API._authHeaders()
    const resp = await fetch('/api' + path, { method: 'POST', headers, body: formData })
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      throw new Error(data.error ?? resp.statusText)
    }
    return resp.json()
  }
}

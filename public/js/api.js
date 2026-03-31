// API wrapper — un solo lugar para auth headers
const API = {
  async fetch(method, path, body) {
    const headers = {}
    const user = App?.user
    if (user) headers['X-Miau'] = user.username + '#' + user.secret
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
    const headers = {}
    const user = App?.user
    if (user) headers['X-Miau'] = user.username + '#' + user.secret
    const resp = await fetch('/api' + path, { method: 'POST', headers, body: formData })
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      throw new Error(data.error ?? resp.statusText)
    }
    return resp.json()
  }
}

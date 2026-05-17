import { defineConfig } from 'vite'

// El build va a public/v2 para que Cloudflare ASSETS lo sirva en /v2/*.
// En dev, todas las peticiones a /api/* van al wrangler local (puerto 8787).
export default defineConfig({
  base: '/v2/',
  build: {
    outDir: '../public/v2',
    emptyOutDir: true,
    // Sin sourcemap en el bundle deployado: añade ~10MB y no aporta en prod.
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the dev server forwards /api/* to the API: the local one when it runs (API_URL=http://127.0.0.1:8000), else the
// deployed one — the OpenRouter key lives only on the server
const api = process.env.API_URL ?? 'https://beyondbirthday.cc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: api, changeOrigin: true } },
  },
})

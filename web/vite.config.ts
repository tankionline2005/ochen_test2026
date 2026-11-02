import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // the dev server forwards /api/* to the backend, so the browser sees one origin (cookies just work)
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})

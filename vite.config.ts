import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Published as a GitHub Pages project site, so everything lives under /jev/.
export default defineConfig({
  base: '/jev/',
  plugins: [react()],
  server: {
    // In dev the page and the proxy share an origin: /api/* goes to the local server.
    proxy: { '/api': process.env.JEV_PROXY ?? 'http://127.0.0.1:8686' },
  },
  test: { environment: 'node', include: ['server/**/*.test.ts', 'shared/**/*.test.ts'] },
})

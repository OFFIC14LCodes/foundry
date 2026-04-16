import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const forgePort = Number(process.env.FORGE_PORT || 3001)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    host: true, // enables --host automatically
    proxy: {
      // Local dev only — proxied to the Node API server in dev/forge-server.mjs
      '/api': {
        target: `http://127.0.0.1:${forgePort}`,
        changeOrigin: true,
      }
    }
  }
})

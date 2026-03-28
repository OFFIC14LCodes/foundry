import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // enables --host automatically
    proxy: {
      // Local dev only — on Vercel, /api/forge is handled by the serverless function
      '/api/forge': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})

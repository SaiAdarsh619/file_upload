import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT || 5173,
    proxy: {
      '/api': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/login': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/register': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/logout': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/upload': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/delete-batch': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/download-batch': `http://localhost:${process.env.BACKEND_PORT || 5000}`,
      '/uploads': `http://localhost:${process.env.BACKEND_PORT || 5000}`
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/login': 'http://localhost:5000',
      '/register': 'http://localhost:5000',
      '/logout': 'http://localhost:5000',
      '/upload': 'http://localhost:5000',
      '/delete-batch': 'http://localhost:5000',
      '/download-batch': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000'
    }
  }
})

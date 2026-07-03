import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // `vercel dev --listen 3000` serves api/extract.ts during local development.
    // changeOrigin must stay off so the function's same-origin guard sees the
    // browser's Host and Origin agree.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
})

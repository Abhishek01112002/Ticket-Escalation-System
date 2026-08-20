import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiOrigin = process.env.VITE_API_ORIGIN ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/v1': { target: apiOrigin, changeOrigin: true } } },
})

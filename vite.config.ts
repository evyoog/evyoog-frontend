import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://turbo-spork-xr5pj4xv976gfv9jj-8080.app.github.dev',
        changeOrigin: true,
      },
    },
  },
})

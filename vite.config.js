import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发时 /api 代理到 argus-service（默认 :8899）；生产经反代或 VITE_API_BASE。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8899',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})

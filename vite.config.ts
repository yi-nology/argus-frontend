import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 开发 /api 代理到 argus-service（默认 :8899）；生产设 VITE_API_BASE。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
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
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ['antd', '@ant-design/icons'],
          // 刻意不钉 @ant-design/x / x-markdown：对象式 manualChunks 会把整包
          // 强塞进一个 chunk 并牵连入口 modulepreload（218KB 首屏白载实锤）；
          // 两者仅被 lazy 的 Assistant/TaskDetail 消费，交给 Rollup 按需分块。
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})

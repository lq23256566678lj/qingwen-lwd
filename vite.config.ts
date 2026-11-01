import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri 期望一个固定端口的前端开发服务器；构建产物由 src-tauri 嵌入。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'es2021',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
})

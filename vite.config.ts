import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer') },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  optimizeDeps: {
    exclude: ['mupdf'],
  },
})

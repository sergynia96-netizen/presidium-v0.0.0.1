import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Главное, ради чего мы это делали - настройки MIME-типов
  assetsInclude: ['**/*.wasm', '**/*.bin', '**/*.json'], 
  server: {
    headers: {
      '.wasm': {
        'Content-Type': 'application/wasm',
      }
    },
    fs: {
      allow: ['..']
    }
  }
})

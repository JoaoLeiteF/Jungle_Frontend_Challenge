import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // MSW's cookie emulation is unused by the token-based mock API (see src/mocks/tough-cookie-stub.ts)
      'tough-cookie': fileURLToPath(new URL('./src/mocks/tough-cookie-stub.ts', import.meta.url)),
    },
  },
  build: { target: 'es2022', sourcemap: true },
})

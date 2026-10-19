import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // backend/ has its own Vitest config and runs in a Node environment
    exclude: [...configDefaults.exclude, 'backend/**'],
  },
})

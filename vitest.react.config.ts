import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@frontend': fileURLToPath(new URL('./frontend/react', import.meta.url)),
      '@frontend-common': fileURLToPath(
        new URL('./frontend/common', import.meta.url),
      ),
      '@frontend-styles': fileURLToPath(
        new URL('./frontend/src/app/styles', import.meta.url),
      ),
      '@test': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    include: ['tests/react/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['tests/react/setup.ts'],
    restoreMocks: true,
  },
});

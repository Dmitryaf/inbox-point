import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@frontend': fileURLToPath(new URL('./frontend/src', import.meta.url)),
      '@legacy': fileURLToPath(
        new URL('./frontend/legacy/src', import.meta.url),
      ),
      '@test': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    environment: 'node',
    restoreMocks: true,
  },
});

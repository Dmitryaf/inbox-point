import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@frontend': fileURLToPath(new URL('./frontend/src', import.meta.url)),
      '@test': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    environment: 'node',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    restoreMocks: true,
  },
});

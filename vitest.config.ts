import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(
        new URL('./frontend/common/domain', import.meta.url),
      ),
      '@frontend': fileURLToPath(new URL('./frontend/src', import.meta.url)),
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
    coverage: { reporter: ['text', 'json', 'html'] },
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'frontend-build',
          include: ['tests/frontend/frontend-build.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend',
          include: ['tests/frontend/**/*.test.{ts,tsx}'],
          exclude: ['tests/frontend/frontend-build.test.ts'],
          environment: 'jsdom',
          setupFiles: ['tests/frontend/setup.ts'],
        },
      },
    ],
  },
});

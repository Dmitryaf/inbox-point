import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/',
  build: {
    assetsDir: '',
    emptyOutDir: true,
    outDir: resolve(root, '../dist/frontend'),
    rollupOptions: {
      input: resolve(root, 'index.html'),
      output: {
        assetFileNames: 'style.css',
        entryFileNames: 'app.js',
      },
    },
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@frontend': resolve(root, 'src'),
    },
  },
  root,
});

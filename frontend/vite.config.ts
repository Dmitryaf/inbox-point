import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
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
  plugins: [react()],
  resolve: {
    alias: {
      '@frontend': resolve(root, 'src'),
    },
  },
  root,
});

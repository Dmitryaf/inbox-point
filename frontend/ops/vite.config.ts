import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/ops/',
  build: {
    assetsDir: '',
    emptyOutDir: false,
    outDir: resolve(root, '../../dist/ops'),
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
      '@frontend': resolve(root, '..'),
      '@ops': resolve(root, 'src'),
    },
  },
  root,
});

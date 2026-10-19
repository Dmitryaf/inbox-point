import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const reactBuild = mode === 'react';
  return {
    base: '/',
    build: {
      assetsDir: '',
      emptyOutDir: true,
      outDir: resolve(
        root,
        reactBuild ? '../dist/frontend-react' : '../dist/frontend',
      ),
      rollupOptions: {
        input: resolve(root, 'index.html'),
        output: {
          assetFileNames: 'style.css',
          entryFileNames: 'app.js',
          ...(reactBuild ? { codeSplitting: false } : {}),
        },
      },
    },
    plugins: reactBuild
      ? [
          react(),
          {
            name: 'react-entry',
            transformIndexHtml: {
              order: 'pre',
              handler: (html) =>
                html.replace('src="/src/main.tsx"', 'src="/react/main.tsx"'),
            },
          },
        ]
      : [react()],
    resolve: {
      alias: {
        '@': resolve(root, '../src'),
        '@core': resolve(root, '../src/core'),
        '@frontend': resolve(root, reactBuild ? 'react' : 'src'),
        '@frontend-common': resolve(root, 'common'),
        '@frontend-styles': resolve(root, 'src/app/styles'),
      },
    },
    root,
  };
});

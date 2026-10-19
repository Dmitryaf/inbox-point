import { defineConfig } from '@playwright/test';

import base from './playwright.config.js';

const baseURL = 'http://127.0.0.1:4188';

export default defineConfig({
  ...base,
  testDir: './tests/react-e2e',
  use: { ...base.use, baseURL },
  webServer: [
    ...[4193, 4194].map((port) => ({
      command: `npx tsx tests/react-e2e/support/operations-server.ts --port=${port}`,
      reuseExistingServer: false,
      timeout: 30_000,
      url: `http://127.0.0.1:${port}/health`,
    })),
    {
      command: 'npx tsx tests/react-e2e/support/setup-server.ts',
      reuseExistingServer: false,
      timeout: 30_000,
      url: 'http://127.0.0.1:4192/health',
    },
    {
      command: 'npx tsx tests/react-e2e/support/editor-server.ts --port=4191',
      reuseExistingServer: false,
      timeout: 30_000,
      url: 'http://127.0.0.1:4191/health',
    },
    {
      command: 'npx tsx tests/react-e2e/support/editor-server.ts',
      reuseExistingServer: false,
      timeout: 30_000,
      url: 'http://127.0.0.1:4190/health',
    },
    {
      command:
        'npm run test:e2e:server -- --port=4188 --password=synthetic-admin-password --frontend-root=dist/frontend-react',
      reuseExistingServer: false,
      timeout: 30_000,
      url: `${baseURL}/health`,
    },
    {
      command:
        'npm run test:e2e:server -- --port=4189 --frontend-root=dist/frontend-react',
      reuseExistingServer: false,
      timeout: 30_000,
      url: 'http://127.0.0.1:4189/health',
    },
  ],
});

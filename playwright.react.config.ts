import { defineConfig } from '@playwright/test';

import base from './playwright.config.js';

const baseURL = 'http://127.0.0.1:4188';

export default defineConfig({
  ...base,
  testDir: './tests/react-e2e',
  use: { ...base.use, baseURL },
  webServer: [4188, 4189, 4190, 4191, 4192, 4193, 4194].map((port) => ({
    command: `npm run test:e2e:server -- --port=${port}${[4175, 4189].includes(port) ? '' : ' --password=synthetic-admin-password'} --frontend-root=dist/frontend-react`,
    reuseExistingServer: false,
    timeout: 45_000,
    url: `http://127.0.0.1:${port}/health`,
  })),
});

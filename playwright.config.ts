import { defineConfig, devices } from '@playwright/test';

const passwordServer = 'http://127.0.0.1:4174';
const bypassServer = 'http://127.0.0.1:4175';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: passwordServer,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'npm run test:e2e:server -- --port=4174 --password=synthetic-admin-password',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: `${passwordServer}/health`,
    },
    {
      command: 'npm run test:e2e:server -- --port=4175',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: `${bypassServer}/health`,
    },
  ],
});

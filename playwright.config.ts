import { defineConfig, devices } from '@playwright/test';
const passwordServer = 'http://127.0.0.1:4174';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL;
const browser = {
  ...devices['Desktop Chrome'],
  ...(browserChannel ? { channel: browserChannel } : {}),
};
export default defineConfig({
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    { name: 'chromium', testIgnore: '**/workflows/**', use: browser },
    {
      name: 'chromium-workflows',
      testMatch: '**/workflows/**/*.spec.ts',
      use: { ...browser, baseURL: 'http://127.0.0.1:4188' },
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
  webServer: [4174, 4175, 4188, 4189, 4190, 4191, 4192, 4193, 4194].map(
    (port) => ({
      command: `npm run test:e2e:server -- --port=${port}${[4175, 4189].includes(port) ? '' : ' --password=synthetic-admin-password'}`,
      reuseExistingServer: false,
      timeout: 45_000,
      url: `http://127.0.0.1:${port}/health`,
    }),
  ),
});

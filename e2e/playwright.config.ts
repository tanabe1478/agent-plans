import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/settings\.spec\.ts/, /status-filtering\.spec\.ts/, /status-transitions\.spec\.ts/],
    },
    {
      // status-filtering and status-transitions share fixture state (blue-running-fox.md)
      // so they must run serially with respect to each other
      name: 'status-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [/status-filtering\.spec\.ts/, /status-transitions\.spec\.ts/],
      fullyParallel: false,
    },
    {
      name: 'settings',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /settings\.spec\.ts/,
      dependencies: ['chromium', 'status-tests'],
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use fixtures directory for tests
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures', 'plans');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @ccplans/api dev',
      cwd: '..',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        PLANS_DIR: fixturesDir,
      },
    },
    {
      command: 'pnpm --filter @ccplans/web dev',
      cwd: '..',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});

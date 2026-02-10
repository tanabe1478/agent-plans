import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApiPort, getWebPort } from './lib/ports.js';

// Use fixtures directory for tests
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures', 'plans');

const apiPort = getApiPort();
const webPort = getWebPort();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /settings\.spec\.ts/,
    },
    {
      name: 'settings',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /settings\.spec\.ts/,
      dependencies: ['chromium'],
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @ccplans/api dev',
      cwd: '..',
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        PLANS_DIR: fixturesDir,
        PORT: String(apiPort),
        CORS_ORIGINS: `http://localhost:${webPort}`,
      },
    },
    {
      command: 'pnpm --filter @ccplans/web dev',
      cwd: '..',
      url: `http://localhost:${webPort}`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        WEB_PORT: String(webPort),
        API_PORT: String(apiPort),
      },
    },
  ],
});

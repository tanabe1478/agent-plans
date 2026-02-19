import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication, Page } from '@playwright/test';
import { test as base, _electron as electron, expect } from '@playwright/test';
import electronPath from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, '../../../');
const seedDir = resolve(__dirname, 'fixtures/seed');
const mainEntry = resolve(monorepoRoot, 'apps/electron/out/main/index.js');

function resetFixtures(targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  const seedFiles = new Set(readdirSync(seedDir).filter((file) => file.endsWith('.md')));
  for (const file of seedFiles) {
    copyFileSync(resolve(seedDir, file), resolve(targetDir, file));
  }

  for (const dir of ['.history', '.backups', 'archive']) {
    rmSync(resolve(targetDir, dir), { recursive: true, force: true });
    mkdirSync(resolve(targetDir, dir), { recursive: true });
  }

  writeFileSync(resolve(targetDir, '.audit.jsonl'), '');
  writeFileSync(resolve(targetDir, '.views.json'), '[]');
  writeFileSync(resolve(targetDir, '.notifications-read.json'), '[]');
  writeFileSync(resolve(targetDir, '.settings.json'), '{}');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

interface ElectronFixtures {
  app: ElectronApplication;
  page: Page;
  plansDir: string;
}

export const test = base.extend<ElectronFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires object destructuring.
  plansDir: async ({}, use, testInfo) => {
    const dirName = [
      'agent-plans-electron-e2e',
      String(Date.now()),
      String(testInfo.workerIndex),
      slugify(testInfo.title),
    ].join('-');
    const dir = join(tmpdir(), dirName);
    resetFixtures(dir);

    try {
      await use(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },

  app: async ({ plansDir }, use) => {
    const app = await electron.launch({
      executablePath: electronPath,
      args: ['--no-sandbox', mainEntry],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        OPEN_DEVTOOLS: 'false',
        ELECTRON_DISABLE_SANDBOX: '1',
        PLANS_DIR: plansDir,
        ARCHIVE_DIR: join(plansDir, 'archive'),
      },
    });

    try {
      await use(app);
    } finally {
      await app.close();
    }
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect };

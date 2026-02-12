import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';
import electronPath from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, '../../../../');
const seedDir = resolve(monorepoRoot, 'e2e/fixtures/seed');
const mainEntry = resolve(monorepoRoot, 'apps/electron/out/main/index.js');

function resetFixtures(targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  const seedFiles = new Set(readdirSync(seedDir).filter((f) => f.endsWith('.md')));
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
  writeFileSync(resolve(targetDir, '.settings.json'), '{"frontmatterEnabled":true}');
}

test.describe('Electron smoke', () => {
  test('boots and shows plan list from seeded fixtures', async () => {
    const plansDir = join(tmpdir(), `ccplans-electron-e2e-${Date.now()}-1`);
    resetFixtures(plansDir);

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        OPEN_DEVTOOLS: 'false',
        PLANS_DIR: plansDir,
        ARCHIVE_DIR: join(plansDir, 'archive'),
      },
    });

    try {
      const page = await app.firstWindow();
      await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
      await expect(page.getByText('CLI Tool Refactoring')).toBeVisible();
    } finally {
      await app.close();
      rmSync(plansDir, { recursive: true, force: true });
    }
  });

  test('updates a plan status from card dropdown', async () => {
    const plansDir = join(tmpdir(), `ccplans-electron-e2e-${Date.now()}-2`);
    resetFixtures(plansDir);

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        OPEN_DEVTOOLS: 'false',
        PLANS_DIR: plansDir,
        ARCHIVE_DIR: join(plansDir, 'archive'),
      },
    });

    try {
      const page = await app.firstWindow();
      const card = page
        .locator('div.group.relative')
        .filter({ hasText: 'CLI Tool Refactoring' })
        .first();

      await expect(card.getByRole('button', { name: 'In Progress' })).toBeVisible();
      await card.getByRole('button', { name: 'In Progress' }).click();
      await page.getByRole('button', { name: 'Review' }).click();
      await expect(card.getByRole('button', { name: 'Review' })).toBeVisible();
    } finally {
      await app.close();
      rmSync(plansDir, { recursive: true, force: true });
    }
  });

  test('creates a backup from the backups page', async () => {
    const plansDir = join(tmpdir(), `ccplans-electron-e2e-${Date.now()}-3`);
    resetFixtures(plansDir);

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        OPEN_DEVTOOLS: 'false',
        PLANS_DIR: plansDir,
        ARCHIVE_DIR: join(plansDir, 'archive'),
      },
    });

    try {
      const page = await app.firstWindow();

      await page.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('link', { name: 'Backups' }).click();
      await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();

      await page.getByRole('button', { name: 'Create Backup' }).click();
      await expect(page.getByText(/\.json$/)).toBeVisible();
    } finally {
      await app.close();
      rmSync(plansDir, { recursive: true, force: true });
    }
  });
});

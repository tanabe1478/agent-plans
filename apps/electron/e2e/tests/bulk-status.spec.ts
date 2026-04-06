import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication, Page } from '@playwright/test';
import { test as base, _electron as electron, expect } from '@playwright/test';
import electronPath from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, '../../../../');
const seedDir = resolve(__dirname, '../fixtures/seed');
const mainEntry = resolve(monorepoRoot, 'apps/electron/out/main/index.js');

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Set up fixtures with a Codex session JSONL and settings pre-configured.
 */
function setupFixturesWithCodex(targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  const seedFiles = readdirSync(seedDir).filter((file) => file.endsWith('.md'));
  for (const file of seedFiles) {
    copyFileSync(resolve(seedDir, file), resolve(targetDir, file));
  }

  for (const dir of ['.history', '.backups', 'archive']) {
    rmSync(resolve(targetDir, dir), { recursive: true, force: true });
    mkdirSync(resolve(targetDir, dir), { recursive: true });
  }

  rmSync(resolve(targetDir, '.metadata.db'), { force: true });
  rmSync(resolve(targetDir, '.metadata.db-wal'), { force: true });
  rmSync(resolve(targetDir, '.metadata.db-shm'), { force: true });

  writeFileSync(resolve(targetDir, '.audit.jsonl'), '');
  writeFileSync(resolve(targetDir, '.views.json'), '[]');
  writeFileSync(resolve(targetDir, '.notifications-read.json'), '[]');

  // Create Codex session directory and file BEFORE app startup
  const sessionsDir = join(targetDir, '.codex-sessions');
  mkdirSync(sessionsDir, { recursive: true });

  const sessionFile = join(sessionsDir, 'session-bulk-test.jsonl');
  const lines = [
    JSON.stringify({
      type: 'turn_context',
      payload: { cwd: '/tmp/test-project' },
    }),
    JSON.stringify({
      timestamp: '2026-03-01T10:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: '<proposed_plan>\n# Codex Bulk Test Plan\n\n## Steps\n- [ ] First step\n- [ ] Second step\n</proposed_plan>',
          },
        ],
      },
    }),
  ];
  writeFileSync(sessionFile, lines.join('\n'), 'utf-8');

  // Write settings with Codex integration enabled BEFORE app startup
  const settings = {
    codexIntegrationEnabled: true,
    codexSessionLogDirectories: [sessionsDir],
  };
  writeFileSync(resolve(targetDir, '.settings.json'), JSON.stringify(settings), 'utf-8');
}

interface CodexFixtures {
  app: ElectronApplication;
  page: Page;
  plansDir: string;
}

const test = base.extend<CodexFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires object destructuring.
  plansDir: async ({}, use, testInfo) => {
    const dirName = [
      'agent-plans-e2e-codex',
      String(Date.now()),
      String(testInfo.workerIndex),
      slugify(testInfo.title),
    ].join('-');
    const dir = join(tmpdir(), dirName);
    setupFixturesWithCodex(dir);

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

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'beforeunload') {
        await dialog.accept();
        return;
      }
      await dialog.dismiss();
      throw new Error(`Unexpected dialog: ${dialog.type()} - ${dialog.message()}`);
    });

    await use(page);
  },
});

test.describe('Bulk status update includes Codex plans', () => {
  test('All button selects Codex plans and status update applies to them', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

    // Wait for Codex plan to appear in the list
    await expect(page.getByText('Codex Bulk Test Plan')).toBeVisible({ timeout: 10_000 });

    // Count total plans (seed markdown + 1 Codex)
    const totalPlanRows = await page.locator('[data-plan-row]').count();
    expect(totalPlanRows).toBeGreaterThanOrEqual(8); // 7 seed + at least 1 codex

    // Enter selection mode
    await page.getByRole('button', { name: 'Select' }).click();

    // Click "All" to select all plans
    await page.getByRole('button', { name: 'All' }).click();

    // Verify all plan rows are selected (including Codex)
    const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count();
    expect(checkedBoxes).toBe(totalPlanRows);

    // Select "Completed" status
    const statusSelect = page.locator('select[aria-label="Bulk status target"]');
    await statusSelect.selectOption('completed');

    // Click Update Status
    await page.getByRole('button', { name: 'Update Status' }).click();

    // Wait for the toast success message
    await expect(page.getByText(/plan\(s\) updated/)).toBeVisible({ timeout: 10_000 });

    // Verify Codex plan now shows "Completed" status
    const codexRow = page.locator('[data-plan-row]').filter({ hasText: 'Codex Bulk Test Plan' });
    await expect(codexRow.getByRole('button', { name: 'Completed' })).toBeVisible();
  });
});

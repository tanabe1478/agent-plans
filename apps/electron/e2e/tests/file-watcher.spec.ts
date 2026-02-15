import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../fixtures';

test.describe('File watcher', () => {
  test('settings page shows file watcher toggle defaulting to off', async ({ page }) => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'File Watcher' })).toBeVisible();

    const toggle = page.getByRole('switch', { name: 'File Watcher' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('can toggle file watcher on and off', async ({ page }) => {
    await page.getByRole('link', { name: 'Settings' }).click();

    const toggle = page.getByRole('switch', { name: 'File Watcher' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Toggle ON
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Toggle OFF
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('auto-refreshes plan list when file is modified externally with watcher enabled', async ({
    page,
    plansDir,
  }) => {
    // Enable file watcher via settings
    await page.getByRole('link', { name: 'Settings' }).click();
    const toggle = page.getByRole('switch', { name: 'File Watcher' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Navigate to home and wait for initial list to fully load
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
    await expect(page.locator('[data-plan-row="purple-swimming-fish.md"]').first()).toBeVisible();
    await expect(page.getByText('New External Plan')).toHaveCount(0);

    // Externally create a new plan file
    const newPlanPath = join(plansDir, 'new-external-plan.md');
    writeFileSync(
      newPlanPath,
      [
        '---',
        'created: "2026-02-16T00:00:00Z"',
        'modified: "2026-02-16T00:00:00Z"',
        'status: todo',
        '---',
        '# New External Plan',
        '',
        'This plan was created externally.',
      ].join('\n')
    );

    // The new plan should appear automatically (within debounce + query refresh)
    await expect(page.getByText('New External Plan')).toBeVisible({ timeout: 10_000 });
  });

  test('auto-refreshes plan detail when file is modified externally with watcher enabled', async ({
    page,
    plansDir,
  }) => {
    // Enable file watcher
    await page.getByRole('link', { name: 'Settings' }).click();
    const toggle = page.getByRole('switch', { name: 'File Watcher' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Navigate to a specific plan
    await page.getByRole('link', { name: 'Home' }).click();
    const row = page.locator('[data-plan-row="purple-swimming-fish.md"]').first();
    await row.getByRole('button', { name: 'Open detail' }).click();
    await expect(page.getByRole('heading', { name: 'CLI Tool Refactoring' }).first()).toBeVisible();

    // Externally append content to the file
    const planPath = join(plansDir, 'purple-swimming-fish.md');
    appendFileSync(
      planPath,
      '\n## Externally Added Section\n\nContent added by external editor.\n'
    );

    // The new content should appear automatically
    await expect(page.getByRole('heading', { name: 'Externally Added Section' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('does not auto-refresh when file watcher is disabled', async ({ page, plansDir }) => {
    // Confirm watcher is OFF (default)
    await page.getByRole('link', { name: 'Settings' }).click();
    const toggle = page.getByRole('switch', { name: 'File Watcher' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Navigate to home and wait for initial list to fully load
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
    await expect(page.locator('[data-plan-row="purple-swimming-fish.md"]').first()).toBeVisible();
    await expect(page.getByText('Invisible Plan')).toHaveCount(0);

    // Externally create a new plan file
    const newPlanPath = join(plansDir, 'invisible-plan.md');
    writeFileSync(
      newPlanPath,
      [
        '---',
        'created: "2026-02-16T00:00:00Z"',
        'modified: "2026-02-16T00:00:00Z"',
        'status: todo',
        '---',
        '# Invisible Plan',
        '',
        'This should NOT appear automatically.',
      ].join('\n')
    );

    // The plan should NOT appear (fail fast if it does)
    await expect(page.getByText('Invisible Plan')).not.toBeVisible({ timeout: 3000 });
  });
});

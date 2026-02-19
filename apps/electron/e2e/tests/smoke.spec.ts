import { expect, test } from '../fixtures';

test.describe('Electron smoke', () => {
  test('boots and shows plan list from seeded fixtures', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
    await expect(page.getByText('CLI Tool Refactoring')).toBeVisible();
  });

  test('updates a plan status from card dropdown', async ({ page }) => {
    const row = page.locator('[data-plan-row="purple-swimming-fish.md"]').first();

    const statusCell = row.locator('div.relative').first();
    await expect(statusCell.getByRole('button', { name: 'In Progress' })).toBeVisible();
    await statusCell.getByRole('button', { name: 'In Progress' }).click();
    await statusCell.getByRole('button', { name: 'Review' }).click();
    await expect(statusCell.getByRole('button', { name: 'Review' })).toBeVisible();
  });

  test('select mode uses card click for selection without navigation', async ({ page }) => {
    await page.getByRole('button', { name: 'Select' }).click();
    await page.locator('[data-plan-row="purple-swimming-fish.md"] input[type="checkbox"]').click();

    await expect(page.getByRole('button', { name: 'Delete (1)' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/plan\//);
  });

  test('opens review page and copies review prompt to clipboard', async ({ app, page }) => {
    const row = page.locator('[data-plan-row="purple-swimming-fish.md"]').first();
    await row.getByRole('button', { name: 'Open detail' }).click();
    await expect(page).toHaveURL(/#\/plan\//);

    await page.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByRole('heading', { name: 'CLI Tool Refactoring' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy All Prompts' })).toBeVisible();

    const gutter = page.locator('.review-diff-gutter').first();
    await gutter.click();

    const commentInput = page.getByPlaceholder(/add a comment/i);
    await commentInput.fill('Please simplify this section');
    await page.getByRole('button', { name: 'Comment' }).click();

    await page.getByRole('button', { name: 'Copy prompt' }).first().click();

    const clipboardText = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(clipboardText).toContain('Please simplify this section');
    expect(clipboardText).toContain('purple-swimming-fish.md:L1');
  });
});

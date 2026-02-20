import { expect, test } from '../fixtures';

test.describe('Search flows', () => {
  test('runs filter query from search input', async ({ page }) => {
    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress)');
    await expect(input).toBeVisible();

    await input.fill('status:todo');
    await input.press('Enter');

    await expect(page.getByText(/results? for/)).toBeVisible();
  });

  test('clears query and search state after typo query', async ({ page }) => {
    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress)');
    await input.fill('stats:todo');
    await input.press('Enter');

    await expect(page.getByText(/results? for/)).toBeVisible();

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByText(/results? for/)).not.toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('runs query via query guide buttons', async ({ page }) => {
    // Open the query guide popover
    await page.getByRole('button', { name: 'Query syntax guide' }).click();

    // Click the "In Progress" example
    await page.getByRole('button', { name: 'In Progress' }).click();

    await expect(page.getByText(/results? for/)).toBeVisible();
  });

  test('supports OR search clauses', async ({ page }) => {
    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress)');
    await input.fill('status:todo OR status:completed');
    await input.press('Enter');

    await expect(page.getByText(/results? for/)).toBeVisible();
    await expect(page.getByText('API Rate Limiting Implementation')).toBeVisible();
  });

  test('supports AND search clauses', async ({ page }) => {
    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress)');
    await input.fill('status:todo AND authentication');
    await input.press('Enter');

    await expect(page.getByText(/1 result for/)).toBeVisible();
  });

  test('clears active filter chip and resets search results', async ({ page }) => {
    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress)');
    await input.fill('status:todo');
    await input.press('Enter');

    await expect(page.getByText(/results? for/)).toBeVisible();

    await page.getByRole('button', { name: 'Remove status:todo filter' }).click();
    await expect(page.getByText(/results? for/)).not.toBeVisible();
    await expect(input).toHaveValue('');
  });
});

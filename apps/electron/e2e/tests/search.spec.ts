import { expect, test } from '../fixtures';

test.describe('Search flows', () => {
  test('runs filter query from search input', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress due<2026-12-31)');
    await input.fill('status:todo');
    await input.press('Enter');

    await expect(page).toHaveURL(/#\/search\?q=status%3Atodo/);
    await expect(page.getByText('"status:todo" -')).toBeVisible();
  });

  test('clears query and search state after typo query', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();

    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress due<2026-12-31)');
    await input.fill('stats:todo');
    await input.press('Enter');

    await expect(page).toHaveURL(/#\/search\?q=stats%3Atodo/);
    await expect(page.getByText('"stats:todo" -')).toBeVisible();

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).toHaveURL(/#\/search$/);
    await expect(page.getByText('"stats:todo" -')).not.toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('runs query via query guide buttons', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();
    await page.getByRole('button', { name: 'In Progress' }).click();

    await expect(page).toHaveURL(/#\/search\?q=status%3Ain_progress/);
    await expect(page.getByText('"status:in_progress" -')).toBeVisible();
  });
});

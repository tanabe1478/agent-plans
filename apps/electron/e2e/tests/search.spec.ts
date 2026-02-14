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

  test('supports OR search clauses', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();

    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress due<2026-12-31)');
    await input.fill('status:todo OR status:completed');
    await input.press('Enter');

    await expect(page).toHaveURL(/#\/search\?q=status%3Atodo%20OR%20status%3Acompleted/);
    await expect(page.getByText('"status:todo OR status:completed" -')).toBeVisible();
    await expect(page.getByText('API Rate Limiting Implementation')).toBeVisible();
  });

  test('supports AND search clauses', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();

    const input = page.getByPlaceholder('Search plans... (e.g. status:in_progress due<2026-12-31)');
    await input.fill('status:todo AND project:web-app');
    await input.press('Enter');

    await expect(page).toHaveURL(/#\/search\?q=status%3Atodo%20AND%20project%3Aweb-app/);
    await expect(page.getByText('"status:todo AND project:web-app" - 2 results')).toBeVisible();
    await expect(page.getByText('Web Application Authentication')).toBeVisible();
    await expect(page.getByText('Database Migration Plan')).toBeVisible();
  });

  test('supports multi-select status labels with OR behavior', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();

    await page.getByRole('button', { name: 'status:todo', exact: true }).click();
    await expect(page).toHaveURL(/#\/search\?q=status%3Atodo/);

    await page.getByRole('button', { name: 'status:in_progress', exact: true }).click();
    await expect(page).toHaveURL(/#\/search\?q=status%3Atodo%20OR%20status%3Ain_progress/);
    await expect(page.getByText('"status:todo OR status:in_progress" - 6 results')).toBeVisible();

    await page.getByRole('button', { name: 'status:todo', exact: true }).click();
    await expect(page).toHaveURL(/#\/search\?q=status%3Ain_progress/);
    await expect(page.getByText('"status:in_progress" - 3 results')).toBeVisible();
  });

  test('clears active filter chip and resets search results', async ({ page }) => {
    await page.getByRole('link', { name: 'Search' }).click();
    await page.getByRole('button', { name: /^status:todo/i }).click();

    await expect(page).toHaveURL(/#\/search\?q=status%3Atodo/);
    await expect(page.getByText('"status:todo" -')).toBeVisible();

    await page.getByRole('button', { name: 'Remove status:todo filter' }).click();
    await expect(page).toHaveURL(/#\/search$/);
    await expect(page.getByText('"status:todo" -')).not.toBeVisible();
    await expect(
      page.getByPlaceholder('Search plans... (e.g. status:in_progress due<2026-12-31)')
    ).toHaveValue('');
  });
});

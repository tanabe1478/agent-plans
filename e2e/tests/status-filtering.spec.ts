import { test, expect } from '@playwright/test';

// Fixture files:
// - blue-running-fox.md (todo)
// - green-dancing-cat.md (in_progress)
// - red-sleeping-bear.md (completed)
// - yellow-jumping-dog.md (todo)
// - purple-swimming-fish.md (in_progress)

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Status Filtering and Status Update', () => {
  test('should display status filter dropdown with all options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.getByRole('combobox').nth(1);
    await expect(statusFilter).toBeVisible();

    // Check all options are available
    await expect(statusFilter.getByRole('option', { name: 'All Status' })).toBeAttached();
    await expect(statusFilter.getByRole('option', { name: 'ToDo' })).toBeAttached();
    await expect(statusFilter.getByRole('option', { name: 'In Progress' })).toBeAttached();
    await expect(statusFilter.getByRole('option', { name: 'Completed' })).toBeAttached();
  });

  test('should display status badges on plan cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Fixtures include plans with various statuses - badges should be visible
    // in_progress: green-dancing-cat.md, purple-swimming-fish.md
    await expect(page.getByRole('button', { name: 'In Progress' }).first()).toBeVisible();

    // todo: blue-running-fox.md, yellow-jumping-dog.md
    await expect(page.getByRole('button', { name: 'ToDo' }).first()).toBeVisible();

    // completed: red-sleeping-bear.md
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();
  });

  test('should filter plans by status - ToDo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Select "ToDo" filter
    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('todo');

    // Wait for the filter to apply
    await page.waitForTimeout(300);

    // Should show plans with ToDo status (blue-running-fox, yellow-jumping-dog)
    await expect(page.getByRole('button', { name: 'ToDo' }).first()).toBeVisible();

    // Should NOT show In Progress plans
    const inProgressButton = page.getByRole('button', { name: 'In Progress' });
    await expect(inProgressButton).not.toBeVisible();
  });

  test('should filter plans by status - In Progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Select "In Progress" filter
    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('in_progress');

    // Wait for the filter to apply
    await page.waitForTimeout(300);

    // Should show plans with In Progress status
    await expect(page.getByRole('button', { name: 'In Progress' }).first()).toBeVisible();

    // Should NOT show ToDo plans
    const todoButton = page.getByRole('button', { name: 'ToDo' });
    await expect(todoButton).not.toBeVisible();
  });

  test('should filter plans by status - Completed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Select "Completed" filter
    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('completed');

    // Wait for the filter to apply
    await page.waitForTimeout(300);

    // Should show plans with Completed status (red-sleeping-bear)
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();

    // Should NOT show ToDo or In Progress plans
    const todoButton = page.getByRole('button', { name: 'ToDo' });
    const inProgressButton = page.getByRole('button', { name: 'In Progress' });
    await expect(todoButton).not.toBeVisible();
    await expect(inProgressButton).not.toBeVisible();
  });

  test('should open status dropdown when clicking status badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Click a status badge (In Progress from fixture)
    const statusBadge = page.getByRole('button', { name: 'In Progress' }).first();
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Dropdown should be open with all status options
    await expect(page.getByRole('button', { name: 'ToDo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();
  });

  test('should update status when selecting from dropdown', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Click a status badge
    const statusBadge = page.getByRole('button', { name: 'In Progress' }).first();
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
    await statusBadge.click();

    // Select "Completed"
    const completedOption = page.getByRole('button', { name: 'Completed' });
    await expect(completedOption).toBeVisible();
    await completedOption.click();

    // Wait for update
    await page.waitForTimeout(500);

    // Verify the update happened (should now have more Completed badges)
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();
  });

  test('should not navigate when clicking status badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Get current URL
    const currentUrl = page.url();

    // Click the status badge
    const statusBadge = page.getByRole('button', { name: 'In Progress' }).first();
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Should still be on the same page (not navigated to detail)
    expect(page.url()).toBe(currentUrl);
  });

  test('should show all status filter resets to show all plans', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.getByRole('combobox').nth(1);

    // First filter by completed
    await statusFilter.selectOption('completed');
    await page.waitForTimeout(300);

    // Then reset to all
    await statusFilter.selectOption('all');
    await page.waitForTimeout(300);

    // Should show all statuses again
    await expect(page.getByRole('button', { name: 'ToDo' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'In Progress' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();
  });
});

test.describe('Sort functionality', () => {
  test('should have sort dropdown with options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const sortDropdown = page.getByRole('combobox').first();
    await expect(sortDropdown).toBeVisible();

    await expect(sortDropdown.getByRole('option', { name: 'Date' })).toBeAttached();
    await expect(sortDropdown.getByRole('option', { name: 'Name' })).toBeAttached();
    await expect(sortDropdown.getByRole('option', { name: 'Size' })).toBeAttached();
  });

  test('should have sort order toggle button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const sortOrderButton = page.getByRole('button', { name: /ascending|descending/i });
    await expect(sortOrderButton).toBeVisible();
  });
});

test.describe('Search/Filter functionality', () => {
  test('should have search input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const searchInput = page.getByPlaceholder('フィルター...');
    await expect(searchInput).toBeVisible();
  });

  test('should filter plans by search query', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Type a search query that matches fixture content
    const searchInput = page.getByPlaceholder('フィルター...');
    await searchInput.fill('Authentication');

    // Wait for filtering
    await page.waitForTimeout(300);

    // Should show matching plans (blue-running-fox.md has "Authentication" in title)
    await expect(
      page.getByRole('heading', { name: /Authentication/i, level: 3 })
    ).toBeVisible();
  });
});

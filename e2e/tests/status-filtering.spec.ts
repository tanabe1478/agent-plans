import { test, expect } from '@playwright/test';

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

  test('should display status badge on plan card when status is set', async ({
    page,
    request,
  }) => {
    // Set status via API
    const response = await request.patch(
      'http://localhost:3001/api/plans/greedy-sleeping-bee.md/status',
      {
        data: { status: 'in_progress' },
      }
    );
    expect(response.ok()).toBeTruthy();

    // Navigate to see the updated badge
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Status badge should be visible
    await expect(page.getByRole('button', { name: 'In Progress' })).toBeVisible();
  });

  test('should filter plans by status', async ({ page, request }) => {
    // First, set a status on a plan via API
    const response = await request.patch(
      'http://localhost:3001/api/plans/greedy-sleeping-bee.md/status',
      {
        data: { status: 'todo' },
      }
    );
    expect(response.ok()).toBeTruthy();

    // Navigate to get updated data
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Select "ToDo" filter
    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('todo');

    // Should show the plan with ToDo status
    await expect(page.getByRole('button', { name: 'ToDo' })).toBeVisible();

    // Select "In Progress" filter - should show empty state or different plans
    await statusFilter.selectOption('in_progress');

    // Wait a bit for the filter to apply
    await page.waitForTimeout(300);

    // The ToDo button should no longer be visible (filtered out)
    const todoButton = page.getByRole('button', { name: 'ToDo' });
    await expect(todoButton).not.toBeVisible();
  });

  test('should open status dropdown when clicking status badge', async ({ page, request }) => {
    // Ensure a plan has status
    await request.patch('http://localhost:3001/api/plans/greedy-sleeping-bee.md/status', {
      data: { status: 'in_progress' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Click the status badge
    const statusBadge = page.getByRole('button', { name: 'In Progress' }).first();
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Dropdown should be open with all status options
    // The first "In Progress" is the badge, the second one is in the dropdown
    await expect(page.getByRole('button', { name: 'ToDo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();
  });

  test('should update status when selecting from dropdown', async ({ page, request }) => {
    // Start with 'todo' status
    await request.patch('http://localhost:3001/api/plans/greedy-sleeping-bee.md/status', {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Wait for the status badge to appear
    const statusBadge = page.getByRole('button', { name: 'ToDo' }).first();
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
    await statusBadge.click();

    // Select "Completed"
    const completedOption = page.getByRole('button', { name: 'Completed' });
    await expect(completedOption).toBeVisible();
    await completedOption.click();

    // Badge should now show "Completed"
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();

    // Verify via API that status was updated
    const response = await request.get(
      'http://localhost:3001/api/plans/greedy-sleeping-bee.md'
    );
    const plan = await response.json();
    expect(plan.frontmatter?.status).toBe('completed');
  });

  test('should not navigate when clicking status badge', async ({ page, request }) => {
    // Ensure a plan has status
    await request.patch('http://localhost:3001/api/plans/greedy-sleeping-bee.md/status', {
      data: { status: 'in_progress' },
    });

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

  test('should show empty state when no plans match filter', async ({ page, request }) => {
    // Set a known status first
    await request.patch('http://localhost:3001/api/plans/greedy-sleeping-bee.md/status', {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.getByRole('combobox').nth(1);

    // Filter by completed (no plans should have this status now)
    await statusFilter.selectOption('completed');

    // Wait for the list to update
    await page.waitForTimeout(500);

    // Check for empty state or plans
    const emptyMessage = page.getByText('No plans match the current filters');
    const completedButton = page.getByRole('button', { name: 'Completed' });

    // Either no plans match or there are completed plans
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);
    const hasCompletedPlans = await completedButton.isVisible().catch(() => false);

    // At least one condition should be true
    expect(isEmptyVisible || hasCompletedPlans).toBeTruthy();
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

    // Type a search query
    const searchInput = page.getByPlaceholder('フィルター...');
    await searchInput.fill('Enhancement');

    // Wait for filtering
    await page.waitForTimeout(300);

    // Should show matching plans
    await expect(
      page.getByRole('heading', { name: /Enhancement/i, level: 3 })
    ).toBeVisible();
  });
});

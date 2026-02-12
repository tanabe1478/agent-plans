import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

// Dedicated fixtures for this test file (not shared with other tests)
const FIXTURES = {
  todo1: { filename: 'test-sf-todo-1.md', status: 'todo', title: 'SF Todo Plan 1' },
  todo2: { filename: 'test-sf-todo-2.md', status: 'todo', title: 'SF Todo Plan 2' },
  inProgress1: {
    filename: 'test-sf-inprogress-1.md',
    status: 'in_progress',
    title: 'SF InProgress Plan 1',
  },
  inProgress2: {
    filename: 'test-sf-inprogress-2.md',
    status: 'in_progress',
    title: 'SF InProgress Plan 2',
  },
  completed1: {
    filename: 'test-sf-completed-1.md',
    status: 'completed',
    title: 'SF Completed Plan 1',
  },
} as const;

const ALL_FILENAMES = Object.values(FIXTURES).map((f) => f.filename);

function makePlan(title: string, status: string) {
  return `---
status: ${status}
---
# ${title}

Content for status filtering testing.
`;
}

// File-level setup/teardown so fixtures are available across all describe blocks
test.beforeAll(async ({ request, apiBaseUrl }) => {
  for (const f of Object.values(FIXTURES)) {
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: { filename: f.filename, content: makePlan(f.title, f.status) },
    });
  }
});

test.afterAll(async ({ request, apiBaseUrl }) => {
  for (const filename of ALL_FILENAMES) {
    await request.delete(`${apiBaseUrl}/api/plans/${filename}`).catch(() => {});
  }
});

/**
 * Helper: Select a value from a Radix Select (shadcn) trigger.
 * Radix Select renders as a button trigger + portal listbox.
 */
async function selectRadixOption(
  page: import('@playwright/test').Page,
  triggerLocator: import('@playwright/test').Locator,
  optionText: string
) {
  await triggerLocator.click();
  // Radix Select renders options in a portal, so we locate from the page root
  const option = page.getByRole('option', { name: optionText, exact: true });
  await option.click();
}

test.describe('Status Filtering and Status Update', () => {
  test('should display status filter dropdown with all options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // The status filter is a Radix Select trigger (button role).
    // There are multiple Select triggers on the page: sort, status, project.
    // The status filter trigger contains "All Status" text by default.
    const statusTrigger = page.locator('button[role="combobox"]').filter({ hasText: 'All Status' });
    await expect(statusTrigger).toBeVisible();

    // Open the select to verify options
    await statusTrigger.click();
    await expect(page.getByRole('option', { name: 'All Status' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'ToDo' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Completed' })).toBeVisible();
    // Close by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('should display status badges on plan cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'In Progress' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'ToDo' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed' }).first()).toBeVisible();
  });

  test('should filter plans by status - ToDo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.locator('button[role="combobox"]').filter({ hasText: 'All Status' });
    await selectRadixOption(page, statusFilter, 'ToDo');

    await expect(page.getByText(FIXTURES.inProgress1.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.inProgress2.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.completed1.filename)).not.toBeVisible();

    await expect(page.getByText(FIXTURES.todo1.filename)).toBeVisible();
    await expect(page.getByText(FIXTURES.todo2.filename)).toBeVisible();
  });

  test('should filter plans by status - In Progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.locator('button[role="combobox"]').filter({ hasText: 'All Status' });
    await selectRadixOption(page, statusFilter, 'In Progress');

    await expect(page.getByText(FIXTURES.todo1.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.todo2.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.completed1.filename)).not.toBeVisible();

    await expect(page.getByText(FIXTURES.inProgress1.filename)).toBeVisible();
    await expect(page.getByText(FIXTURES.inProgress2.filename)).toBeVisible();
  });

  test('should filter plans by status - Completed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.locator('button[role="combobox"]').filter({ hasText: 'All Status' });
    await selectRadixOption(page, statusFilter, 'Completed');

    await expect(page.getByText(FIXTURES.todo1.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.inProgress1.filename)).not.toBeVisible();

    await expect(page.getByText(FIXTURES.completed1.filename)).toBeVisible();
  });

  test('should open status dropdown when clicking status badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: FIXTURES.inProgress1.filename });
    await expect(planCard).toBeVisible();
    const statusBadge = planCard.getByRole('button', { name: 'In Progress' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();
  });

  test('should update status when selecting from dropdown', async ({
    page,
    request,
    apiBaseUrl,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: FIXTURES.inProgress1.filename });
    await expect(planCard).toBeVisible();
    const statusBadge = planCard.getByRole('button', { name: 'In Progress' });
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
    await statusBadge.click();

    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();

    const reviewOption = dropdown.getByText('Review');
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/status') && resp.request().method() === 'PATCH'
      ),
      reviewOption.click(),
    ]);

    await expect(planCard.getByRole('button', { name: 'Review' })).toBeVisible();

    // Reset status back for other tests
    await request.patch(`${apiBaseUrl}/api/plans/${FIXTURES.inProgress1.filename}/status`, {
      data: { status: 'in_progress' },
    });
  });

  test('should not navigate when clicking status badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const currentUrl = page.url();

    const statusBadge = page.getByRole('button', { name: 'In Progress' }).first();
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    expect(page.url()).toBe(currentUrl);
  });

  test('should show all status filter resets to show all plans', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Select "Completed" first
    const statusFilter = page.locator('button[role="combobox"]').filter({ hasText: 'All Status' });
    await selectRadixOption(page, statusFilter, 'Completed');
    await expect(page.getByText(FIXTURES.todo1.filename)).not.toBeVisible();

    // Now select "All Status" to reset - the trigger text has changed to "Completed"
    const currentTrigger = page.locator('button[role="combobox"]').filter({ hasText: 'Completed' });
    await selectRadixOption(page, currentTrigger, 'All Status');

    await expect(page.getByRole('button', { name: 'ToDo' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'In Progress' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed' }).first()).toBeVisible();
  });
});

test.describe('Sort functionality', () => {
  test('should have sort dropdown with options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Sort dropdown is the first Radix Select trigger, showing "Date" by default
    const sortTrigger = page.locator('button[role="combobox"]').filter({ hasText: 'Date' });
    await expect(sortTrigger).toBeVisible();

    // Open to verify options
    await sortTrigger.click();
    await expect(page.getByRole('option', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Size' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Date' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should have sort order toggle button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const sortOrderButton = page.getByRole('button', { name: /Ascending|Descending/i });
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

    const searchInput = page.getByPlaceholder('フィルター...');
    await searchInput.fill('SF Todo Plan 1');

    await page.waitForTimeout(300);

    await expect(page.getByText(FIXTURES.todo1.filename)).toBeVisible();
  });
});

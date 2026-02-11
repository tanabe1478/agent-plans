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

test.describe('Status Filtering and Status Update', () => {
  test('should display status filter dropdown with all options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.getByRole('combobox').nth(1);
    await expect(statusFilter).toBeVisible();

    await expect(statusFilter.getByRole('option', { name: 'All Status' })).toBeAttached();
    await expect(statusFilter.getByRole('option', { name: 'ToDo' })).toBeAttached();
    await expect(statusFilter.getByRole('option', { name: 'In Progress' })).toBeAttached();
    await expect(statusFilter.getByRole('option', { name: 'Completed' })).toBeAttached();
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

    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('todo');

    await expect(page.getByText(FIXTURES.inProgress1.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.inProgress2.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.completed1.filename)).not.toBeVisible();

    await expect(page.getByText(FIXTURES.todo1.filename)).toBeVisible();
    await expect(page.getByText(FIXTURES.todo2.filename)).toBeVisible();
  });

  test('should filter plans by status - In Progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('in_progress');

    await expect(page.getByText(FIXTURES.todo1.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.todo2.filename)).not.toBeVisible();
    await expect(page.getByText(FIXTURES.completed1.filename)).not.toBeVisible();

    await expect(page.getByText(FIXTURES.inProgress1.filename)).toBeVisible();
    await expect(page.getByText(FIXTURES.inProgress2.filename)).toBeVisible();
  });

  test('should filter plans by status - Completed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const statusFilter = page.getByRole('combobox').nth(1);
    await statusFilter.selectOption('completed');

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

    const statusFilter = page.getByRole('combobox').nth(1);

    await statusFilter.selectOption('completed');
    await expect(page.getByText(FIXTURES.todo1.filename)).not.toBeVisible();

    await statusFilter.selectOption('all');

    await expect(page.getByRole('button', { name: 'ToDo' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'In Progress' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed' }).first()).toBeVisible();
  });
});

test.describe('Sort functionality', () => {
  test('should have sort dropdown with options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const sortDropdown = page.getByRole('combobox').first();
    await expect(sortDropdown).toBeVisible();

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

    const searchInput = page.getByPlaceholder('フィルター...');
    await searchInput.fill('SF Todo Plan 1');

    await page.waitForTimeout(300);

    await expect(page.getByText(FIXTURES.todo1.filename)).toBeVisible();
  });
});

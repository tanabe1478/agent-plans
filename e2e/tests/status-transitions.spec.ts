import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

// Dedicated fixture created per test run (not shared with other test files)
const TEST_FILE = 'test-st-transitions.md';

function makePlan(status: string) {
  return `---
status: ${status}
---
# Status Transitions Test Plan

Content for status transitions testing.
`;
}

test.describe('Status Transitions (Feature 3)', () => {
  test.beforeAll(async ({ request, apiBaseUrl }) => {
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: { filename: TEST_FILE, content: makePlan('todo') },
    });
  });

  test.afterAll(async ({ request, apiBaseUrl }) => {
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_FILE}`).catch(() => {});
  });

  test.beforeEach(async ({ request, apiBaseUrl }) => {
    await request
      .patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
        data: { status: 'todo' },
      })
      .catch(() => {});
  });

  test('should show only valid transitions in status dropdown for todo status', async ({
    page,
    apiBaseUrl,
  }) => {
    await page.request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_FILE });
    await expect(planCard).toBeVisible();

    const statusBadge = planCard.getByRole('button', { name: 'ToDo' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();

    // For todo status, only in_progress should be available
    await expect(dropdown.getByText('In Progress')).toBeVisible();

    // Review and Completed should NOT be directly available from todo
    await expect(dropdown.getByText('Review')).not.toBeVisible();
    await expect(dropdown.getByText('Completed')).not.toBeVisible();
  });

  test('should show todo and review as transitions for in_progress status', async ({
    page,
    apiBaseUrl,
  }) => {
    await page.request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'in_progress' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_FILE });
    await expect(planCard).toBeVisible();

    const statusBadge = planCard.getByRole('button', { name: 'In Progress' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();

    // For in_progress, todo and review should be available
    await expect(dropdown.getByText('ToDo')).toBeVisible();
    await expect(dropdown.getByText('Review')).toBeVisible();

    // Completed should NOT be directly available from in_progress
    await expect(dropdown.getByText('Completed')).not.toBeVisible();
  });

  test('should successfully transition status from todo to in_progress', async ({
    page,
    request,
    apiBaseUrl,
  }) => {
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_FILE });
    const statusBadge = planCard.getByRole('button', { name: 'ToDo' });
    await statusBadge.click();

    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();
    const inProgressOption = dropdown.getByText('In Progress');

    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/status') && resp.request().method() === 'PATCH'
      ),
      inProgressOption.click(),
    ]);

    // Verify status changed via API
    const response = await request.get(`${apiBaseUrl}/api/plans/${TEST_FILE}`);
    const plan = await response.json();
    expect(plan.frontmatter.status).toBe('in_progress');
  });

  test('should reject invalid status transition via API', async ({ request, apiBaseUrl }) => {
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    // Try to transition directly from todo to review (invalid)
    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'review' },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid status transition');
  });

  test('should display review status badge with correct color', async ({
    page,
    request,
    apiBaseUrl,
  }) => {
    const testFilename = 'test-review-status.md';

    try {
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: makePlan('review'),
        },
      });

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

      const planCard = page
        .locator('[class*="rounded-lg"][class*="border"]')
        .filter({ hasText: testFilename });
      await expect(planCard).toBeVisible();

      const reviewBadge = planCard.getByRole('button', { name: 'Review' });
      await expect(reviewBadge).toBeVisible();

      const badgeClass = await reviewBadge.getAttribute('class');
      expect(badgeClass).toContain('purple');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should allow review to completed transition via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-review-to-completed.md';

    try {
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: { filename: testFilename, content: makePlan('review') },
      });

      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: { status: 'completed' },
      });
      expect(response.ok()).toBeTruthy();

      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.status).toBe('completed');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should allow completed to todo transition via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-completed-to-todo.md';

    try {
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: { filename: testFilename, content: makePlan('completed') },
      });

      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: { status: 'todo' },
      });
      expect(response.ok()).toBeTruthy();

      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.status).toBe('todo');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should allow review to in_progress transition via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-review-to-inprogress.md';

    try {
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: { filename: testFilename, content: makePlan('review') },
      });

      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: { status: 'in_progress' },
      });
      expect(response.ok()).toBeTruthy();

      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.status).toBe('in_progress');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should allow same status transition (no-op) via API', async ({ request, apiBaseUrl }) => {
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });
    expect(response.ok()).toBeTruthy();

    const getResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_FILE}`);
    const plan = await getResponse.json();
    expect(plan.frontmatter.status).toBe('todo');
  });

  test('should reject todo to completed transition via API', async ({ request, apiBaseUrl }) => {
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'completed' },
    });
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.error).toContain('Invalid status transition');
  });

  test('should reject in_progress to completed transition via API', async ({
    request,
    apiBaseUrl,
  }) => {
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'in_progress' },
    });

    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'completed' },
    });
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.error).toContain('Invalid status transition');
  });
});

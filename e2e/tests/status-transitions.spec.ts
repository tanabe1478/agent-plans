import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });
const TEST_FILE = 'test-st-transitions.md';

const TEST_PLAN_CONTENT = `---
status: todo
priority: medium
tags:
  - "test"
---
# Status Transitions Test Plan

Test content for status transitions.
`;

test.describe('Status Transitions (Feature 3)', () => {
  test.beforeAll(async ({ request, apiBaseUrl }) => {
    // Create a dedicated test plan for status transition tests
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: {
        filename: TEST_FILE,
        content: TEST_PLAN_CONTENT,
      },
    });
  });

  test.afterAll(async ({ request, apiBaseUrl }) => {
    // Clean up the dedicated test plan
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_FILE}`).catch(() => {});
  });

  test.beforeEach(async ({ request, apiBaseUrl }) => {
    // Reset to todo status before each test
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    }).catch(() => {});
  });

  test('should show only valid transitions in status dropdown for todo status', async ({
    page,
    apiBaseUrl,
  }) => {
    // Ensure fixture is in todo status
    await page.request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find the plan card for the fixture (uses border-2 class)
    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_FILE });
    await expect(planCard).toBeVisible();

    // Click status badge to open dropdown
    const statusBadge = planCard.getByRole('button', { name: 'ToDo' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Wait for dropdown to appear (scoped to plan card's status dropdown container)
    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();

    // For todo status, only in_progress should be available
    const inProgressOption = dropdown.getByText('In Progress');
    await expect(inProgressOption).toBeVisible();

    // Review and Completed should NOT be directly available from todo
    await expect(dropdown.getByText('Review')).not.toBeVisible();
    await expect(dropdown.getByText('Completed')).not.toBeVisible();
  });

  test('should show todo and review as transitions for in_progress status', async ({
    page,
    apiBaseUrl,
  }) => {
    // Set fixture to in_progress, then load page with fresh data
    await page.request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'in_progress' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find the plan card
    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_FILE });
    await expect(planCard).toBeVisible();

    // Click status badge
    const statusBadge = planCard.getByRole('button', { name: 'In Progress' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Wait for dropdown (scoped to plan card)
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
    // Set fixture to todo
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find and click status badge
    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_FILE });
    const statusBadge = planCard.getByRole('button', { name: 'ToDo' });
    await statusBadge.click();

    // Select in_progress
    const dropdown = planCard.locator('.z-50');
    await expect(dropdown).toBeVisible();
    const inProgressOption = dropdown.getByText('In Progress');

    // Click and wait for the PATCH response
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
    // Set fixture to todo
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    // Try to transition directly from todo to review (invalid)
    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'review' },
    });

    // Should be rejected with 400
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
      // Create a plan with review status
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: review
---
# Test Review Status

Content.
`,
        },
      });

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

      // Find the plan and check badge
      const planCard = page
        .locator('[class*="rounded-lg"][class*="border"]')
        .filter({ hasText: testFilename });
      await expect(planCard).toBeVisible();

      // Review badge should be visible with purple color
      const reviewBadge = planCard.getByRole('button', { name: 'Review' });
      await expect(reviewBadge).toBeVisible();

      // Check that badge has purple color class
      const badgeClass = await reviewBadge.getAttribute('class');
      expect(badgeClass).toContain('purple');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should allow review to completed transition via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-review-to-completed.md';

    try {
      // Create plan with review status
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: review
---
# Review to Completed Test

Content.
`,
        },
      });

      // Transition from review to completed (valid)
      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: { status: 'completed' },
      });
      expect(response.ok()).toBeTruthy();

      // Verify
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
      // Create plan with completed status
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: completed
---
# Completed to Todo Test

Content.
`,
        },
      });

      // Transition from completed to todo (valid: reopening)
      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: { status: 'todo' },
      });
      expect(response.ok()).toBeTruthy();

      // Verify
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
      // Create plan with review status
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: review
---
# Review to In Progress Test

Content.
`,
        },
      });

      // Transition from review to in_progress (valid: sending back for rework)
      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: { status: 'in_progress' },
      });
      expect(response.ok()).toBeTruthy();

      // Verify
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.status).toBe('in_progress');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should allow same status transition (no-op) via API', async ({ request, apiBaseUrl }) => {
    // Set fixture to todo
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    // Transition todo to todo (same status, should be a no-op success)
    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });
    expect(response.ok()).toBeTruthy();

    // Verify status is still todo
    const getResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_FILE}`);
    const plan = await getResponse.json();
    expect(plan.frontmatter.status).toBe('todo');
  });

  test('should reject todo to completed transition via API', async ({ request, apiBaseUrl }) => {
    // Set fixture to todo
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });

    // Try to transition directly from todo to completed (invalid: must go through in_progress and review)
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
    // Set fixture to in_progress
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'todo' },
    });
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'in_progress' },
    });

    // Try to transition directly from in_progress to completed (invalid: must go through review)
    const response = await request.patch(`${apiBaseUrl}/api/plans/${TEST_FILE}/status`, {
      data: { status: 'completed' },
    });
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.error).toContain('Invalid status transition');
  });
});

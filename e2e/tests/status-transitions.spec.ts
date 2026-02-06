import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const API_BASE_URL = 'http://localhost:3001';
const FIXTURE_FILE = 'blue-running-fox.md'; // Fixture with status=todo

test.describe('Status Transitions (Feature 3)', () => {
  let originalStatus: string;

  test.beforeEach(async ({ request }) => {
    // Get original status to restore later
    const response = await request.get(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}`);
    const plan = await response.json();
    originalStatus = plan.frontmatter?.status || 'todo';
  });

  test.afterEach(async ({ request }) => {
    // Restore original status
    if (originalStatus) {
      await request.patch(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}/status`, {
        data: { status: originalStatus },
      }).catch(() => {});
    }
  });

  test('should show only valid transitions in status dropdown for todo status', async ({ page }) => {
    // Ensure fixture is in todo status
    await page.request.patch(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}/status`, {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find the todo status badge for the fixture
    const planCard = page.locator('div.rounded-lg.border').filter({ hasText: FIXTURE_FILE });
    await expect(planCard).toBeVisible();

    // Click status badge to open dropdown
    const statusBadge = planCard.getByRole('button', { name: 'ToDo' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Wait for dropdown to appear
    const dropdown = page.locator('.z-50.rounded-md.border');
    await expect(dropdown).toBeVisible();

    // For todo status, only in_progress should be available
    const inProgressOption = dropdown.getByRole('button', { name: 'In Progress' });
    await expect(inProgressOption).toBeVisible();

    // Review and Completed should NOT be directly available from todo
    const reviewOption = dropdown.getByRole('button', { name: 'Review' });
    const completedOption = dropdown.getByRole('button', { name: 'Completed' });
    await expect(reviewOption).not.toBeVisible();
    await expect(completedOption).not.toBeVisible();
  });

  test('should show todo and review as transitions for in_progress status', async ({ page }) => {
    // Set fixture to in_progress
    await page.request.patch(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}/status`, {
      data: { status: 'in_progress' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find the plan with in_progress status
    const planCard = page.locator('div.rounded-lg.border').filter({ hasText: FIXTURE_FILE });
    await expect(planCard).toBeVisible();

    // Click status badge
    const statusBadge = planCard.getByRole('button', { name: 'In Progress' });
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Wait for dropdown
    const dropdown = page.locator('.z-50.rounded-md.border');
    await expect(dropdown).toBeVisible();

    // For in_progress, todo and review should be available
    await expect(dropdown.getByRole('button', { name: 'ToDo' })).toBeVisible();
    await expect(dropdown.getByRole('button', { name: 'Review' })).toBeVisible();

    // Completed should NOT be directly available from in_progress
    await expect(dropdown.getByRole('button', { name: 'Completed' })).not.toBeVisible();
  });

  test('should successfully transition status from todo to in_progress', async ({ page, request }) => {
    // Set fixture to todo
    await request.patch(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}/status`, {
      data: { status: 'todo' },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find and click status badge
    const planCard = page.locator('div.rounded-lg.border').filter({ hasText: FIXTURE_FILE });
    const statusBadge = planCard.getByRole('button', { name: 'ToDo' });
    await statusBadge.click();

    // Select in_progress
    const dropdown = page.locator('.z-50.rounded-md.border');
    await expect(dropdown).toBeVisible();
    const inProgressOption = dropdown.getByRole('button', { name: 'In Progress' });
    await inProgressOption.click();

    // Wait for update
    await page.waitForTimeout(1000);

    // Verify status changed via API
    const response = await request.get(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}`);
    const plan = await response.json();
    expect(plan.frontmatter.status).toBe('in_progress');
  });

  test('should reject invalid status transition via API', async ({ request }) => {
    // Set fixture to todo
    await request.patch(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}/status`, {
      data: { status: 'todo' },
    });

    // Try to transition directly from todo to review (invalid)
    const response = await request.patch(`${API_BASE_URL}/api/plans/${FIXTURE_FILE}/status`, {
      data: { status: 'review' },
    });

    // Should be rejected with 400
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('Invalid status transition');
  });

  test('should display review status badge with correct color', async ({ page, request }) => {
    const testFilename = 'test-review-status.md';

    try {
      // Create a plan with review status
      await request.post(`${API_BASE_URL}/api/plans`, {
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
      const planCard = page.locator('div.rounded-lg.border').filter({ hasText: testFilename });
      await expect(planCard).toBeVisible();

      // Review badge should be visible with purple color
      const reviewBadge = planCard.getByRole('button', { name: 'Review' });
      await expect(reviewBadge).toBeVisible();

      // Check that badge has purple color class
      const badgeClass = await reviewBadge.getAttribute('class');
      expect(badgeClass).toContain('purple');
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });
});

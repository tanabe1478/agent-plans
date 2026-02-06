import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const API_BASE_URL = 'http://localhost:3001';
const FIXTURE_WITH_SUBTASKS = 'green-dancing-cat.md'; // Has 3 subtasks: 1 done, 2 todo

test.describe('Subtasks (Feature 4)', () => {
  test('should display subtask list on detail page', async ({ page }) => {
    await page.goto(`/plan/${FIXTURE_WITH_SUBTASKS}`);
    await expect(page.getByRole('heading', { name: /Mobile App Performance/i }).first()).toBeVisible();

    // Subtask section should be visible
    await expect(page.getByRole('heading', { name: 'Subtasks' })).toBeVisible();

    // Should show all 3 subtasks
    await expect(page.getByText('Analyze bundle size')).toBeVisible();
    await expect(page.getByText('Fix memory leaks')).toBeVisible();
    await expect(page.getByText('Implement lazy loading')).toBeVisible();
  });

  test('should display subtask progress on detail page', async ({ page }) => {
    await page.goto(`/plan/${FIXTURE_WITH_SUBTASKS}`);
    await expect(page.getByRole('heading', { name: /Mobile App Performance/i }).first()).toBeVisible();

    // Progress indicator should show 1/3 (33%)
    const progressText = page.getByText(/1\/3/);
    await expect(progressText).toBeVisible();

    // Progress percentage should be shown
    const percentageText = page.getByText(/33%/);
    await expect(percentageText).toBeVisible();
  });

  test('should add new subtask via API', async ({ request }) => {
    const testFilename = 'test-subtask-add.md';

    try {
      // Create plan with initial subtasks
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "sub-001"
    title: "First task"
    status: todo
---
# Test Subtasks

Content.
`,
        },
      });

      // Add a new subtask
      const addResponse = await request.patch(`${API_BASE_URL}/api/plans/${testFilename}/subtasks`, {
        data: {
          action: 'add',
          subtask: {
            title: 'New subtask',
            status: 'todo',
          },
        },
      });

      expect(addResponse.ok()).toBeTruthy();
      const addResult = await addResponse.json();
      expect(addResult.success).toBe(true);
      expect(addResult.subtask).toBeDefined();
      expect(addResult.subtask.title).toBe('New subtask');

      // Verify by fetching plan
      const getResponse = await request.get(`${API_BASE_URL}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.subtasks).toHaveLength(2);
      expect(plan.frontmatter.subtasks.some((s: { title: string }) => s.title === 'New subtask')).toBe(true);
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should toggle subtask status via API', async ({ request }) => {
    const testFilename = 'test-subtask-toggle.md';

    try {
      // Create plan with subtasks
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "sub-001"
    title: "First task"
    status: todo
---
# Test Subtasks

Content.
`,
        },
      });

      // Toggle subtask status
      const toggleResponse = await request.patch(`${API_BASE_URL}/api/plans/${testFilename}/subtasks`, {
        data: {
          action: 'toggle',
          subtaskId: 'sub-001',
        },
      });

      expect(toggleResponse.ok()).toBeTruthy();
      const toggleResult = await toggleResponse.json();
      expect(toggleResult.success).toBe(true);
      expect(toggleResult.subtask.status).toBe('done');

      // Verify by fetching plan
      const getResponse = await request.get(`${API_BASE_URL}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      const subtask = plan.frontmatter.subtasks.find((s: { id: string }) => s.id === 'sub-001');
      expect(subtask.status).toBe('done');

      // Toggle again to switch back
      const toggle2Response = await request.patch(`${API_BASE_URL}/api/plans/${testFilename}/subtasks`, {
        data: {
          action: 'toggle',
          subtaskId: 'sub-001',
        },
      });

      expect(toggle2Response.ok()).toBeTruthy();
      const toggle2Result = await toggle2Response.json();
      expect(toggle2Result.subtask.status).toBe('todo');
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should display subtask progress on plan card in list view', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find plan card with subtasks
    const planCard = page.locator('div.rounded-lg.border').filter({ hasText: FIXTURE_WITH_SUBTASKS });
    await expect(planCard).toBeVisible();

    // Should show progress indicator (1/3)
    await expect(planCard.getByText('1/3')).toBeVisible();

    // Should have a progress bar
    const progressBar = planCard.locator('.bg-primary');
    await expect(progressBar).toBeVisible();
  });
});

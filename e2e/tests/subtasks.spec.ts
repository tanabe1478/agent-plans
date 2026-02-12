import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });
const FIXTURE_WITH_SUBTASKS = 'green-dancing-cat.md'; // Has 3 subtasks: 1 done, 2 todo

test.describe('Subtasks (Feature 4)', () => {
  test('should display subtask list on detail page', async ({ page }) => {
    await page.goto(`/plan/${FIXTURE_WITH_SUBTASKS}`);
    await expect(
      page.getByRole('heading', { name: /Mobile App Performance/i }).first()
    ).toBeVisible();

    // Subtask section should be visible
    await expect(page.getByRole('heading', { name: 'Subtasks' })).toBeVisible();

    // Should show all 3 subtasks (use .first() because content also contains raw subtask YAML)
    await expect(page.getByText('Analyze bundle size').first()).toBeVisible();
    await expect(page.getByText('Fix memory leaks').first()).toBeVisible();
    await expect(page.getByText('Implement lazy loading').first()).toBeVisible();
  });

  test('should display subtask progress on detail page', async ({ page }) => {
    await page.goto(`/plan/${FIXTURE_WITH_SUBTASKS}`);
    await expect(
      page.getByRole('heading', { name: /Mobile App Performance/i }).first()
    ).toBeVisible();

    // Progress indicator should show 1/3 (33%)
    const progressText = page.getByText(/1\/3/);
    await expect(progressText).toBeVisible();

    // Progress percentage should be shown
    const percentageText = page.getByText(/33%/);
    await expect(percentageText).toBeVisible();
  });

  test('should add new subtask via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-add.md';

    try {
      // Create plan with initial subtasks
      await request.post(`${apiBaseUrl}/api/plans`, {
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
      const addResponse = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/subtasks`, {
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
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.subtasks).toHaveLength(2);
      expect(
        plan.frontmatter.subtasks.some((s: { title: string }) => s.title === 'New subtask')
      ).toBe(true);
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should toggle subtask status via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-toggle.md';

    try {
      // Create plan with subtasks
      await request.post(`${apiBaseUrl}/api/plans`, {
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
      const toggleResponse = await request.patch(
        `${apiBaseUrl}/api/plans/${testFilename}/subtasks`,
        {
          data: {
            action: 'toggle',
            subtaskId: 'sub-001',
          },
        }
      );

      expect(toggleResponse.ok()).toBeTruthy();
      const toggleResult = await toggleResponse.json();
      expect(toggleResult.success).toBe(true);
      expect(toggleResult.subtask.status).toBe('done');

      // Verify by fetching plan
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      const subtask = plan.frontmatter.subtasks.find((s: { id: string }) => s.id === 'sub-001');
      expect(subtask.status).toBe('done');

      // Toggle again to switch back
      const toggle2Response = await request.patch(
        `${apiBaseUrl}/api/plans/${testFilename}/subtasks`,
        {
          data: {
            action: 'toggle',
            subtaskId: 'sub-001',
          },
        }
      );

      expect(toggle2Response.ok()).toBeTruthy();
      const toggle2Result = await toggle2Response.json();
      expect(toggle2Result.subtask.status).toBe('todo');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should display subtask progress on plan card in list view', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find plan card with subtasks
    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: FIXTURE_WITH_SUBTASKS });
    await expect(planCard).toBeVisible();

    // Should show progress indicator (1/3)
    await expect(planCard.getByText('1/3')).toBeVisible();

    // Should have a progress bar
    const progressBar = planCard.locator('.bg-primary');
    await expect(progressBar).toBeVisible();
  });

  test('should delete subtask via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-delete.md';

    try {
      // Create plan with subtasks
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "del-001"
    title: "Task to delete"
    status: todo
  - id: "del-002"
    title: "Task to keep"
    status: todo
---
# Delete Subtask Test

Content.
`,
        },
      });

      // Delete the first subtask
      const deleteResponse = await request.patch(
        `${apiBaseUrl}/api/plans/${testFilename}/subtasks`,
        {
          data: {
            action: 'delete',
            subtaskId: 'del-001',
          },
        }
      );

      expect(deleteResponse.ok()).toBeTruthy();
      const deleteResult = await deleteResponse.json();
      expect(deleteResult.success).toBe(true);

      // Verify subtask was removed
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.subtasks).toHaveLength(1);
      expect(plan.frontmatter.subtasks[0].id).toBe('del-002');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should update subtask title via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-update-title.md';

    try {
      // Create plan with subtask
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "upd-001"
    title: "Original title"
    status: todo
---
# Update Subtask Title Test

Content.
`,
        },
      });

      // Update subtask title
      const updateResponse = await request.patch(
        `${apiBaseUrl}/api/plans/${testFilename}/subtasks`,
        {
          data: {
            action: 'update',
            subtaskId: 'upd-001',
            subtask: {
              title: 'Updated title',
            },
          },
        }
      );

      expect(updateResponse.ok()).toBeTruthy();
      const updateResult = await updateResponse.json();
      expect(updateResult.success).toBe(true);
      expect(updateResult.subtask.title).toBe('Updated title');

      // Verify by fetching plan
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      const subtask = plan.frontmatter.subtasks.find((s: { id: string }) => s.id === 'upd-001');
      expect(subtask.title).toBe('Updated title');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should add subtask with dueDate via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-extra-fields.md';

    try {
      // Create plan with subtask
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "extra-001"
    title: "Task with extras"
    status: todo
---
# Subtask Extra Fields Test

Content.
`,
        },
      });

      // Add new subtask with dueDate
      const addResponse = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/subtasks`, {
        data: {
          action: 'add',
          subtask: {
            title: 'Task with due date',
            status: 'todo',
            dueDate: '2026-03-01',
          },
        },
      });

      expect(addResponse.ok()).toBeTruthy();
      const addResult = await addResponse.json();
      expect(addResult.success).toBe(true);
      expect(addResult.subtask.title).toBe('Task with due date');
      expect(addResult.subtask.dueDate).toBe('2026-03-01');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should toggle subtask via UI checkbox', async ({ page, request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-ui-toggle.md';

    try {
      // Create plan with subtasks
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "ui-001"
    title: "UI toggle task"
    status: todo
  - id: "ui-002"
    title: "Another UI task"
    status: done
---
# UI Toggle Test

Content.
`,
        },
      });

      // Navigate to detail page
      await page.goto(`/plan/${testFilename}`);
      await expect(page.getByRole('heading', { name: 'UI Toggle Test' }).first()).toBeVisible();

      // Wait for subtask section - use exact match to avoid matching raw frontmatter text
      await expect(page.getByText('UI toggle task', { exact: true })).toBeVisible();

      // Find the toggle button (Circle icon) for the first subtask in the SubtaskList
      const subtaskRow = page.locator('li').filter({ hasText: 'UI toggle task' });
      const toggleButton = subtaskRow.locator('button').first();

      // Click to toggle from todo to done and wait for API response
      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/subtasks') && resp.request().method() === 'PATCH'
        ),
        toggleButton.click(),
      ]);

      // Verify via API that subtask was toggled
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      const subtask = plan.frontmatter.subtasks.find((s: { id: string }) => s.id === 'ui-001');
      expect(subtask.status).toBe('done');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should show correct progress after toggling subtask', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-subtask-progress-update.md';

    try {
      // Create plan with 3 subtasks: 1 done, 2 todo
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: in_progress
subtasks:
  - id: "prog-001"
    title: "Done task"
    status: done
  - id: "prog-002"
    title: "Todo task 1"
    status: todo
  - id: "prog-003"
    title: "Todo task 2"
    status: todo
---
# Progress Update Test

Content.
`,
        },
      });

      // Verify initial progress (1/3 = 33%)
      const initialResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const initialPlan = await initialResponse.json();
      const initialDone = initialPlan.frontmatter.subtasks.filter(
        (s: { status: string }) => s.status === 'done'
      ).length;
      expect(initialDone).toBe(1);

      // Toggle prog-002 to done
      await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/subtasks`, {
        data: {
          action: 'toggle',
          subtaskId: 'prog-002',
        },
      });

      // Verify updated progress (2/3 = 67%)
      const updatedResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const updatedPlan = await updatedResponse.json();
      const updatedDone = updatedPlan.frontmatter.subtasks.filter(
        (s: { status: string }) => s.status === 'done'
      ).length;
      expect(updatedDone).toBe(2);
      expect(updatedPlan.frontmatter.subtasks).toHaveLength(3);
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });
});

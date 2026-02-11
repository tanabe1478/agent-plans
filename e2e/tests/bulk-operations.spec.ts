import { expect, test } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });
const BULK_TEST_FILES = ['bulk-test-1.md', 'bulk-test-2.md', 'bulk-test-3.md'];

test.describe('Bulk Operations (Feature 5)', () => {
  test.beforeEach(async ({ request }) => {
    // Create test plans
    for (const filename of BULK_TEST_FILES) {
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename,
          content: `---
status: todo
priority: low
tags:
  - "test"
assignee: "nobody"
---
# ${filename}

Test content for bulk operations.
`,
        },
      });
    }
  });

  test.afterEach(async ({ request }) => {
    // Clean up
    for (const filename of BULK_TEST_FILES) {
      await request.delete(`${API_BASE_URL}/api/plans/${filename}`).catch(() => {});
    }
  });

  test('should perform bulk status change via API', async ({ request }) => {
    // Bulk update status to in_progress
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-status`, {
      data: {
        filenames: BULK_TEST_FILES,
        status: 'in_progress',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(0);

    // Verify each plan was updated
    for (const filename of BULK_TEST_FILES) {
      const planResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      const plan = await planResponse.json();
      expect(plan.frontmatter.status).toBe('in_progress');
    }
  });

  test('should perform bulk tag addition via API', async ({ request }) => {
    // Add tags to all plans
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-tags`, {
      data: {
        filenames: BULK_TEST_FILES,
        action: 'add',
        tags: ['bulk-added', 'automation'],
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.succeeded).toHaveLength(3);

    // Verify tags were added
    for (const filename of BULK_TEST_FILES) {
      const planResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      const plan = await planResponse.json();
      expect(plan.frontmatter.tags).toContain('bulk-added');
      expect(plan.frontmatter.tags).toContain('automation');
      expect(plan.frontmatter.tags).toContain('test'); // Original tag preserved
    }
  });

  test('should perform bulk priority change via API', async ({ request }) => {
    // Update priority for all plans
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-priority`, {
      data: {
        filenames: BULK_TEST_FILES,
        priority: 'high',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.succeeded).toHaveLength(3);

    // Verify priority was updated
    for (const filename of BULK_TEST_FILES) {
      const planResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      const plan = await planResponse.json();
      expect(plan.frontmatter.priority).toBe('high');
    }
  });

  test('should perform bulk assignee change via API', async ({ request }) => {
    // Assign all plans to a user
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-assign`, {
      data: {
        filenames: BULK_TEST_FILES,
        assignee: 'charlie',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.succeeded).toHaveLength(3);

    // Verify assignee was updated
    for (const filename of BULK_TEST_FILES) {
      const planResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      const plan = await planResponse.json();
      expect(plan.frontmatter.assignee).toBe('charlie');
    }
  });

  test('should perform bulk archive via API', async ({ request }) => {
    // Archive all plans
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-archive`, {
      data: {
        filenames: BULK_TEST_FILES,
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.succeeded).toHaveLength(3);

    // Verify plans were archived (should return 404)
    for (const filename of BULK_TEST_FILES) {
      const planResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      expect(planResponse.status()).toBe(404);
    }
  });

  test('should handle bulk tag removal via API', async ({ request }) => {
    // First add some tags
    await request.post(`${API_BASE_URL}/api/plans/bulk-tags`, {
      data: {
        filenames: BULK_TEST_FILES,
        action: 'add',
        tags: ['remove-me', 'keep-me'],
      },
    });

    // Remove specific tag
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-tags`, {
      data: {
        filenames: BULK_TEST_FILES,
        action: 'remove',
        tags: ['remove-me'],
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.succeeded).toHaveLength(3);

    // Verify tag was removed but others remain
    for (const filename of BULK_TEST_FILES) {
      const planResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      const plan = await planResponse.json();
      expect(plan.frontmatter.tags).not.toContain('remove-me');
      expect(plan.frontmatter.tags).toContain('keep-me');
      expect(plan.frontmatter.tags).toContain('test'); // Original tag preserved
    }
  });

  test('should handle partial failures in bulk operations', async ({ request }) => {
    const mixedFiles = [...BULK_TEST_FILES, 'non-existent-file.md'];

    // Try bulk status update with one non-existent file
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-status`, {
      data: {
        filenames: mixedFiles,
        status: 'in_progress',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    // Should succeed for existing files
    expect(result.succeeded).toHaveLength(3);
    // Should fail for non-existent file
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].filename).toBe('non-existent-file.md');
  });

  test('should enter and exit selection mode via UI', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find the selection mode toggle button
    const selectionButton = page.getByRole('button', { name: '選択' });
    await expect(selectionButton).toBeVisible();

    // Enter selection mode
    await selectionButton.click();

    // Checkboxes should appear on plan cards
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);

    // Exit selection mode by clicking the button again
    await selectionButton.click();

    // Checkboxes should disappear
    await expect(checkboxes.first()).not.toBeVisible({ timeout: 3000 });
  });

  test('should select and deselect plans in selection mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Enter selection mode
    const selectionButton = page.getByRole('button', { name: '選択' });
    await selectionButton.click();

    // Find checkboxes on the plan cards
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(0);

    // Select first plan
    await checkboxes.first().click();

    // Verify count display appears (e.g., "1件を削除" button)
    await expect(page.getByText(/1件を削除/)).toBeVisible();

    // Select another plan if available
    if (checkboxCount > 1) {
      await checkboxes.nth(1).click();
      await expect(page.getByText(/2件を削除/)).toBeVisible();
    }

    // Deselect first plan
    await checkboxes.first().click();

    // Count should decrease
    if (checkboxCount > 1) {
      await expect(page.getByText(/1件を削除/)).toBeVisible();
    }
  });

  test('should display bulk action bar with operation buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Enter selection mode and select a plan
    const selectionButton = page.getByRole('button', { name: '選択' });
    await selectionButton.click();

    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().click();

    // The BulkActionBar should appear at the bottom with operation buttons
    const bulkBar = page.locator('.fixed.bottom-0');
    await expect(bulkBar).toBeVisible();

    // Should show "selected" text
    await expect(bulkBar.getByText(/selected/)).toBeVisible();

    // Should have status dropdown
    const statusSelect = bulkBar.locator('select').first();
    await expect(statusSelect).toBeVisible();

    // Should have Tags button
    await expect(bulkBar.getByText('Tags')).toBeVisible();

    // Should have Assign button
    await expect(bulkBar.getByText('Assign')).toBeVisible();

    // Should have Archive button
    await expect(bulkBar.getByText('Archive')).toBeVisible();
  });

  test('should handle bulk delete with permanent flag via API', async ({ request }) => {
    const deleteTestFiles = ['bulk-perm-del-1.md', 'bulk-perm-del-2.md'];

    try {
      // Create test plans for deletion
      for (const filename of deleteTestFiles) {
        await request.post(`${API_BASE_URL}/api/plans`, {
          data: {
            filename,
            content: `---
status: todo
---
# ${filename}

Test content for permanent deletion.
`,
          },
        });
      }

      // Perform bulk delete with permanent flag
      const response = await request.post(`${API_BASE_URL}/api/plans/bulk-delete?permanent=true`, {
        data: {
          filenames: deleteTestFiles,
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);

      // Verify plans are permanently deleted (404)
      for (const filename of deleteTestFiles) {
        const getResponse = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
        expect(getResponse.status()).toBe(404);
      }
    } finally {
      // Cleanup just in case
      for (const filename of deleteTestFiles) {
        await request.delete(`${API_BASE_URL}/api/plans/${filename}`).catch(() => {});
      }
    }
  });

  test('should reject bulk operations with empty filenames', async ({ request }) => {
    // POST with empty filenames array - should be rejected by schema validation (min 1)
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-status`, {
      data: {
        filenames: [],
        status: 'in_progress',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should handle invalid status transition in bulk (partial failure)', async ({ request }) => {
    // First, set bulk-test-1 to in_progress (valid: todo -> in_progress)
    await request.post(`${API_BASE_URL}/api/plans/bulk-status`, {
      data: {
        filenames: BULK_TEST_FILES,
        status: 'in_progress',
      },
    });

    // Now set bulk-test-1 to review (valid: in_progress -> review)
    await request
      .patch(`${API_BASE_URL}/api/plans/bulk-status`, {
        data: {
          filenames: ['bulk-test-1.md'],
          status: 'review',
        },
      })
      .catch(() => {});
    // Use POST endpoint
    await request.post(`${API_BASE_URL}/api/plans/bulk-status`, {
      data: {
        filenames: ['bulk-test-1.md'],
        status: 'review',
      },
    });

    // Now try to bulk update all 3 to 'completed':
    // - bulk-test-1 is in 'review' -> 'completed' is VALID
    // - bulk-test-2 and bulk-test-3 are in 'in_progress' -> 'completed' is INVALID
    const response = await request.post(`${API_BASE_URL}/api/plans/bulk-status`, {
      data: {
        filenames: BULK_TEST_FILES,
        status: 'completed',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    // bulk-test-1 (review) should succeed
    expect(result.succeeded).toContain('bulk-test-1.md');
    // bulk-test-2 and bulk-test-3 (in_progress) should fail
    expect(result.failed.length).toBe(2);
    expect(result.failed.some((f: { filename: string }) => f.filename === 'bulk-test-2.md')).toBe(
      true
    );
    expect(result.failed.some((f: { filename: string }) => f.filename === 'bulk-test-3.md')).toBe(
      true
    );
  });
});

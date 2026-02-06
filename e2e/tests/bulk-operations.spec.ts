import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const API_BASE_URL = 'http://localhost:3001';
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
});

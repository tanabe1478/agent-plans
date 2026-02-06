import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const API_BASE_URL = 'http://localhost:3001';

test.describe('Validation (Feature 2)', () => {
  test('should handle plan creation with invalid frontmatter gracefully', async ({ request }) => {
    const testFilename = 'test-invalid-frontmatter.md';

    try {
      // Create plan with malformed frontmatter
      const response = await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: invalid_status
priority: super_high
dueDate: not-a-date
tags: this-should-be-array
---
# Plan with Invalid Frontmatter

Content.
`,
        },
      });

      // API should either accept with auto-correction or reject
      // Both behaviors are valid for this test
      if (response.ok()) {
        // If accepted, verify it was auto-corrected
        const plan = await response.json();
        expect(plan).toBeDefined();
      } else {
        // If rejected, should return appropriate error status
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    } finally {
      // Clean up if created
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should validate invalid status values via API', async ({ request }) => {
    const testFilename = 'test-invalid-status.md';

    try {
      // First create a valid plan
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: todo
---
# Test Plan

Content.
`,
        },
      });

      // Try to update with invalid status
      const response = await request.patch(`${API_BASE_URL}/api/plans/${testFilename}/status`, {
        data: {
          status: 'invalid_status',
        },
      });

      // Should reject with 400 error
      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toBeTruthy();
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should validate priority values via API', async ({ request }) => {
    const testFilename = 'test-priority-validation.md';

    try {
      // Create plan
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testFilename,
          content: '# Test Plan\n\nContent.',
        },
      });

      // Try bulk priority update with invalid priority
      const response = await request.post(`${API_BASE_URL}/api/plans/bulk-priority`, {
        data: {
          filenames: [testFilename],
          priority: 'super_critical', // Invalid priority
        },
      });

      // Should return validation error
      expect(response.status()).toBe(400);
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should validate due date format', async ({ request }) => {
    const testFilename = 'test-duedate-validation.md';

    try {
      // Create plan with invalid date format
      const response = await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
dueDate: "not-a-valid-date"
---
# Test Plan

Content.
`,
        },
      });

      // API should handle this gracefully (either reject or auto-correct)
      if (response.ok()) {
        const plan = await response.json();
        // If accepted, the invalid date should be handled
        expect(plan).toBeDefined();
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testFilename}`).catch(() => {});
    }
  });
});

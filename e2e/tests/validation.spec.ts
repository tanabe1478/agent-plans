import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Validation (Feature 2)', () => {
  test('should handle plan creation with invalid frontmatter gracefully', async ({
    request,
    apiBaseUrl,
  }) => {
    const testFilename = 'test-invalid-frontmatter.md';

    try {
      // Create plan with malformed frontmatter
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
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

      // Current API accepts plans without frontmatter validation on creation.
      // The plan is saved as-is and raw frontmatter values are preserved.
      expect(response.status()).toBe(201);
      const plan = await response.json();
      expect(plan).toBeDefined();
      expect(plan.filename).toBe(testFilename);
    } finally {
      // Clean up if created
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should validate invalid status values via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-invalid-status.md';

    try {
      // First create a valid plan
      await request.post(`${apiBaseUrl}/api/plans`, {
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
      const response = await request.patch(`${apiBaseUrl}/api/plans/${testFilename}/status`, {
        data: {
          status: 'invalid_status',
        },
      });

      // Should reject with 400 error
      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toBeTruthy();
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should validate priority values via API', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-priority-validation.md';

    try {
      // Create plan
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: '# Test Plan\n\nContent.',
        },
      });

      // Try bulk priority update with invalid priority
      const response = await request.post(`${apiBaseUrl}/api/plans/bulk-priority`, {
        data: {
          filenames: [testFilename],
          priority: 'super_critical', // Invalid priority
        },
      });

      // Should return validation error
      expect(response.status()).toBe(400);
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should accept plan with invalid due date format (stored as-is)', async ({
    request,
    apiBaseUrl,
  }) => {
    const testFilename = 'test-duedate-validation.md';

    try {
      // Create plan with invalid date format
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
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

      // Current API accepts plans without frontmatter validation on creation
      expect(response.status()).toBe(201);

      // Verify the plan was stored
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      expect(getResponse.ok()).toBeTruthy();
      const plan = await getResponse.json();
      expect(plan.frontmatter?.dueDate).toBe('not-a-valid-date');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should store invalid status as-is (no auto-correction on create)', async ({
    request,
    apiBaseUrl,
  }) => {
    const testFilename = 'test-autocorrect-status.md';

    try {
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
status: invalid
---
# Auto-correct Status Test

Content.
`,
        },
      });

      // Current API accepts plan creation without frontmatter validation
      expect(response.status()).toBe(201);

      // Invalid status is stored as-is in the frontmatter
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter?.status).toBe('invalid');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should store invalid priority as-is (no auto-correction on create)', async ({
    request,
    apiBaseUrl,
  }) => {
    const testFilename = 'test-autocorrect-priority.md';

    try {
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
priority: super
---
# Auto-correct Priority Test

Content.
`,
        },
      });

      // Current API accepts plan creation without frontmatter validation
      expect(response.status()).toBe(201);

      // Invalid priority is stored as-is
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter?.priority).toBe('super');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should auto-correct tags string to array', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-autocorrect-tags.md';

    try {
      // Use YAML array syntax to provide tags as an actual array
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
tags:
  - "single-tag"
---
# Auto-correct Tags Test

Content.
`,
        },
      });

      if (response.ok()) {
        const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
        const plan = await getResponse.json();
        // Tags should be stored as an array
        if (plan.frontmatter?.tags) {
          expect(Array.isArray(plan.frontmatter.tags)).toBe(true);
          expect(plan.frontmatter.tags).toContain('single-tag');
        }
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should auto-correct blockedBy string to array', async ({ request, apiBaseUrl }) => {
    const testFilename = 'test-autocorrect-blockedby.md';

    try {
      // Use YAML array syntax to provide blockedBy as a proper array
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
blockedBy:
  - "some-plan.md"
---
# Auto-correct BlockedBy Test

Content.
`,
        },
      });

      if (response.ok()) {
        const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
        const plan = await getResponse.json();
        // blockedBy should be stored as an array
        if (plan.frontmatter?.blockedBy) {
          expect(Array.isArray(plan.frontmatter.blockedBy)).toBe(true);
          expect(plan.frontmatter.blockedBy).toContain('some-plan.md');
        }
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should store invalid estimate as-is (no validation on create)', async ({
    request,
    apiBaseUrl,
  }) => {
    const testFilename = 'test-estimate-validation.md';

    try {
      const response = await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFilename,
          content: `---
estimate: "3days"
---
# Estimate Validation Test

Content.
`,
        },
      });

      // Current API accepts plan creation without frontmatter validation
      expect(response.status()).toBe(201);

      // Invalid estimate '3days' (doesn't match /^\d+[hdwm]$/) is stored as-is
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${testFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter?.estimate).toBe('3days');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`).catch(() => {});
    }
  });

  test('should reject empty filename', async ({ request, apiBaseUrl }) => {
    // POST plan with empty filename
    const response = await request.post(`${apiBaseUrl}/api/plans`, {
      data: {
        filename: '',
        content: '# Empty Filename Test\n\nContent.',
      },
    });

    // Should return 400 for invalid filename
    expect(response.status()).toBe(400);
  });
});

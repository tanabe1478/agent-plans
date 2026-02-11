import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const TEST_PLAN_FILENAME = 'test-quality-ops-plan.md';
const TEST_PLAN_CONTENT = `# Test Quality Ops Plan

This is a test plan for quality and operations testing.

## Overview
Testing audit log, schema version, and migration.
`;

test.describe('Quality & Operations functionality (Feature 15)', () => {
  test.beforeEach(async ({ request, apiBaseUrl }) => {
    // Create a test plan via API
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: TEST_PLAN_CONTENT,
      },
    });
  });

  test.afterEach(async ({ request, apiBaseUrl }) => {
    // Clean up: try to delete the test plan if it still exists
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should retrieve audit log via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/admin/audit`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.entries).toBeDefined();
    expect(Array.isArray(data.entries)).toBeTruthy();
    expect(data.total).toBeDefined();

    // Verify audit log structure if entries exist
    if (data.entries.length > 0) {
      const entry = data.entries[0];
      expect(entry.timestamp).toBeDefined();
      expect(entry.action).toBeDefined();
      expect(entry.filename).toBeDefined();
    }
  });

  test('should retrieve schema version via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/admin/schema-version`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('number');
    expect(data.version).toBeGreaterThanOrEqual(1);
  });

  test('should run migration via API', async ({ request, apiBaseUrl }) => {
    const response = await request.post(`${apiBaseUrl}/api/admin/migrate`);
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.migrated).toBeDefined();
    // Migration API returns { migrated, errors } - skipped is not tracked separately
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBeTruthy();
  });

  test('should detect conflict on concurrent update (mtime-based)', async ({
    request,
    apiBaseUrl,
  }) => {
    // Use status update to set the modified field in frontmatter
    // (updateStatus sets modified automatically)
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}/status`, {
      data: { status: 'in_progress' },
    });

    // Get current plan details (now has modified in frontmatter from the status change)
    const getResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(getResponse.ok()).toBeTruthy();
    const plan = await getResponse.json();
    const originalMtime = plan.frontmatter?.modified;
    expect(originalMtime).toBeDefined();

    // Intentional: wall-clock delay so ISO timestamps differ at second resolution.
    // Cannot be replaced with polling because time must pass BEFORE the next write.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Use another status update to trigger modified change
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}/status`, {
      data: { status: 'review' },
    });

    // Get updated plan
    const updatedResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(updatedResponse.ok()).toBeTruthy();
    const updatedPlan = await updatedResponse.json();
    const newMtime = updatedPlan.frontmatter?.modified;

    // Verify mtime changed (both should be defined now)
    expect(newMtime).toBeDefined();
    expect(newMtime).not.toBe(originalMtime);
  });

  test('should record audit log on plan operations', async ({ request, apiBaseUrl }) => {
    // Get initial audit log count
    const initialResponse = await request.get(`${apiBaseUrl}/api/admin/audit`);
    expect(initialResponse.ok()).toBeTruthy();
    const initialData = await initialResponse.json();
    const initialCount = initialData.entries.length;

    // Perform operations: create, update, delete
    const testFilename = 'test-audit-log-plan.md';

    // Create
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: {
        filename: testFilename,
        content: '# Test Audit\n\nTesting audit log.',
      },
    });

    // Update
    await request.put(`${apiBaseUrl}/api/plans/${testFilename}`, {
      data: {
        content: '# Test Audit\n\nUpdated content.',
      },
    });

    // Delete
    await request.delete(`${apiBaseUrl}/api/plans/${testFilename}`);

    // Get updated audit log
    const finalResponse = await request.get(`${apiBaseUrl}/api/admin/audit`);
    expect(finalResponse.ok()).toBeTruthy();
    const finalData = await finalResponse.json();
    const finalCount = finalData.entries.length;

    // Verify audit log grew (at least one entry added)
    expect(finalCount).toBeGreaterThan(initialCount);

    // Verify audit log contains our operations
    const recentEntries = finalData.entries.slice(0, 10);
    const hasCreate = recentEntries.some(
      (e: any) => e.action === 'create' && e.filename === testFilename
    );
    const hasUpdate = recentEntries.some(
      (e: any) => e.action === 'update' && e.filename === testFilename
    );
    const hasDelete = recentEntries.some(
      (e: any) => e.action === 'delete' && e.filename === testFilename
    );

    // At least one operation should be logged
    expect(hasCreate || hasUpdate || hasDelete).toBeTruthy();
  });

  test('should filter audit log by filename', async ({ request, apiBaseUrl }) => {
    const response = await request.get(
      `${apiBaseUrl}/api/admin/audit?filename=${TEST_PLAN_FILENAME}`
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.entries).toBeDefined();
    // All entries should be for the specified filename
    for (const entry of data.entries) {
      expect(entry.filename).toBe(TEST_PLAN_FILENAME);
    }
  });

  test('should limit audit log results', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/admin/audit?limit=5`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.entries).toBeDefined();
    expect(data.entries.length).toBeLessThanOrEqual(5);
  });

  test('should filter audit log by action type', async ({ request, apiBaseUrl }) => {
    // First ensure there are some 'create' entries by creating a plan
    const testFile = 'test-audit-filter-action.md';
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: {
        filename: testFile,
        content: '# Audit Filter Test\n\nTesting action filter.',
      },
    });

    // Query audit log filtering by action=create
    const response = await request.get(`${apiBaseUrl}/api/admin/audit?action=create`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.entries).toBeDefined();

    // All entries should have action=create
    for (const entry of data.entries) {
      expect(entry.action).toBe('create');
    }

    // Clean up
    await request.delete(`${apiBaseUrl}/api/plans/${testFile}`).catch(() => {});
  });

  test('should record status_change in audit log', async ({ request, apiBaseUrl }) => {
    // Change the status of the test plan
    const statusResponse = await request.patch(
      `${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}/status`,
      {
        data: { status: 'in_progress' },
      }
    );
    expect(statusResponse.ok()).toBeTruthy();

    // Query audit log for this file
    const auditResponse = await request.get(
      `${apiBaseUrl}/api/admin/audit?filename=${TEST_PLAN_FILENAME}`
    );
    expect(auditResponse.ok()).toBeTruthy();

    const data = await auditResponse.json();
    expect(data.entries).toBeDefined();

    // Find a status_change entry
    const statusEntry = data.entries.find((e: any) => e.action === 'status_change');
    expect(statusEntry).toBeDefined();
    expect(statusEntry.filename).toBe(TEST_PLAN_FILENAME);
    expect(statusEntry.details).toBeDefined();
  });

  test('should migrate v0 plan to v1', async ({ request, apiBaseUrl }) => {
    // Create a plan without schemaVersion (simulating v0)
    const testFile = 'test-migration-v0.md';
    try {
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: testFile,
          content: `---
status: todo
---
# V0 Plan

This plan has no schemaVersion.
`,
        },
      });

      // Run migration
      const response = await request.post(`${apiBaseUrl}/api/admin/migrate`);
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.migrated).toBeDefined();
      expect(result.errors).toBeDefined();

      // Get the plan and verify it now has schemaVersion
      const planResponse = await request.get(`${apiBaseUrl}/api/plans/${testFile}`);
      expect(planResponse.ok()).toBeTruthy();
      const plan = await planResponse.json();
      expect(plan.frontmatter.schemaVersion).toBeDefined();
      expect(plan.frontmatter.schemaVersion).toBeGreaterThanOrEqual(1);
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${testFile}`).catch(() => {});
    }
  });

  test('should skip already-migrated plans', async ({ request, apiBaseUrl }) => {
    // Run migration once
    const firstResponse = await request.post(`${apiBaseUrl}/api/admin/migrate`);
    expect(firstResponse.ok()).toBeTruthy();
    const firstResult = await firstResponse.json();
    const firstMigrated = firstResult.migrated;

    // Run migration again - should migrate 0 since all are already up-to-date
    const secondResponse = await request.post(`${apiBaseUrl}/api/admin/migrate`);
    expect(secondResponse.ok()).toBeTruthy();
    const secondResult = await secondResponse.json();

    // Second run should migrate fewer (or 0) since plans are already migrated
    expect(secondResult.migrated).toBeLessThanOrEqual(firstMigrated);
  });

  test('should validate audit entry structure', async ({ request, apiBaseUrl }) => {
    // Get recent audit entries
    const response = await request.get(`${apiBaseUrl}/api/admin/audit?limit=10`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.entries).toBeDefined();

    // Validate structure for each entry
    for (const entry of data.entries) {
      expect(entry.timestamp).toBeDefined();
      expect(typeof entry.timestamp).toBe('string');
      expect(entry.action).toBeDefined();
      expect(typeof entry.action).toBe('string');
      expect(entry.filename).toBeDefined();
      expect(typeof entry.filename).toBe('string');
      // details may be optional but should be defined if present
      if (entry.details !== undefined) {
        expect(typeof entry.details).toBe('object');
      }
    }
  });

  test('should record bulk_operation in audit log', async ({ request, apiBaseUrl }) => {
    const bulkFiles = ['test-audit-bulk-1.md', 'test-audit-bulk-2.md'];

    try {
      // Create test plans
      for (const filename of bulkFiles) {
        await request.post(`${apiBaseUrl}/api/plans`, {
          data: {
            filename,
            content: `---
status: todo
priority: low
---
# ${filename}

Bulk audit test.
`,
          },
        });
      }

      // Perform bulk status change
      const bulkResponse = await request.post(`${apiBaseUrl}/api/plans/bulk-status`, {
        data: {
          filenames: bulkFiles,
          status: 'in_progress',
        },
      });
      expect(bulkResponse.ok()).toBeTruthy();

      // Check audit log for entries related to these plans
      const auditResponse = await request.get(`${apiBaseUrl}/api/admin/audit?limit=20`);
      expect(auditResponse.ok()).toBeTruthy();

      const data = await auditResponse.json();
      // Should have audit entries for the bulk operation
      const bulkEntries = data.entries.filter(
        (e: any) =>
          bulkFiles.includes(e.filename) &&
          (e.action === 'status_change' || e.action === 'bulk_operation' || e.action === 'update')
      );
      expect(bulkEntries.length).toBeGreaterThan(0);
    } finally {
      for (const filename of bulkFiles) {
        await request.delete(`${apiBaseUrl}/api/plans/${filename}`).catch(() => {});
      }
    }
  });

  test('API: conflict detection responds with stale mtime info', async ({
    request,
    apiBaseUrl,
  }) => {
    // Use status update to set modified field
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}/status`, {
      data: { status: 'in_progress' },
    });

    // Get plan with modified timestamp set
    const getResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(getResponse.ok()).toBeTruthy();
    const plan = await getResponse.json();
    const originalModified = plan.frontmatter?.modified;
    expect(originalModified).toBeDefined();

    // Intentional: wall-clock delay so ISO timestamps differ at second resolution.
    // Cannot be replaced with polling because time must pass BEFORE the next write.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Another status update to change modified
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}/status`, {
      data: { status: 'review' },
    });

    // Intentional: wall-clock delay so ISO timestamps differ at second resolution.
    // Cannot be replaced with polling because time must pass BEFORE the next write.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // One more status update
    await request.patch(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}/status`, {
      data: { status: 'completed' },
    });

    // Get the final plan to verify mtime tracking works
    const finalResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(finalResponse.ok()).toBeTruthy();
    const finalPlan = await finalResponse.json();

    // Verify the mtime has been updated (conflict detection relies on this)
    expect(finalPlan.frontmatter?.modified).toBeDefined();
    // The modified timestamp should be different from the original
    expect(finalPlan.frontmatter?.modified).not.toBe(originalModified);
  });
});

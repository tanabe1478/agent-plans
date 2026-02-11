import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const TEST_IMPORT_FILENAME = 'test-import-plan.md';
const TEST_IMPORT_CONTENT = `---
status: todo
priority: high
tags:
  - test
  - import
---

# Test Import Plan

This is a test plan for import functionality.

## Overview
Testing markdown import.
`;

test.describe('Import/Export functionality (Feature 14)', () => {
  test.afterEach(async ({ request, apiBaseUrl }) => {
    // Clean up: try to delete imported plans
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_IMPORT_FILENAME}`).catch(() => {});
  });

  test('should export plans as JSON via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/export?format=json`);
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    const json = await response.json();
    expect(json.plans).toBeDefined();
    expect(Array.isArray(json.plans)).toBeTruthy();
    expect(json.exportedAt).toBeDefined();
  });

  test('should export plans as CSV via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/export?format=csv`);
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/csv');

    const csv = await response.text();
    expect(csv).toContain('filename');
    expect(csv).toContain('title');
    expect(csv).toContain('status');
  });

  test('should export plans as tar.gz via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/export?format=zip`);
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/gzip');

    const buffer = await response.body();
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should import markdown files via API', async ({ request, apiBaseUrl }) => {
    const response = await request.post(`${apiBaseUrl}/api/import/markdown`, {
      data: {
        files: [
          {
            filename: TEST_IMPORT_FILENAME,
            content: TEST_IMPORT_CONTENT,
          },
        ],
      },
    });
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.imported).toBeGreaterThan(0);
    expect(result.skipped).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBeTruthy();

    // Verify imported plan exists
    const planResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_IMPORT_FILENAME}`);
    expect(planResponse.ok()).toBeTruthy();
  });

  test('should create backup via API', async ({ request, apiBaseUrl }) => {
    const response = await request.post(`${apiBaseUrl}/api/backup`);
    expect(response.status()).toBe(201);

    const backup = await response.json();
    expect(backup.id).toBeDefined();
    expect(backup.filename).toBeDefined();
    expect(backup.createdAt).toBeDefined();
    expect(backup.planCount).toBeGreaterThan(0);
    expect(backup.size).toBeGreaterThan(0);
  });

  test('should retrieve backup list via API', async ({ request, apiBaseUrl }) => {
    // Create a backup first
    await request.post(`${apiBaseUrl}/api/backup`);

    // Get backup list
    const response = await request.get(`${apiBaseUrl}/api/backups`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.backups).toBeDefined();
    expect(Array.isArray(data.backups)).toBeTruthy();
    expect(data.backups.length).toBeGreaterThan(0);

    const backup = data.backups[0];
    expect(backup.id).toBeDefined();
    expect(backup.filename).toBeDefined();
    expect(backup.createdAt).toBeDefined();
    expect(backup.planCount).toBeDefined();
    expect(backup.size).toBeDefined();
  });

  test('should navigate to /backups page', async ({ page }) => {
    await page.goto('/backups');
    await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();
  });

  test('should show Export/Import menu in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Click More menu (three vertical dots)
    const moreButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-more-vertical') });
    await moreButton.click();

    // Check Export and Import options are visible
    await expect(page.getByRole('button', { name: 'Export Plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Plans' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Backups' })).toBeVisible();
  });

  test('should filter export by status', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/export?format=json&filterStatus=todo`);
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.plans).toBeDefined();
    // All exported plans should have status=todo
    for (const plan of json.plans) {
      if (plan.frontmatter?.status) {
        expect(plan.frontmatter.status).toBe('todo');
      }
    }
  });

  test('should skip duplicate files on import', async ({ request, apiBaseUrl }) => {
    // First import
    const firstResponse = await request.post(`${apiBaseUrl}/api/import/markdown`, {
      data: {
        files: [
          {
            filename: TEST_IMPORT_FILENAME,
            content: TEST_IMPORT_CONTENT,
          },
        ],
      },
    });
    expect(firstResponse.ok()).toBeTruthy();
    const firstResult = await firstResponse.json();
    expect(firstResult.imported).toBeGreaterThan(0);

    // Second import of the same file should be skipped
    const secondResponse = await request.post(`${apiBaseUrl}/api/import/markdown`, {
      data: {
        files: [
          {
            filename: TEST_IMPORT_FILENAME,
            content: TEST_IMPORT_CONTENT,
          },
        ],
      },
    });
    expect(secondResponse.ok()).toBeTruthy();
    const secondResult = await secondResponse.json();
    expect(secondResult.skipped).toBeGreaterThan(0);
  });

  test('should export individual plan as markdown via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(
      `${apiBaseUrl}/api/plans/blue-running-fox.md/export?format=md`
    );
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/markdown');

    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toContain('blue-running-fox');

    const content = await response.text();
    expect(content).toContain('Web Application Authentication System');
  });

  test('should export individual plan as HTML via API', async ({ request, apiBaseUrl }) => {
    const response = await request.get(
      `${apiBaseUrl}/api/plans/blue-running-fox.md/export?format=html`
    );
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Web Application Authentication System');
  });

  test('should return 501 for PDF export', async ({ request, apiBaseUrl }) => {
    const response = await request.get(
      `${apiBaseUrl}/api/plans/blue-running-fox.md/export?format=pdf`
    );
    expect(response.status()).toBe(501);

    const data = await response.json();
    expect(data.error).toContain('PDF');
  });

  test('should restore from backup via API', async ({ request, apiBaseUrl }) => {
    // Create a backup first
    const backupResponse = await request.post(`${apiBaseUrl}/api/backup`);
    expect(backupResponse.status()).toBe(201);
    const backup = await backupResponse.json();
    expect(backup.id).toBeDefined();

    // Restore from the backup
    const restoreResponse = await request.post(`${apiBaseUrl}/api/backup/${backup.id}/restore`);
    expect(restoreResponse.ok()).toBeTruthy();

    const result = await restoreResponse.json();
    expect(result.imported).toBeDefined();
    expect(result.skipped).toBeDefined();
    expect(result.errors).toBeDefined();
  });

  test('should filter export by tags', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/export?format=json&filterTags=backend`);
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.plans).toBeDefined();
    // All exported plans should have the 'backend' tag
    for (const plan of json.plans) {
      if (plan.frontmatter?.tags) {
        expect(plan.frontmatter.tags).toContain('backend');
      }
    }
  });

  test('should display backup page with backup list', async ({ page, request, apiBaseUrl }) => {
    // Ensure at least one backup exists
    await request.post(`${apiBaseUrl}/api/backup`);

    // Navigate to backups page
    await page.goto('/backups');
    await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();

    // Wait for backup entries to load (each entry has a "Restore" button)
    const restoreButton = page.getByRole('button', { name: /Restore/ });
    await expect(restoreButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('should create backup from UI', async ({ page }) => {
    // Navigate to backups page
    await page.goto('/backups');
    await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();

    // Click Create Backup button
    const createButton = page.getByRole('button', { name: /Create Backup/ });
    await expect(createButton).toBeVisible();

    // Click and wait for the backup API response
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/backup') && resp.request().method() === 'POST'
      ),
      createButton.click(),
    ]);

    // Verify a backup entry appeared (each entry has a Restore button)
    const restoreButton = page.getByRole('button', { name: /Restore/ });
    await expect(restoreButton.first()).toBeVisible({ timeout: 5000 });
  });
});

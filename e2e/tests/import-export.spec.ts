import { test, expect } from '@playwright/test';

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
  test.afterEach(async ({ request }) => {
    // Clean up: try to delete imported plans
    await request.delete(`http://localhost:3001/api/plans/${TEST_IMPORT_FILENAME}`).catch(() => {});
  });

  test('should export plans as JSON via API', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/export?format=json');
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    const json = await response.json();
    expect(json.plans).toBeDefined();
    expect(Array.isArray(json.plans)).toBeTruthy();
    expect(json.exportedAt).toBeDefined();
  });

  test('should export plans as CSV via API', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/export?format=csv');
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/csv');

    const csv = await response.text();
    expect(csv).toContain('filename');
    expect(csv).toContain('title');
    expect(csv).toContain('status');
  });

  test('should export plans as tar.gz via API', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/export?format=zip');
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/gzip');

    const buffer = await response.body();
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should import markdown files via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/import/markdown', {
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
    const planResponse = await request.get(`http://localhost:3001/api/plans/${TEST_IMPORT_FILENAME}`);
    expect(planResponse.ok()).toBeTruthy();
  });

  test('should create backup via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/backup');
    expect(response.status()).toBe(201);

    const backup = await response.json();
    expect(backup.id).toBeDefined();
    expect(backup.filename).toBeDefined();
    expect(backup.createdAt).toBeDefined();
    expect(backup.planCount).toBeGreaterThan(0);
    expect(backup.size).toBeGreaterThan(0);
  });

  test('should retrieve backup list via API', async ({ request }) => {
    // Create a backup first
    await request.post('http://localhost:3001/api/backup');

    // Get backup list
    const response = await request.get('http://localhost:3001/api/backups');
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
    const moreButton = page.locator('button').filter({ has: page.locator('svg.lucide-more-vertical') });
    await moreButton.click();

    // Wait for menu to appear
    await page.waitForTimeout(300);

    // Check Export and Import options are visible
    await expect(page.getByRole('button', { name: 'Export Plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Plans' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Backups' })).toBeVisible();
  });

  test('should filter export by status', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/export?format=json&filterStatus=todo');
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
});

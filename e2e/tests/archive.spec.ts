import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const TEST_PLAN_FILENAME = 'test-archive-plan.md';
const TEST_PLAN_CONTENT = `# Test Archive Plan

This is a test plan for archive functionality.

## Overview
Testing archive, restore, and permanent delete.
`;

test.describe('Archive functionality (Feature 11)', () => {
  test.beforeEach(async ({ request }) => {
    // Create a test plan via API
    await request.post('http://localhost:3001/api/plans', {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: TEST_PLAN_CONTENT,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    // Clean up: try to delete the test plan if it still exists
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
    // Also try to delete from archive
    await request.delete(`http://localhost:3001/api/archive/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should navigate to /archive page', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  });

  test('should archive plan when deleted with archive=true', async ({ request }) => {
    // Delete plan with archive query parameter
    const deleteResponse = await request.delete(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}?archive=true`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify plan is no longer in active list
    const plansResponse = await request.get('http://localhost:3001/api/plans');
    expect(plansResponse.ok()).toBeTruthy();
    const { plans } = await plansResponse.json();
    expect(plans.find((p: any) => p.filename === TEST_PLAN_FILENAME)).toBeUndefined();

    // Verify plan is in archive
    const archiveResponse = await request.get('http://localhost:3001/api/archive');
    expect(archiveResponse.ok()).toBeTruthy();
    const { archived } = await archiveResponse.json();
    const archivedPlan = archived.find((p: any) => p.filename === TEST_PLAN_FILENAME);
    expect(archivedPlan).toBeDefined();
    expect(archivedPlan.title).toContain('Test Archive Plan');
  });

  test('should retrieve archive list via API', async ({ request }) => {
    // Archive the plan first
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Get archive list
    const response = await request.get('http://localhost:3001/api/archive');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.archived).toBeDefined();
    expect(Array.isArray(data.archived)).toBeTruthy();
    expect(data.total).toBeGreaterThan(0);
  });

  test('should restore plan from archive via API', async ({ request }) => {
    // Archive the plan
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Restore from archive
    const restoreResponse = await request.post(
      `http://localhost:3001/api/archive/${TEST_PLAN_FILENAME}/restore`
    );
    expect(restoreResponse.ok()).toBeTruthy();

    // Verify plan is back in active list
    const planResponse = await request.get(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`);
    expect(planResponse.ok()).toBeTruthy();
    const plan = await planResponse.json();
    expect(plan.filename).toBe(TEST_PLAN_FILENAME);
  });

  test('should permanently delete from archive via API', async ({ request }) => {
    // Archive the plan
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Permanently delete from archive
    const deleteResponse = await request.delete(
      `http://localhost:3001/api/archive/${TEST_PLAN_FILENAME}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify plan is gone from archive
    const archiveResponse = await request.get('http://localhost:3001/api/archive');
    expect(archiveResponse.ok()).toBeTruthy();
    const { archived } = await archiveResponse.json();
    expect(archived.find((p: any) => p.filename === TEST_PLAN_FILENAME)).toBeUndefined();
  });

  test('should display archive icon link in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Look for archive link with Archive icon
    const archiveLink = page.getByRole('link', { name: 'Archive' });
    await expect(archiveLink).toBeVisible();

    // Click and verify navigation
    await archiveLink.click();
    await expect(page).toHaveURL('/archive');
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  });
});

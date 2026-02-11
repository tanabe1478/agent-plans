import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const TEST_PLAN_FILENAME = 'test-archive-plan.md';
const TEST_PLAN_CONTENT = `# Test Archive Plan

This is a test plan for archive functionality.

## Overview
Testing archive, restore, and permanent delete.
`;

test.describe('Archive functionality (Feature 11)', () => {
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
    // Also try to delete from archive
    await request.delete(`${apiBaseUrl}/api/archive/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should navigate to /archive page', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  });

  test('should archive plan when deleted with archive=true', async ({ request, apiBaseUrl }) => {
    // Delete plan with archive query parameter
    const deleteResponse = await request.delete(
      `${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify plan is no longer in active list
    const plansResponse = await request.get(`${apiBaseUrl}/api/plans`);
    expect(plansResponse.ok()).toBeTruthy();
    const { plans } = await plansResponse.json();
    expect(plans.find((p: any) => p.filename === TEST_PLAN_FILENAME)).toBeUndefined();

    // Verify plan is in archive
    const archiveResponse = await request.get(`${apiBaseUrl}/api/archive`);
    expect(archiveResponse.ok()).toBeTruthy();
    const { archived } = await archiveResponse.json();
    const archivedPlan = archived.find((p: any) => p.filename === TEST_PLAN_FILENAME);
    expect(archivedPlan).toBeDefined();
    expect(archivedPlan.title).toContain('Test Archive Plan');
  });

  test('should retrieve archive list via API', async ({ request, apiBaseUrl }) => {
    // Archive the plan first
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Get archive list
    const response = await request.get(`${apiBaseUrl}/api/archive`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.archived).toBeDefined();
    expect(Array.isArray(data.archived)).toBeTruthy();
    expect(data.total).toBeGreaterThan(0);
  });

  test('should restore plan from archive via API', async ({ request, apiBaseUrl }) => {
    // Archive the plan
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Restore from archive
    const restoreResponse = await request.post(
      `${apiBaseUrl}/api/archive/${TEST_PLAN_FILENAME}/restore`
    );
    expect(restoreResponse.ok()).toBeTruthy();

    // Verify plan is back in active list
    const planResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(planResponse.ok()).toBeTruthy();
    const plan = await planResponse.json();
    expect(plan.filename).toBe(TEST_PLAN_FILENAME);
  });

  test('should permanently delete from archive via API', async ({ request, apiBaseUrl }) => {
    // Archive the plan
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Permanently delete from archive
    const deleteResponse = await request.delete(`${apiBaseUrl}/api/archive/${TEST_PLAN_FILENAME}`);
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify plan is gone from archive
    const archiveResponse = await request.get(`${apiBaseUrl}/api/archive`);
    expect(archiveResponse.ok()).toBeTruthy();
    const { archived } = await archiveResponse.json();
    expect(archived.find((p: any) => p.filename === TEST_PLAN_FILENAME)).toBeUndefined();
  });

  test('should display archive icon link in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Look for archive link with Archive icon (exact match to avoid matching plan card links)
    const archiveLink = page.getByRole('link', { name: 'Archive', exact: true });
    await expect(archiveLink).toBeVisible();

    // Click and verify navigation
    await archiveLink.click();
    await expect(page).toHaveURL('/archive');
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  });

  test('should display archived plans on /archive page', async ({ page, request, apiBaseUrl }) => {
    // Archive the plan first
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Navigate to archive page
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();

    // Verify the archived plan is listed
    await expect(page.getByText('Test Archive Plan')).toBeVisible();
    await expect(page.getByText(TEST_PLAN_FILENAME)).toBeVisible();
  });

  test('should show restore button on archive page', async ({ page, request, apiBaseUrl }) => {
    // Archive the plan first
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Navigate to archive page
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();

    // Find the card containing our plan and verify its restore button
    const planCard = page.locator('.rounded-lg.border').filter({ hasText: TEST_PLAN_FILENAME });
    const restoreButton = planCard.getByRole('button', { name: /Restore/ });
    await expect(restoreButton).toBeVisible();
  });

  test('should restore plan from archive page UI', async ({ page, request, apiBaseUrl }) => {
    // Archive the plan first
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Navigate to archive page
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
    await expect(page.getByText(TEST_PLAN_FILENAME)).toBeVisible();

    // Click restore button within the specific plan card
    const planCard = page.locator('.rounded-lg.border').filter({ hasText: TEST_PLAN_FILENAME });
    const restoreButton = planCard.getByRole('button', { name: /Restore/ });
    await restoreButton.click();

    // Wait for the plan to disappear from archive
    await expect(page.getByText(TEST_PLAN_FILENAME)).not.toBeVisible({ timeout: 5000 });

    // Verify plan is back in active list via API
    const planResponse = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(planResponse.ok()).toBeTruthy();
  });

  test('should permanently delete from archive page UI', async ({ page, request, apiBaseUrl }) => {
    // Archive the plan first
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Navigate to archive page
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
    await expect(page.getByText(TEST_PLAN_FILENAME)).toBeVisible();

    // Click delete button within the specific plan card
    const planCard = page.locator('.rounded-lg.border').filter({ hasText: TEST_PLAN_FILENAME });
    const deleteButton = planCard.getByRole('button', { name: /Delete/ });
    await deleteButton.click();

    // Confirm in the dialog by typing the filename
    const confirmInput = page.getByPlaceholder(TEST_PLAN_FILENAME);
    await confirmInput.fill(TEST_PLAN_FILENAME);

    // Click confirm button
    const confirmButton = page.getByRole('button', { name: /Permanently delete/ });
    await confirmButton.click();

    // Wait for the plan card to disappear from archive list
    const planCardAfterDelete = page
      .locator('.rounded-lg.border')
      .filter({ hasText: TEST_PLAN_FILENAME });
    await expect(planCardAfterDelete).not.toBeVisible({ timeout: 5000 });

    // Verify plan is gone from archive via API
    const archiveResponse = await request.get(`${apiBaseUrl}/api/archive`);
    const { archived } = await archiveResponse.json();
    expect(archived.find((p: any) => p.filename === TEST_PLAN_FILENAME)).toBeUndefined();
  });

  test('should cleanup expired archives via API', async ({ request, apiBaseUrl }) => {
    const response = await request.post(`${apiBaseUrl}/api/archive/cleanup`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.deleted).toBeDefined();
    expect(typeof data.deleted).toBe('number');
  });

  test('should include metadata in archive (archivedAt, expiresAt, title, preview)', async ({
    request,
    apiBaseUrl,
  }) => {
    // Archive the plan
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}?archive=true`);

    // Get archive list
    const response = await request.get(`${apiBaseUrl}/api/archive`);
    expect(response.ok()).toBeTruthy();
    const { archived } = await response.json();

    const archivedPlan = archived.find((p: any) => p.filename === TEST_PLAN_FILENAME);
    expect(archivedPlan).toBeDefined();
    expect(archivedPlan.archivedAt).toBeDefined();
    expect(archivedPlan.expiresAt).toBeDefined();
    expect(archivedPlan.title).toBeDefined();
    expect(archivedPlan.title).toContain('Test Archive Plan');
    expect(archivedPlan.preview).toBeDefined();
  });

  test('default delete should archive (soft delete)', async ({ request, apiBaseUrl }) => {
    // Delete without permanent flag (default behavior should archive)
    const deleteResponse = await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify plan is no longer in active list
    const plansResponse = await request.get(`${apiBaseUrl}/api/plans`);
    const { plans } = await plansResponse.json();
    expect(plans.find((p: any) => p.filename === TEST_PLAN_FILENAME)).toBeUndefined();

    // Verify plan is in archive
    const archiveResponse = await request.get(`${apiBaseUrl}/api/archive`);
    const { archived } = await archiveResponse.json();
    const archivedPlan = archived.find((p: any) => p.filename === TEST_PLAN_FILENAME);
    expect(archivedPlan).toBeDefined();
  });
});

import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

// Test file that will be created and deleted
const TEST_PLAN_FILENAME = 'test-delete-plan.md';
const TEST_PLAN_CONTENT = `# Test Plan for Delete

This is a test plan that will be deleted.

## Overview
Testing the delete functionality.
`;

/**
 * Helper: Open the PlanActions "more" menu by finding the MoreVertical button
 * next to the VSCode/Terminal buttons (not the Header's "More actions" button).
 */
async function openPlanActionsMenu(page: import('@playwright/test').Page) {
  // The PlanActions area contains VSCode, Terminal, and Open in default app buttons.
  // The MoreVertical button is inside that same area. We locate by finding the container
  // that has the VSCode button, then click the icon-only button (with a small SVG icon).
  const actionsBar = page.locator('div.flex.items-center.gap-2').filter({
    has: page.getByRole('button', { name: 'VSCode' }),
  });
  // The MoreVertical button is a ghost/icon button with no text label inside actionsBar
  const moreButton = actionsBar.locator('div.relative > button').first();
  await moreButton.click();
}

/**
 * Helper: Click the Delete option from the already-opened PlanActions menu.
 */
async function clickDeleteMenuItem(page: import('@playwright/test').Page) {
  const deleteMenuItem = page.getByRole('button', { name: 'Delete', exact: true });
  await expect(deleteMenuItem).toBeVisible();
  await deleteMenuItem.click();
}

test.describe('Delete functionality (from detail page)', () => {
  test.beforeEach(async ({ request }) => {
    // Create a test plan via API before each test
    await request.post(`${API_BASE_URL}/api/plans`, {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: TEST_PLAN_CONTENT,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    // Clean up: try to delete the test plan if it still exists
    await request.delete(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
    // Also try to delete from archive
    await request.delete(`${API_BASE_URL}/api/archive/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should show delete confirmation dialog on detail page', async ({ page }) => {
    // Navigate to the test plan detail page
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Test Plan for Delete' }).first()).toBeVisible();

    // Click the more actions menu in PlanActions
    await openPlanActionsMenu(page);

    // Wait for menu to appear and click delete option
    await clickDeleteMenuItem(page);

    // Verify confirmation dialog appears
    await expect(page.getByRole('heading', { name: 'Delete Plan' })).toBeVisible();
    await expect(page.getByText(TEST_PLAN_FILENAME).first()).toBeVisible();
  });

  test('should delete plan when confirmed and redirect to home', async ({ page, request }) => {
    // Navigate to the test plan detail page
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Test Plan for Delete' }).first()).toBeVisible();

    // Click the more actions menu
    await openPlanActionsMenu(page);

    // Click delete option
    await clickDeleteMenuItem(page);

    // Wait for dialog to appear then confirm deletion
    const dialogHeading = page.getByRole('heading', { name: 'Delete Plan' });
    await expect(dialogHeading).toBeVisible();

    // Click "Permanently delete" to enter permanent delete mode
    await page.getByRole('button', { name: 'Permanently delete' }).click();

    // Type filename to confirm
    const confirmInput = page.getByPlaceholder(TEST_PLAN_FILENAME);
    await confirmInput.fill(TEST_PLAN_FILENAME);

    // Click the final "Permanently delete" button and wait for API response
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/plans/') && resp.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Permanently delete' }).click(),
    ]);

    // Wait for dialog to close
    await expect(dialogHeading).not.toBeVisible({ timeout: 5000 });

    // Wait for redirect to home page
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Verify via API that plan no longer exists (should return 404)
    const response = await request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(response.status()).toBe(404);
  });

  test('should cancel delete when clicking cancel', async ({ page, request }) => {
    // Navigate to the test plan detail page
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Test Plan for Delete' }).first()).toBeVisible();

    // Click the more actions menu
    await openPlanActionsMenu(page);

    // Click delete option
    await clickDeleteMenuItem(page);

    // Cancel deletion
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Should still be on the same page
    await expect(page).toHaveURL(`/plan/${TEST_PLAN_FILENAME}`);

    // Verify via API that plan still exists
    const response = await request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Bulk delete functionality', () => {
  const BULK_TEST_FILES = ['bulk-delete-test-1.md', 'bulk-delete-test-2.md'];

  test.beforeEach(async ({ request }) => {
    // Create test plans
    for (const filename of BULK_TEST_FILES) {
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename,
          content: `# ${filename}\n\nTest content for bulk delete.`,
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

  test('should bulk delete selected plans', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Enter selection mode
    await page.getByRole('button', { name: '選択' }).click();

    // Wait for checkboxes to appear
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 3000 });

    // Select both test plans by clicking their checkboxes
    for (const filename of BULK_TEST_FILES) {
      const planCard = page.locator('div.rounded-lg.border-2').filter({ hasText: filename });
      await expect(planCard).toBeVisible();
      const checkbox = planCard.locator('input[type="checkbox"]');
      await checkbox.click();
    }

    // Click bulk delete button (button with text "件を削除")
    const deleteButton = page.getByRole('button').filter({ hasText: '件を削除' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Verify confirmation dialog
    const bulkDialogHeading = page.getByRole('heading', { name: 'プランを一括削除' });
    await expect(bulkDialogHeading).toBeVisible();
    await expect(page.getByText(/2件のプランを完全に削除しますか/)).toBeVisible();

    // Find the confirm button in the dialog (text is '削除')
    const bulkConfirmButton = page.getByRole('button', { name: '削除', exact: true });

    // Click and wait for the bulk delete API response (uses POST /plans/bulk-delete)
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/plans/bulk-delete') && resp.request().method() === 'POST'),
      bulkConfirmButton.click(),
    ]);

    // Wait for UI to update after deletion
    await expect(bulkDialogHeading).not.toBeVisible({ timeout: 5000 });

    // Verify via API that plans no longer exist
    for (const filename of BULK_TEST_FILES) {
      const response = await request.get(`${API_BASE_URL}/api/plans/${filename}`);
      expect(response.status()).toBe(404);
    }
  });
});

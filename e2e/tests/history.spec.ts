import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const TEST_PLAN_FILENAME = 'test-history-plan.md';
const INITIAL_CONTENT = `# Test History Plan

This is the initial version of the plan.

## Overview
Testing history and rollback functionality.
`;

const UPDATED_CONTENT = `# Test History Plan

This is the updated version of the plan.

## Overview
Testing history and rollback functionality with changes.

## New Section
This section was added in the update.
`;

test.describe('History & Rollback (Feature 10)', () => {
  test.beforeEach(async ({ request }) => {
    // Create a test plan
    await request.post(`${API_BASE_URL}/api/plans`, {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: INITIAL_CONTENT,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    // Clean up: delete the test plan
    await request.delete(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('API: should save version history when plan is updated', async ({ request }) => {
    // Update the plan
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );

    expect(historyResponse.ok()).toBeTruthy();
    const historyData = await historyResponse.json();

    expect(historyData.versions).toBeDefined();
    expect(Array.isArray(historyData.versions)).toBe(true);
    expect(historyData.versions.length).toBeGreaterThan(0);

    // Each version should have required fields
    const version = historyData.versions[0];
    expect(version.version).toBeDefined();
    expect(version.filename).toBe(TEST_PLAN_FILENAME);
    expect(version.createdAt).toBeDefined();
    expect(version.size).toBeGreaterThan(0);
  });

  test('API: should retrieve version history list', async ({ request }) => {
    // Update plan twice to create multiple versions
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT + '\n\n## Another Update\nMore changes.' },
    });

    // Get history
    const response = await request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.versions).toBeDefined();
    expect(data.versions.length).toBeGreaterThan(0);

    // Versions should be sorted newest first
    const timestamps = data.versions.map((v: any) => new Date(v.createdAt).getTime());
    const isSorted = timestamps.every((t: number, i: number) => i === 0 || timestamps[i - 1] >= t);
    expect(isSorted).toBe(true);
  });

  test('API: should get content of a specific version', async ({ request }) => {
    // Update the plan to create a version
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history to find a version
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    // After updating, there must be at least one version
    expect(historyData.versions.length).toBeGreaterThan(0);

    const version = historyData.versions[0].version;

    // Get the specific version content
    const versionResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history/${encodeURIComponent(version)}`
    );

    expect(versionResponse.ok()).toBeTruthy();
    const versionData = await versionResponse.json();

    expect(versionData.content).toBeDefined();
    expect(typeof versionData.content).toBe('string');
    expect(versionData.version).toBe(version);
    expect(versionData.filename).toBe(TEST_PLAN_FILENAME);
  });

  test('API: should compute diff between two versions', async ({ request }) => {
    // Update the plan to create a version
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    // After updating, there must be at least one version
    expect(historyData.versions.length).toBeGreaterThan(0);

    const version = historyData.versions[0].version;

    // Get diff between version and current
    const diffResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/diff?from=${encodeURIComponent(version)}`
    );

    expect(diffResponse.ok()).toBeTruthy();
    const diffData = await diffResponse.json();

    expect(diffData.lines).toBeDefined();
    expect(Array.isArray(diffData.lines)).toBe(true);
    expect(diffData.stats).toBeDefined();
    expect(diffData.stats.added).toBeGreaterThanOrEqual(0);
    expect(diffData.stats.removed).toBeGreaterThanOrEqual(0);
    expect(diffData.stats.unchanged).toBeGreaterThanOrEqual(0);
  });

  test('API: should rollback to a specific version', async ({ request }) => {
    // Update the plan to create a version
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    // After updating, there must be at least one version
    expect(historyData.versions.length).toBeGreaterThan(0);

    const version = historyData.versions[0].version;

    // Rollback to that version
    const rollbackResponse = await request.post(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/rollback`,
      {
        data: { version },
      }
    );

    expect(rollbackResponse.ok()).toBeTruthy();
    const rollbackData = await rollbackResponse.json();
    expect(rollbackData.success).toBe(true);

    // Verify the current content matches the rolled-back version
    const currentResponse = await request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`);
    const currentData = await currentResponse.json();

    // Get the version content
    const versionResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history/${encodeURIComponent(version)}`
    );
    const versionData = await versionResponse.json();

    expect(currentData.content).toBe(versionData.content);
  });

  test('should display history tab on plan detail page', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Verify history tab exists
    await expect(page.getByRole('button', { name: '履歴' })).toBeVisible();
  });

  test('should show history panel when clicking history tab', async ({ page }) => {
    // Update plan to create a version
    await page.request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    // Wait for history panel content: either rollback icons or "no history" message
    const rollbackIcon = page.locator('svg.lucide-rotate-ccw').first();
    const noHistoryMessage = page.getByText('履歴がありません');

    // Wait for either to appear
    await expect(rollbackIcon.or(noHistoryMessage)).toBeVisible({ timeout: 5000 });

    // Verify at least one is present
    const hasVersions = (await rollbackIcon.count()) > 0;
    const hasNoHistory = await noHistoryMessage.isVisible();
    expect(hasVersions || hasNoHistory).toBe(true);
  });

  test('should display version items in history panel', async ({ page }) => {
    // Update plan multiple times to create versions
    await page.request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await page.request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT + '\n\n## Update 2\nMore changes.' },
    });

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    // Wait for rollback buttons to appear (indicates version items loaded)
    const rollbackButtons = page.locator('button').filter({ has: page.locator('svg.lucide-rotate-ccw') });
    await expect(rollbackButtons.first()).toBeVisible({ timeout: 5000 });

    const count = await rollbackButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show rollback confirmation dialog when clicking rollback button', async ({ page }) => {
    // Update plan to create a version
    await page.request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    // Wait for rollback buttons to load
    await expect(page.locator('svg.lucide-rotate-ccw').first()).toBeVisible({ timeout: 5000 });

    // Click first rollback button
    const rollbackButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-rotate-ccw') })
      .first();
    await rollbackButton.click();

    // Verify confirmation dialog appears (the dialog is an orange-bordered div)
    const confirmDialog = page.locator('.border-orange-300, .border-orange-700');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await expect(confirmDialog.getByText('このバージョンにロールバックしますか')).toBeVisible();

    // The dialog has "ロールバック" and "キャンセル" buttons
    await expect(confirmDialog.locator('button').filter({ hasText: 'ロールバック' }).first()).toBeVisible();
    await expect(confirmDialog.locator('button').filter({ hasText: 'キャンセル' })).toBeVisible();
  });

  test('API: should auto-save history on status change', async ({ request }) => {
    // First do a GET to populate the conflict cache
    await request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`);

    // Record time before status change
    const beforeChange = Date.now();

    // Change status (todo -> in_progress)
    const statusResponse = await request.patch(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/status`, {
      data: { status: 'in_progress' },
    });
    expect(statusResponse.ok()).toBeTruthy();

    // Wait briefly for file operations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check that the latest history version was created after our status change
    const afterHistoryResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const afterData = await afterHistoryResponse.json();

    expect(afterData.versions.length).toBeGreaterThan(0);

    // The latest version should have been created recently (after our status change)
    const latestVersion = afterData.versions[0];
    const latestCreatedAt = new Date(latestVersion.createdAt).getTime();
    expect(latestCreatedAt).toBeGreaterThanOrEqual(beforeChange - 1000);

    // The latest version should have a summary
    expect(latestVersion.summary).toBeDefined();
    expect(typeof latestVersion.summary).toBe('string');
  });

  test('API: rollback should create "Before rollback" version', async ({ request }) => {
    // Update the plan to create a version
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    expect(historyData.versions.length).toBeGreaterThan(0);

    const version = historyData.versions[0].version;

    // Record time before rollback
    const beforeRollback = Date.now();

    // Rollback
    await request.post(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/rollback`, {
      data: { version },
    });

    // Check history for a version created after our rollback (the "Before rollback" save)
    const afterRollbackHistory = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const afterData = await afterRollbackHistory.json();

    // The latest version should have been created recently (after our rollback)
    const latestVersion = afterData.versions[0];
    const latestCreatedAt = new Date(latestVersion.createdAt).getTime();
    expect(latestCreatedAt).toBeGreaterThanOrEqual(beforeRollback - 1000);
  });

  test('should execute rollback via UI and verify content', async ({ page }) => {
    // GET the plan first to refresh the conflict detection cache
    await page.request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`);

    // Update plan to create a version
    const updateResponse = await page.request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });
    expect(updateResponse.ok()).toBeTruthy();

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Verify updated content is shown (the plan page renders markdown including "updated version")
    await expect(page.getByText('updated version').first()).toBeVisible({ timeout: 5000 });

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    // Wait for rollback buttons to load
    const rollbackButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-rotate-ccw') })
      .first();
    await expect(rollbackButton).toBeVisible({ timeout: 5000 });

    await rollbackButton.click();

    // Confirm rollback in the dialog (scoped to the orange confirmation dialog)
    const confirmDialog = page.locator('.border-orange-300, .border-orange-700');
    await expect(confirmDialog.getByText('このバージョンにロールバックしますか')).toBeVisible();

    // Click the rollback confirm button (inside the dialog, not the icon button)
    const confirmButton = confirmDialog.locator('button').filter({ hasText: 'ロールバック' }).first();
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/rollback') && resp.request().method() === 'POST'),
      confirmButton.click(),
    ]);

    // Switch back to content tab to see the rolled-back content
    await page.getByRole('button', { name: '内容' }).click();

    // Verify the content has been rolled back to the initial version
    await expect(page.getByText('initial version').first()).toBeVisible({ timeout: 10000 });
  });

  test('API: should show diff with correct line types', async ({ request }) => {
    // Update the plan to create a version
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    expect(historyData.versions.length).toBeGreaterThan(0);

    const version = historyData.versions[0].version;

    // Get diff between version and current
    const diffResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/diff?from=${encodeURIComponent(version)}`
    );

    expect(diffResponse.ok()).toBeTruthy();
    const diffData = await diffResponse.json();

    expect(diffData.lines).toBeDefined();
    expect(Array.isArray(diffData.lines)).toBe(true);

    // Each line should have a type property of 'added', 'removed', or 'unchanged'
    for (const line of diffData.lines) {
      expect(line.type).toBeDefined();
      expect(['added', 'removed', 'unchanged']).toContain(line.type);
      expect(line.content).toBeDefined();
      expect(typeof line.content).toBe('string');
      expect(line.lineNumber).toBeDefined();
      expect(typeof line.lineNumber).toBe('number');
    }
  });

  test('API: diff should include stats (added/removed/unchanged counts)', async ({ request }) => {
    // Update the plan to create a version
    await request.put(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    expect(historyData.versions.length).toBeGreaterThan(0);

    const version = historyData.versions[0].version;

    // Get diff
    const diffResponse = await request.get(
      `${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}/diff?from=${encodeURIComponent(version)}`
    );

    expect(diffResponse.ok()).toBeTruthy();
    const diffData = await diffResponse.json();

    // Verify stats object exists and has required fields
    expect(diffData.stats).toBeDefined();
    expect(typeof diffData.stats.added).toBe('number');
    expect(typeof diffData.stats.removed).toBe('number');
    expect(typeof diffData.stats.unchanged).toBe('number');

    // Stats should be non-negative
    expect(diffData.stats.added).toBeGreaterThanOrEqual(0);
    expect(diffData.stats.removed).toBeGreaterThanOrEqual(0);
    expect(diffData.stats.unchanged).toBeGreaterThanOrEqual(0);

    // Verify stats match actual line counts
    const addedCount = diffData.lines.filter((l: any) => l.type === 'added').length;
    const removedCount = diffData.lines.filter((l: any) => l.type === 'removed').length;
    const unchangedCount = diffData.lines.filter((l: any) => l.type === 'unchanged').length;

    expect(diffData.stats.added).toBe(addedCount);
    expect(diffData.stats.removed).toBe(removedCount);
    expect(diffData.stats.unchanged).toBe(unchangedCount);
  });
});

import { test, expect } from '@playwright/test';

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
    await request.post('http://localhost:3001/api/plans', {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: INITIAL_CONTENT,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    // Clean up: delete the test plan
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('API: should save version history when plan is updated', async ({ request }) => {
    // Update the plan
    await request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history`
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
    await request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT + '\n\n## Another Update\nMore changes.' },
    });

    // Get history
    const response = await request.get(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history`);

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
    await request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history to find a version
    const historyResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    if (historyData.versions.length === 0) {
      // Skip if no versions
      return;
    }

    const version = historyData.versions[0].version;

    // Get the specific version content
    const versionResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history/${encodeURIComponent(version)}`
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
    await request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    if (historyData.versions.length === 0) {
      // Skip if no versions
      return;
    }

    const version = historyData.versions[0].version;

    // Get diff between version and current
    const diffResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/diff?from=${encodeURIComponent(version)}`
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
    await request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    // Get history
    const historyResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history`
    );
    const historyData = await historyResponse.json();

    if (historyData.versions.length === 0) {
      // Skip if no versions
      return;
    }

    const version = historyData.versions[0].version;

    // Rollback to that version
    const rollbackResponse = await request.post(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/rollback`,
      {
        data: { version },
      }
    );

    expect(rollbackResponse.ok()).toBeTruthy();
    const rollbackData = await rollbackResponse.json();
    expect(rollbackData.success).toBe(true);

    // Verify the current content matches the rolled-back version
    const currentResponse = await request.get(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`);
    const currentData = await currentResponse.json();

    // Get the version content
    const versionResponse = await request.get(
      `http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}/history/${encodeURIComponent(version)}`
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
    await page.request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    // Wait for history panel to load
    await page.waitForTimeout(1000);

    // Verify history panel is displayed
    const noHistoryMessage = await page.getByText('履歴がありません').isVisible();
    const hasVersions = (await page.locator('svg.lucide-rotate-ccw').count()) > 0;

    // Should either have versions or "no history" message
    expect(hasVersions || noHistoryMessage).toBe(true);
  });

  test('should display version items in history panel', async ({ page }) => {
    // Update plan multiple times to create versions
    await page.request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await page.request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT + '\n\n## Update 2\nMore changes.' },
    });

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    await page.waitForTimeout(1000);

    // Check for rollback buttons (indicates version items are present)
    const rollbackButtons = page.locator('button').filter({ has: page.locator('svg.lucide-rotate-ccw') });
    const count = await rollbackButtons.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should show rollback confirmation dialog when clicking rollback button', async ({ page }) => {
    // Update plan to create a version
    await page.request.put(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`, {
      data: { content: UPDATED_CONTENT },
    });

    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);

    // Click history tab
    await page.getByRole('button', { name: '履歴' }).click();

    await page.waitForTimeout(1000);

    // Click first rollback button
    const rollbackButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-rotate-ccw') })
      .first();
    await rollbackButton.click();

    // Verify confirmation dialog appears
    await expect(page.getByText('このバージョンにロールバックしますか')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ロールバック' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  });
});

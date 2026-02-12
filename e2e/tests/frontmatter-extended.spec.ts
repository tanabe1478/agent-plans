import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });
const TEST_PLAN_FILENAME = 'test-frontmatter-plan.md';

test.describe('Front Matter Extended Fields (Feature 1)', () => {
  test.beforeEach(async ({ request, apiBaseUrl }) => {
    // Create a test plan with extended frontmatter fields
    await request.post(`${apiBaseUrl}/api/plans`, {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: `---
created: "2026-01-15T10:00:00Z"
modified: "2026-01-20T12:00:00Z"
project_path: "/home/user/projects/test-project"
session_id: "test-session-001"
status: todo
dueDate: "2026-02-10T00:00:00Z"
estimate: "3d"
schemaVersion: 1
---
# Test Plan with Extended Frontmatter

## Overview
This plan tests extended frontmatter fields.

## Tasks
- Test dueDate display
- Test estimate display
`,
      },
    });
  });

  test.afterEach(async ({ request, apiBaseUrl }) => {
    // Clean up
    await request.delete(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should display detail page with extended frontmatter plan', async ({
    page,
    request,
    apiBaseUrl,
  }) => {
    // Verify detail page renders
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(
      page.getByRole('heading', { name: 'Test Plan with Extended Frontmatter' }).first()
    ).toBeVisible();

    // Verify extended frontmatter fields exist via API
    const response = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(response.ok()).toBeTruthy();
    const plan = await response.json();
    expect(plan.frontmatter?.estimate).toBe('3d');
    expect(plan.frontmatter?.dueDate).toBeDefined();
  });

  test('should include new frontmatter fields in API response', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(response.ok()).toBeTruthy();

    const plan = await response.json();

    // Verify frontmatter fields are present
    expect(plan.frontmatter).toBeDefined();
    expect(plan.frontmatter.dueDate).toBe('2026-02-10T00:00:00Z');
    expect(plan.frontmatter.estimate).toBe('3d');
  });

  test('should create plan with new frontmatter fields and save correctly', async ({
    request,
    apiBaseUrl,
  }) => {
    const newFilename = 'test-new-frontmatter.md';

    try {
      // Create plan with new fields
      const createResponse = await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: newFilename,
          content: `---
status: in_progress
dueDate: "2026-02-15T00:00:00Z"
estimate: "5d"
blockedBy:
  - "some-plan.md"
---
# New Plan with Fields

Content here.
`,
        },
      });
      expect(createResponse.status()).toBe(201);

      // Verify by reading back
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${newFilename}`);
      expect(getResponse.ok()).toBeTruthy();

      const plan = await getResponse.json();
      expect(plan.frontmatter.dueDate).toBe('2026-02-15T00:00:00Z');
      expect(plan.frontmatter.estimate).toBe('5d');
      expect(plan.frontmatter.blockedBy).toEqual(['some-plan.md']);
    } finally {
      // Clean up
      await request.delete(`${apiBaseUrl}/api/plans/${newFilename}`).catch(() => {});
    }
  });

  test('should display due date on plan card in list view', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Find the test plan card which has dueDate set (PlanCard uses border-2 class)
    const planCard = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: TEST_PLAN_FILENAME });
    await expect(planCard).toBeVisible();

    // Due date should be displayed somewhere on the card (formatted as relative Japanese text)
    // dueDate is 2026-02-10, so it should show something like "4日後" or "日超過" etc.
    const dueDateText = planCard.getByText(/日後|日超過|今日|明日|週間後|ヶ月後/);
    await expect(dueDateText).toBeVisible();
  });

  test('should update frontmatter fields via API (dueDate, estimate, blockedBy)', async ({
    request,
    apiBaseUrl,
  }) => {
    const updateFilename = 'test-update-frontmatter-fields.md';

    try {
      // Create plan with initial fields
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: updateFilename,
          content: `---
status: todo
dueDate: "2026-03-01T00:00:00Z"
estimate: "1d"
---
# Update Fields Test

Content.
`,
        },
      });

      // GET the plan first to populate conflict detection cache
      await request.get(`${apiBaseUrl}/api/plans/${updateFilename}`);

      // Update content with new frontmatter
      const updateResponse = await request.put(`${apiBaseUrl}/api/plans/${updateFilename}`, {
        data: {
          content: `---
status: todo
dueDate: "2026-04-01T00:00:00Z"
estimate: "3d"
blockedBy:
  - "dep-plan.md"
---
# Update Fields Test

Updated content.
`,
        },
      });
      expect(updateResponse.ok()).toBeTruthy();

      // Verify fields were updated
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${updateFilename}`);
      const plan = await getResponse.json();
      expect(plan.frontmatter.dueDate).toBe('2026-04-01T00:00:00Z');
      expect(plan.frontmatter.estimate).toBe('3d');
      expect(plan.frontmatter.blockedBy).toEqual(['dep-plan.md']);
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${updateFilename}`).catch(() => {});
    }
  });

  test('should include blockedBy field in API response', async ({ request, apiBaseUrl }) => {
    const blockedFilename = 'test-blocked-plan.md';

    try {
      // Create plan with blockedBy field
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: blockedFilename,
          content: `---
status: todo
blockedBy:
  - "blue-running-fox.md"
  - "some-other-plan.md"
---
# Blocked Plan

This plan is blocked.
`,
        },
      });

      // GET the plan and verify blockedBy
      const getResponse = await request.get(`${apiBaseUrl}/api/plans/${blockedFilename}`);
      expect(getResponse.ok()).toBeTruthy();

      const plan = await getResponse.json();
      expect(plan.frontmatter.blockedBy).toBeDefined();
      expect(plan.frontmatter.blockedBy).toEqual(['blue-running-fox.md', 'some-other-plan.md']);
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${blockedFilename}`).catch(() => {});
    }
  });

  test('should preserve existing frontmatter when updating content', async ({
    request,
    apiBaseUrl,
  }) => {
    const preserveFilename = 'test-preserve-frontmatter.md';

    try {
      // Create plan with rich frontmatter
      await request.post(`${apiBaseUrl}/api/plans`, {
        data: {
          filename: preserveFilename,
          content: `---
status: in_progress
estimate: "2d"
blockedBy:
  - "important.md"
---
# Preserve Frontmatter Test

Original content.
`,
        },
      });

      // Verify initial frontmatter
      const initialResponse = await request.get(`${apiBaseUrl}/api/plans/${preserveFilename}`);
      const initialPlan = await initialResponse.json();
      expect(initialPlan.frontmatter.estimate).toBe('2d');
      expect(initialPlan.frontmatter.blockedBy).toEqual(['important.md']);

      // Update content while keeping the same frontmatter
      await request.put(`${apiBaseUrl}/api/plans/${preserveFilename}`, {
        data: {
          content: `---
status: in_progress
estimate: "2d"
blockedBy:
  - "important.md"
---
# Preserve Frontmatter Test

Updated content here.
`,
        },
      });

      // Verify frontmatter is preserved
      const updatedResponse = await request.get(`${apiBaseUrl}/api/plans/${preserveFilename}`);
      const updatedPlan = await updatedResponse.json();
      expect(updatedPlan.frontmatter.status).toBe('in_progress');
      expect(updatedPlan.frontmatter.estimate).toBe('2d');
      expect(updatedPlan.frontmatter.blockedBy).toEqual(['important.md']);
      // Content should be updated
      expect(updatedPlan.content).toContain('Updated content here.');
    } finally {
      await request.delete(`${apiBaseUrl}/api/plans/${preserveFilename}`).catch(() => {});
    }
  });
});

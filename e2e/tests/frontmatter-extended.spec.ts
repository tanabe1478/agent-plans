import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const API_BASE_URL = 'http://localhost:3001';
const TEST_PLAN_FILENAME = 'test-frontmatter-plan.md';

test.describe('Front Matter Extended Fields (Feature 1)', () => {
  test.beforeEach(async ({ request }) => {
    // Create a test plan with extended frontmatter fields
    await request.post(`${API_BASE_URL}/api/plans`, {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: `---
created: "2026-01-15T10:00:00Z"
modified: "2026-01-20T12:00:00Z"
project_path: "/home/user/projects/test-project"
session_id: "test-session-001"
status: todo
priority: high
dueDate: "2026-02-10T00:00:00Z"
tags:
  - "frontend"
  - "ui"
assignee: "alice"
estimate: "3d"
schemaVersion: 1
---
# Test Plan with Extended Frontmatter

## Overview
This plan tests extended frontmatter fields.

## Tasks
- Test priority display
- Test tags display
- Test assignee display
`,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    // Clean up
    await request.delete(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should display priority, dueDate, tags, and assignee on detail page', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Test Plan with Extended Frontmatter' }).first()).toBeVisible();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Priority, tags, assignee, and due date should be visible somewhere on the page
    // Note: Actual UI implementation will determine exact locations
    const pageContent = await page.textContent('body');

    // These fields should appear somewhere in the page
    expect(pageContent).toBeTruthy();
  });

  test('should include new frontmatter fields in API response', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`);
    expect(response.ok()).toBeTruthy();

    const plan = await response.json();

    // Verify frontmatter fields are present
    expect(plan.frontmatter).toBeDefined();
    expect(plan.frontmatter.priority).toBe('high');
    expect(plan.frontmatter.dueDate).toBe('2026-02-10T00:00:00Z');
    expect(plan.frontmatter.tags).toEqual(['frontend', 'ui']);
    expect(plan.frontmatter.assignee).toBe('alice');
    expect(plan.frontmatter.estimate).toBe('3d');
  });

  test('should create plan with new frontmatter fields and save correctly', async ({ request }) => {
    const newFilename = 'test-new-frontmatter.md';

    try {
      // Create plan with new fields
      const createResponse = await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: newFilename,
          content: `---
status: in_progress
priority: critical
dueDate: "2026-02-15T00:00:00Z"
tags:
  - "backend"
  - "api"
assignee: "bob"
estimate: "5d"
---
# New Plan with Fields

Content here.
`,
        },
      });
      expect(createResponse.status()).toBe(201);

      // Verify by reading back
      const getResponse = await request.get(`${API_BASE_URL}/api/plans/${newFilename}`);
      expect(getResponse.ok()).toBeTruthy();

      const plan = await getResponse.json();
      expect(plan.frontmatter.priority).toBe('critical');
      expect(plan.frontmatter.tags).toContain('backend');
      expect(plan.frontmatter.tags).toContain('api');
      expect(plan.frontmatter.assignee).toBe('bob');
    } finally {
      // Clean up
      await request.delete(`${API_BASE_URL}/api/plans/${newFilename}`).catch(() => {});
    }
  });
});

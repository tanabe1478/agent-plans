import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const TEST_PLAN_FILENAME = 'test-rendering-plan.md';
const TEST_PLAN_CONTENT = `---
created: "2026-02-10T00:00:00Z"
modified: "2026-02-10T00:00:00Z"
project_path: "/home/user/projects/test"
session_id: "test-session-rendering"
status: todo
---
# Rendering Test Plan

## Overview

This plan tests markdown rendering.

## Summary Table

| Feature | Status | Priority |
|---------|--------|----------|
| Auth | Done | High |
| Search | WIP | Medium |
| Export | Todo | Low |

## Details

Some details here.

## Code Example

\`\`\`typescript
const greeting: string = "hello";
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`
`;

test.describe('Plan detail rendering', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('http://localhost:3001/api/plans', {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: TEST_PLAN_CONTENT,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should not display YAML frontmatter in rendered content', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Frontmatter fields should NOT appear in the rendered content
    const content = page.locator('.markdown-content');
    await expect(content).not.toContainText('session_id:');
    await expect(content).not.toContainText('project_path:');
    await expect(content).not.toContainText('test-session-rendering');
  });

  test('should display status badge in detail header', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Status badge should be rendered as an interactive button next to the title
    const statusButton = page.getByRole('button', { name: 'ToDo', exact: true });
    await expect(statusButton).toBeVisible();
  });

  test('should display project badge in detail header', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Project badge should show the last directory name in the metadata area
    const metadataArea = page.locator('.text-muted-foreground').filter({ hasText: 'test' });
    await expect(metadataArea.first()).toBeVisible();
  });

  test('should allow status change from detail page', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Click header status badge to open dropdown
    const statusButton = main.getByRole('button', { name: 'ToDo', exact: true });
    await expect(statusButton).toBeVisible();
    await statusButton.click();

    // Dropdown should show status options
    await expect(main.getByRole('button', { name: 'In Progress', exact: true })).toBeVisible();
  });

  test('should apply syntax highlighting to code blocks', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Code block should have hljs class applied by rehype-highlight
    const codeBlock = page.locator('.markdown-content pre code.hljs');
    await expect(codeBlock).toBeVisible();

    // Syntax tokens should be wrapped in spans with hljs-* classes
    const highlightedSpans = codeBlock.locator('span[class^="hljs-"]');
    await expect(highlightedSpans.first()).toBeVisible();

    // Highlighted tokens should have non-default color (not inherit)
    const firstSpan = highlightedSpans.first();
    const color = await firstSpan.evaluate((el) => getComputedStyle(el).color);
    const codeColor = await codeBlock.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe(codeColor);
  });

  test('should NOT display line numbers on detail page (view mode)', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Line number gutters should NOT be rendered on detail page
    const lineGutters = page.locator('.markdown-content .line-number-gutter');
    await expect(lineGutters).toHaveCount(0);

    // with-line-numbers class should NOT be applied
    const article = page.locator('.markdown-content');
    await expect(article).not.toHaveClass(/with-line-numbers/);
  });

  test('should display Review link on detail page', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Review link should be visible
    const reviewLink = page.getByRole('link', { name: 'Review' });
    await expect(reviewLink).toBeVisible();
    await expect(reviewLink).toHaveAttribute('href', `/plan/${TEST_PLAN_FILENAME}/review`);
  });

  test('should display section navigation sidebar on desktop', async ({ page }) => {
    // Ensure desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Section nav should be visible with TOC heading
    const sectionNav = page.locator('.section-nav');
    await expect(sectionNav.first()).toBeVisible();
    await expect(sectionNav.first().getByText('目次')).toBeVisible();

    // Should list headings from the content
    await expect(sectionNav.first().getByText('Overview')).toBeVisible();
    await expect(sectionNav.first().getByText('Summary Table')).toBeVisible();
    await expect(sectionNav.first().getByText('Details')).toBeVisible();
    await expect(sectionNav.first().getByText('Code Example')).toBeVisible();
  });

  test('should navigate to heading when section nav item is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Click on "Code Example" in section nav
    const sectionNav = page.locator('.section-nav').first();
    await sectionNav.getByText('Code Example').click();

    // Wait for smooth scroll
    await page.waitForTimeout(500);

    // The heading should be visible in the viewport
    const heading = page.locator('.markdown-content').getByText('Code Example');
    await expect(heading).toBeInViewport();
  });

  test('should render markdown tables as HTML tables', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Rendering Test Plan' }).first()).toBeVisible();

    // Table should be rendered as an actual HTML table element
    const table = page.locator('.markdown-content table');
    await expect(table).toBeVisible();

    // Verify table headers
    const headers = table.locator('th');
    await expect(headers).toHaveCount(3);
    await expect(headers.nth(0)).toHaveText('Feature');
    await expect(headers.nth(1)).toHaveText('Status');
    await expect(headers.nth(2)).toHaveText('Priority');

    // Verify table rows
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('td').nth(0)).toHaveText('Auth');
    await expect(rows.nth(2).locator('td').nth(1)).toHaveText('Todo');
  });
});

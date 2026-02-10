import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const TEST_PLAN_FILENAME = 'test-review-plan.md';
const TEST_PLAN_CONTENT = `---
created: "2026-02-10T00:00:00Z"
modified: "2026-02-10T00:00:00Z"
project_path: "/home/user/projects/test"
session_id: "test-session-review"
status: todo
---
# Review Test Plan

## Overview

This plan tests the review functionality.

## Details

Some details here.

## Summary

Final summary.
`;

test.describe('Review page', () => {
  test.beforeEach(async ({ request, page }) => {
    await request.post('http://localhost:3001/api/plans', {
      data: {
        filename: TEST_PLAN_FILENAME,
        content: TEST_PLAN_CONTENT,
      },
    });
    // Clear localStorage for this plan
    await page.goto('/');
    await page.evaluate((filename) => {
      localStorage.removeItem(`ccplans-review-comments-${filename}`);
    }, TEST_PLAN_FILENAME);
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`http://localhost:3001/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
  });

  test('should navigate from detail to review page', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    const reviewLink = page.getByRole('link', { name: 'Review' });
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();

    await expect(page).toHaveURL(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByText('Review mode')).toBeVisible();
  });

  test('should display line numbers on review page', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Line number gutters should be rendered
    const lineGutters = page.locator('.markdown-content .line-number-gutter');
    const count = await lineGutters.count();
    expect(count).toBeGreaterThan(0);

    // First gutter should have a numeric line number
    const firstGutter = lineGutters.first();
    const text = await firstGutter.textContent();
    expect(Number(text)).toBeGreaterThan(0);
  });

  test('should add a single-line comment via gutter click', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Click on a line number gutter
    const gutter = page.locator('.line-number-gutter.review-gutter').first();
    await gutter.click();

    // Comment form should appear
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await expect(textarea).toBeVisible();

    // Type and submit
    await textarea.fill('This needs improvement');
    await page.locator('button', { hasText: 'Comment' }).click();

    // Comment should be displayed
    await expect(page.getByText('This needs improvement')).toBeVisible();

    // Comment count should update
    await expect(page.getByText('1 comment')).toBeVisible();
  });

  test('should copy prompt for a single comment', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment
    const gutter = page.locator('.line-number-gutter.review-gutter').first();
    await gutter.click();
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea.fill('Fix this section');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Fix this section')).toBeVisible();

    // Click copy prompt button
    const copyButton = page.locator('[title="Copy prompt"]');
    await copyButton.click();

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain(TEST_PLAN_FILENAME);
    expect(clipboardText).toContain('Fix this section');
    expect(clipboardText).toMatch(/L\d+/);
  });

  test('should edit an existing comment', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment
    const gutter = page.locator('.line-number-gutter.review-gutter').first();
    await gutter.click();
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea.fill('Original text');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Original text')).toBeVisible();

    // Click edit button
    const editButton = page.locator('[title="Edit"]');
    await editButton.click();

    // Edit form should appear with existing text
    const editTextarea = page.locator('textarea');
    await expect(editTextarea).toHaveValue('Original text');

    // Update the text
    await editTextarea.clear();
    await editTextarea.fill('Updated text');
    await page.locator('button', { hasText: 'Comment' }).click();

    // Updated text should be visible
    await expect(page.getByText('Updated text')).toBeVisible();
    await expect(page.getByText('Original text')).not.toBeVisible();
  });

  test('should delete a comment', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment
    const gutter = page.locator('.line-number-gutter.review-gutter').first();
    await gutter.click();
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea.fill('To be deleted');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('To be deleted')).toBeVisible();
    await expect(page.getByText('1 comment')).toBeVisible();

    // Click delete button
    const deleteButton = page.locator('[title="Delete"]');
    await deleteButton.click();

    // Comment should be removed
    await expect(page.getByText('To be deleted')).not.toBeVisible();
    await expect(page.getByText('0 comments')).toBeVisible();
  });

  test('should persist comments across page reload', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment
    const gutter = page.locator('.line-number-gutter.review-gutter').first();
    await gutter.click();
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea.fill('Persistent comment');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Persistent comment')).toBeVisible();

    // Reload the page
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Comment should still be there
    await expect(page.getByText('Persistent comment')).toBeVisible();
    await expect(page.getByText('1 comment')).toBeVisible();
  });

  test('should clear all comments', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add two comments
    const gutters = page.locator('.line-number-gutter.review-gutter');
    await gutters.first().click();
    const textarea1 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea1.fill('Comment 1');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Comment 1')).toBeVisible();

    await gutters.nth(1).click();
    const textarea2 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea2.fill('Comment 2');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Comment 2')).toBeVisible();
    await expect(page.getByText('2 comments')).toBeVisible();

    // Click Clear All
    await page.locator('button', { hasText: 'Clear All' }).click();

    // Confirm
    await page.locator('button', { hasText: 'Yes' }).click();

    // All comments should be removed
    await expect(page.getByText('0 comments')).toBeVisible();
    await expect(page.getByText('Comment 1')).not.toBeVisible();
    await expect(page.getByText('Comment 2')).not.toBeVisible();
  });

  test('should copy all prompts with separator', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add two comments
    const gutters = page.locator('.line-number-gutter.review-gutter');
    await gutters.first().click();
    const textarea1 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea1.fill('First comment');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('First comment')).toBeVisible();

    await gutters.nth(1).click();
    const textarea2 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea2.fill('Second comment');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Second comment')).toBeVisible();

    // Click Copy All Prompts
    await page.locator('button', { hasText: 'Copy All Prompts' }).click();

    // Verify clipboard content has separator
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('First comment');
    expect(clipboardText).toContain('Second comment');
    expect(clipboardText).toContain('=====');
  });
});

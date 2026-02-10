import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

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
    await request.post(`${API_BASE_URL}/api/plans`, {
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
    await request.delete(`${API_BASE_URL}/api/plans/${TEST_PLAN_FILENAME}`).catch(() => {});
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

  test('should display plain text with line numbers', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // File header should show filename
    await expect(page.locator('.review-file-header')).toContainText(TEST_PLAN_FILENAME);

    // Line number gutters should be rendered
    const gutters = page.locator('.review-diff-gutter');
    const count = await gutters.count();
    expect(count).toBeGreaterThan(0);

    // First gutter should have line number 1
    const firstLineNum = page.locator('.review-line-num').first();
    const text = await firstLineNum.textContent();
    expect(Number(text)).toBe(1);
  });

  test('should show + button on gutter hover', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    const firstLine = page.locator('.review-diff-line').first();
    const lineNum = firstLine.locator('.review-line-num');
    const addBtn = firstLine.locator('.review-add-btn');

    await expect(lineNum).toBeVisible();
    await expect(addBtn).not.toBeVisible();

    // Hover the line
    await firstLine.hover();

    // After hover: + button should be visible
    await expect(addBtn).toBeVisible();
  });

  test('should add a single-line comment via gutter click', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Click on a gutter
    const gutter = page.locator('.review-diff-gutter').first();
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

  test('should display quoted content in comment card', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment on a line
    const gutter = page.locator('.review-diff-gutter').first();
    await gutter.click();
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea.fill('Review comment');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Review comment')).toBeVisible();

    // Comment card should show quoted content with > prefix
    const quotedContent = page.locator('.inline-comment pre');
    await expect(quotedContent).toBeVisible();
    const text = await quotedContent.textContent();
    expect(text).toContain('>');
  });

  test('should copy prompt with quoted content', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment
    const gutter = page.locator('.review-diff-gutter').first();
    await gutter.click();
    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea.fill('Fix this section');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Fix this section')).toBeVisible();

    // Click copy prompt button
    const copyButton = page.locator('[title="Copy prompt"]');
    await copyButton.click();

    // Verify clipboard content contains quoted line
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain(TEST_PLAN_FILENAME);
    expect(clipboardText).toContain('Fix this section');
    expect(clipboardText).toMatch(/L\d+/);
    expect(clipboardText).toContain('> ');
  });

  test('should edit an existing comment', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    // Add a comment
    const gutter = page.locator('.review-diff-gutter').first();
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
    const gutter = page.locator('.review-diff-gutter').first();
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
    const gutter = page.locator('.review-diff-gutter').first();
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

    // Add two comments on different lines
    const gutters = page.locator('.review-diff-gutter');
    await gutters.first().click();
    const textarea1 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea1.fill('Comment 1');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Comment 1')).toBeVisible();

    await gutters.nth(3).click();
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
    const gutters = page.locator('.review-diff-gutter');
    await gutters.first().click();
    const textarea1 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea1.fill('First comment');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('First comment')).toBeVisible();

    await gutters.nth(3).click();
    const textarea2 = page.locator('textarea[placeholder*="Add a comment"]');
    await textarea2.fill('Second comment');
    await page.locator('button', { hasText: 'Comment' }).click();
    await expect(page.getByText('Second comment')).toBeVisible();

    // Click Copy All Prompts
    await page.locator('button', { hasText: 'Copy All Prompts' }).click();

    // Verify clipboard content has separator and quoted lines
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('First comment');
    expect(clipboardText).toContain('Second comment');
    expect(clipboardText).toContain('=====');
    expect(clipboardText).toContain('> ');
  });

  test('should create range comment with Shift+Click', async ({ page }) => {
    await page.goto(`/plan/${TEST_PLAN_FILENAME}/review`);
    await expect(page.getByRole('heading', { name: 'Review Test Plan' }).first()).toBeVisible();

    const gutters = page.locator('.review-diff-gutter');
    const gutterCount = await gutters.count();
    expect(gutterCount).toBeGreaterThanOrEqual(3);

    // First click (no shift)
    await gutters.first().click();
    // Cancel the form that appears
    await page.locator('button', { hasText: 'Cancel' }).click();

    // Shift+Click on a different gutter
    await gutters.nth(2).click({ modifiers: ['Shift'] });

    // Form should appear with a range badge
    const formBadge = page.locator('.inline-comment-form .bg-amber-200');
    await expect(formBadge).toBeVisible();
    const badgeText = await formBadge.textContent();
    expect(badgeText).toMatch(/L\d+-L\d+/);
  });
});

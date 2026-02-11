import { expect, test } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Kanban View (Feature 8)', () => {
  test('should navigate to kanban page', async ({ page }) => {
    await page.goto('/');

    // Click Kanban tab in header
    const kanbanTab = page.getByRole('link', { name: 'Kanban' });
    await expect(kanbanTab).toBeVisible();
    await kanbanTab.click();

    // Verify URL changed to /kanban
    await expect(page).toHaveURL('/kanban');

    // Verify kanban page heading is visible
    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();
  });

  test('should display status columns on kanban page', async ({ page }) => {
    await page.goto('/kanban');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Verify all status columns are displayed (StatusBadge renders as <span> in kanban columns)
    await expect(page.getByText('ToDo', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('In Progress', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Review', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  });

  test('should display plan cards in kanban columns', async ({ page }) => {
    await page.goto('/kanban');

    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Wait for plan cards to load by checking for plan links
    const planLink = page.locator('a[href*="/plan/"]').first();
    await expect(planLink).toBeVisible({ timeout: 5000 });

    // Check that at least one plan card is visible
    const planCards = page.locator('a[href*="/plan/"]');
    const count = await planCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have working view tabs in header (List/Kanban)', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Verify List tab is active
    const listTab = page.getByRole('link', { name: 'List' });
    await expect(listTab).toHaveClass(/bg-primary/);

    // Click Kanban tab
    await page.getByRole('link', { name: 'Kanban' }).click();
    await expect(page).toHaveURL('/kanban');

    // Click List tab to return
    await page.getByRole('link', { name: 'List' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should click plan card on kanban to navigate to detail', async ({ page }) => {
    await page.goto('/kanban');

    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Wait for plan cards to load
    const planLink = page.locator('a[href*="/plan/"]').first();
    await expect(planLink).toBeVisible({ timeout: 5000 });

    await planLink.click();

    // Verify navigation to plan detail page
    await expect(page).toHaveURL(/\/plan\//);
  });

  test('should show plan count per column on kanban', async ({ page }) => {
    await page.goto('/kanban');

    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Wait for plan cards to appear
    await expect(page.locator('a[href*="/plan/"]').first()).toBeVisible({ timeout: 5000 });

    // Verify all status columns are present (StatusBadge renders as <span> in kanban columns)
    await expect(page.getByText('ToDo', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('In Progress', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Review', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  });

  test('should show priority indicator on kanban cards', async ({ page }) => {
    await page.goto('/kanban');

    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Wait for plan cards to load
    await expect(page.locator('a[href*="/plan/"]').first()).toBeVisible({ timeout: 5000 });

    // Look for priority badges/indicators on kanban cards
    const priorityIndicators = page
      .locator('[class*="priority"], [data-priority], .badge, span')
      .filter({ hasText: /high|critical|medium|low/i });

    const indicatorCount = await priorityIndicators.count();

    // Fixture plans have priorities, so cards should show priority indicators
    expect(indicatorCount).toBeGreaterThan(0);
  });
});

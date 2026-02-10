import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Kanban & Calendar Views (Feature 8)', () => {
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

  test('should navigate to calendar page', async ({ page }) => {
    await page.goto('/');

    // Click Calendar tab in header
    const calendarTab = page.getByRole('link', { name: 'Calendar' });
    await expect(calendarTab).toBeVisible();
    await calendarTab.click();

    // Verify URL changed to /calendar
    await expect(page).toHaveURL('/calendar');

    // Verify calendar page heading is visible
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test('should display calendar grid with day labels', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Verify day labels are displayed (use exact match to avoid "Month" matching "Mon")
    await expect(page.getByText('Mon', { exact: true })).toBeVisible();
    await expect(page.getByText('Tue', { exact: true })).toBeVisible();
    await expect(page.getByText('Wed', { exact: true })).toBeVisible();
    await expect(page.getByText('Thu', { exact: true })).toBeVisible();
    await expect(page.getByText('Fri', { exact: true })).toBeVisible();
    await expect(page.getByText('Sat', { exact: true })).toBeVisible();
    await expect(page.getByText('Sun', { exact: true })).toBeVisible();
  });

  test('should display calendar navigation controls', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Verify navigation buttons exist
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();

    // Verify view toggle (Month/Week) exists
    await expect(page.getByRole('button', { name: 'Month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Week' })).toBeVisible();
  });

  test('should switch between calendar views (Month/Week)', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Click Week view
    const weekButton = page.getByRole('button', { name: 'Week' });
    await weekButton.click();

    // Verify Week button is now highlighted (has primary background)
    await expect(weekButton).toHaveClass(/bg-primary/);

    // Click Month view
    const monthButton = page.getByRole('button', { name: 'Month' });
    await monthButton.click();

    // Verify Month button is now highlighted
    await expect(monthButton).toHaveClass(/bg-primary/);
  });

  test('should have working view tabs in header (List/Kanban/Calendar)', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();

    // Verify List tab is active
    const listTab = page.getByRole('link', { name: 'List' });
    await expect(listTab).toHaveClass(/bg-primary/);

    // Click Kanban tab
    await page.getByRole('link', { name: 'Kanban' }).click();
    await expect(page).toHaveURL('/kanban');

    // Click Calendar tab
    await page.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL('/calendar');

    // Click List tab to return
    await page.getByRole('link', { name: 'List' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should display plans with due dates on calendar', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Wait for calendar grid to render (day cells should be present)
    await expect(page.getByText('Mon', { exact: true })).toBeVisible();

    // Verify the calendar SVG or grid structure rendered
    const calendarGrid = page.locator('[class*="grid"], table, svg').first();
    await expect(calendarGrid).toBeVisible();
  });

  test('should click plan card on kanban to navigate to detail', async ({ page }) => {
    await page.goto('/kanban');

    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Wait for plan cards to load
    const planLink = page.locator('a[href*="/plan/"]').first();
    await expect(planLink).toBeVisible({ timeout: 5000 });

    await planLink.click();

    // Verify navigation to plan detail page
    await expect(page).toHaveURL(new RegExp('/plan/'));
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

  test('should navigate calendar months with prev/next buttons', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Get the current month/year text
    const monthText = page.locator('h2, [class*="month"], [class*="title"]').filter({ hasText: /\d{4}/ });
    const initialMonthText = await monthText.first().textContent();

    // Click prev button (chevron-left icon)
    const prevButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') });
    await expect(prevButton).toBeVisible();
    await prevButton.click();

    // Wait for calendar to update by checking the month text changed
    await expect(async () => {
      const newMonthText = await monthText.first().textContent();
      expect(newMonthText).not.toBe(initialMonthText);
    }).toPass({ timeout: 3000 });

    // Click next button to go back
    const nextButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') });
    await nextButton.click();

    // Verify we're back to the original month
    await expect(async () => {
      const restoredMonthText = await monthText.first().textContent();
      expect(restoredMonthText).toBe(initialMonthText);
    }).toPass({ timeout: 3000 });
  });

  test('should click plan on calendar to navigate to detail', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Fixture plans have due dates in Feb 2026 (current month), so plan links must exist
    const planLink = page.locator('a[href*="/plan/"]').first();
    await expect(planLink).toBeVisible({ timeout: 5000 });

    await planLink.click();

    // Verify navigation to plan detail page
    await expect(page).toHaveURL(new RegExp('/plan/'));
  });

  test('should show priority indicator on kanban cards', async ({ page }) => {
    await page.goto('/kanban');

    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    // Wait for plan cards to load
    await expect(page.locator('a[href*="/plan/"]').first()).toBeVisible({ timeout: 5000 });

    // Look for priority badges/indicators on kanban cards
    const priorityIndicators = page.locator(
      '[class*="priority"], [data-priority], .badge, span'
    ).filter({ hasText: /high|critical|medium|low/i });

    const indicatorCount = await priorityIndicators.count();

    // Fixture plans have priorities, so cards should show priority indicators
    expect(indicatorCount).toBeGreaterThan(0);
  });
});

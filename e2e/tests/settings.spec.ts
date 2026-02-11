import { expect, test } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Settings - Frontmatter opt-out', () => {
  test.afterAll(async ({ request }) => {
    // Restore frontmatter enabled for other tests
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: true },
    });
  });

  test('GET /api/settings returns current settings', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/settings`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(typeof data.frontmatterEnabled).toBe('boolean');
  });

  test('PUT /api/settings updates frontmatterEnabled', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.frontmatterEnabled).toBe(false);

    // Verify persistence
    const getResponse = await request.get(`${API_BASE_URL}/api/settings`);
    const getData = await getResponse.json();
    expect(getData.frontmatterEnabled).toBe(false);
  });

  test('plans API returns no frontmatter when disabled', async ({ request }) => {
    // Ensure disabled
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });

    const response = await request.get(`${API_BASE_URL}/api/plans`);
    const data = await response.json();
    if (data.plans.length > 0) {
      expect(data.plans[0].frontmatter).toBeUndefined();
    }
  });

  test('plans API returns frontmatter when enabled', async ({ request }) => {
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: true },
    });
    const response = await request.get(`${API_BASE_URL}/api/plans`);
    const data = await response.json();
    const plansWithFm = data.plans.filter(
      (p: { frontmatter?: unknown }) => p.frontmatter !== undefined
    );
    expect(plansWithFm.length).toBeGreaterThan(0);
  });

  test('status update returns 403 when frontmatter disabled', async ({ request }) => {
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });

    const plansResponse = await request.get(`${API_BASE_URL}/api/plans`);
    const plansData = await plansResponse.json();
    if (plansData.plans.length === 0) {
      test.skip();
      return;
    }
    const filename = plansData.plans[0].filename;

    const response = await request.patch(`${API_BASE_URL}/api/plans/${filename}/status`, {
      data: { status: 'in_progress' },
    });
    expect(response.status()).toBe(403);
  });

  test('dependencies returns empty graph when frontmatter disabled', async ({ request }) => {
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });
    const response = await request.get(`${API_BASE_URL}/api/dependencies`);
    const data = await response.json();
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
  });

  test('notifications returns empty when frontmatter disabled', async ({ request }) => {
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });
    const response = await request.get(`${API_BASE_URL}/api/notifications`);
    const data = await response.json();
    expect(data.notifications).toEqual([]);
    expect(data.unreadCount).toBe(0);
  });

  test('settings page is accessible and toggle works', async ({ page, request }) => {
    // Ensure disabled first
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });

    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.getByRole('heading', { name: 'Frontmatter Features' })).toBeVisible();

    // Toggle should be visible
    const toggle = page.locator('button[role="switch"]');
    await expect(toggle).toBeVisible();

    // Initially off
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Click to enable
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('kanban redirects to home when frontmatter disabled', async ({ page, request }) => {
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });
    await page.goto('/kanban');
    await expect(page).toHaveURL('/');
  });

  test('dependencies redirects to home when frontmatter disabled', async ({ page, request }) => {
    await request.put(`${API_BASE_URL}/api/settings`, {
      data: { frontmatterEnabled: false },
    });
    await page.goto('/dependencies');
    await expect(page).toHaveURL('/');
  });
});

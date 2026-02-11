import { expect, test } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Advanced Search (Feature 6)', () => {
  test('should display search results when entering query', async ({ page }) => {
    await page.goto('/search?q=Authentication');

    // Wait for search results to load
    await expect(page.getByText(/results/i)).toBeVisible({ timeout: 5000 });

    // Should show the search query
    await expect(page.getByText('"Authentication"')).toBeVisible();

    // Should display matching plan (blue-running-fox.md has "Authentication" in title)
    await expect(page.getByRole('heading', { name: /Authentication/i, level: 3 })).toBeVisible();
  });

  test('API: status:todo filter search should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'status:todo' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    // Known fixture files with status=todo should be in the results
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
    expect(filenames).toContain('yellow-jumping-dog.md');
  });

  test('API: tag:api filter search should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'tag:api' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    // red-sleeping-bear.md has tags: [api, security]
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('red-sleeping-bear.md');
  });

  test('API: priority:high filter search should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'priority:high' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    // blue-running-fox.md has priority=high
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
  });

  test('API: assignee:alice filter search should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'assignee:alice' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    // blue-running-fox.md and red-sleeping-bear.md have assignee=alice
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
    expect(filenames).toContain('red-sleeping-bear.md');
  });

  test('API: combined query (text + filter) should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'auth status:todo' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    // Should find blue-running-fox.md (has "auth" in content and status=todo)
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
  });

  test('should display filter chips for parsed filters', async ({ page }) => {
    await page.goto('/search');

    // Type a filter query - use the SearchBar component's text input (not the header search)
    const searchInput = page.getByRole('textbox', { name: /Search plans/i });
    await searchInput.fill('status:todo tag:api priority:high');

    // Check that filter chips are rendered (use exact match to avoid sidebar conflicts)
    await expect(page.getByText('status', { exact: true })).toBeVisible();
    await expect(page.getByText('tag', { exact: true })).toBeVisible();
    await expect(page.getByText('priority', { exact: true })).toBeVisible();
  });

  test('should show autocomplete hints when typing filter prefixes', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByRole('textbox', { name: /Search plans/i });
    await searchInput.fill('stat');

    // Should show hint for status:
    await expect(page.getByText(/Filter by status/i)).toBeVisible();
  });

  test('API: due date less than filter should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'due<2026-02-07' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // yellow-jumping-dog (due 2026-02-03) and green-dancing-cat (due 2026-02-06) should match
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('yellow-jumping-dog.md');
    expect(filenames).toContain('green-dancing-cat.md');
  });

  test('API: due date greater than filter should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'due>2026-02-07' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // blue-running-fox (due 2026-02-08) should match
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
  });

  test('API: estimate filter should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'estimate:3d' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // blue-running-fox has estimate=3d
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
  });

  test('API: project filter should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'project:/home/user/projects/web-app' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // blue-running-fox and yellow-jumping-dog have projectPath=/home/user/projects/web-app
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');
    expect(filenames).toContain('yellow-jumping-dog.md');
  });

  test('API: blockedBy filter should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'blockedBy:blue-running-fox.md' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // green-dancing-cat has blockedBy: [blue-running-fox.md]
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('green-dancing-cat.md');
  });

  test('API: quoted phrase search should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: '"Performance Optimization"' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // green-dancing-cat has "Mobile App Performance Optimization" in title
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('green-dancing-cat.md');
  });

  test('API: multiple combined filters should work', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: 'status:todo priority:high tag:backend' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // blue-running-fox matches all three filters
    const filenames = data.results.map((r: any) => r.filename);
    expect(filenames).toContain('blue-running-fox.md');

    // Other plans should not match all three filters combined
    expect(filenames).not.toContain('yellow-jumping-dog.md');
  });

  test('API: empty query should return validation error', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/search`, {
      params: { q: '' },
    });

    // The API validates q with z.string().min(1), so empty query returns 400
    expect(response.status()).toBe(400);
  });

  test('should navigate to search page and display results', async ({ page }) => {
    await page.goto('/search');

    // Verify search page is loaded - use the SearchBar component's text input (not the header search)
    const searchInput = page.getByRole('textbox', { name: /Search plans/i });
    await expect(searchInput).toBeVisible();

    // Type a query and submit with Enter key
    await searchInput.fill('Authentication');
    await searchInput.press('Enter');

    // Wait for results to appear
    await expect(page.getByText(/results/i)).toBeVisible({ timeout: 5000 });

    // Verify at least one result is displayed
    await expect(page.getByRole('heading', { name: /Authentication/i, level: 3 })).toBeVisible();
  });
});

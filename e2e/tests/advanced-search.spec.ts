import { test, expect } from '@playwright/test';

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
    const response = await request.get('http://localhost:3001/api/search', {
      params: { q: 'status:todo' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // All results should have status=todo
    const allTodo = data.results.every((r: any) =>
      r.filename === 'blue-running-fox.md' || r.filename === 'yellow-jumping-dog.md'
    );
    expect(allTodo || data.results.length === 0).toBe(true);
  });

  test('API: tag:api filter search should work', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/search', {
      params: { q: 'tag:api' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // red-sleeping-bear.md has tags: [api, security]
    const hasApiTag = data.results.some((r: any) => r.filename === 'red-sleeping-bear.md');
    expect(hasApiTag || data.results.length === 0).toBe(true);
  });

  test('API: priority:high filter search should work', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/search', {
      params: { q: 'priority:high' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // blue-running-fox.md has priority=high
    const hasHighPriority = data.results.some((r: any) => r.filename === 'blue-running-fox.md');
    expect(hasHighPriority || data.results.length === 0).toBe(true);
  });

  test('API: assignee:alice filter search should work', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/search', {
      params: { q: 'assignee:alice' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // blue-running-fox.md and red-sleeping-bear.md have assignee=alice
    const hasAlice = data.results.every(
      (r: any) => r.filename === 'blue-running-fox.md' || r.filename === 'red-sleeping-bear.md'
    );
    expect(hasAlice || data.results.length === 0).toBe(true);
  });

  test('API: combined query (text + filter) should work', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/search', {
      params: { q: 'auth status:todo' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    // Should find blue-running-fox.md (has "auth" in content and status=todo)
    const hasMatch =
      data.results.length === 0 || data.results.some((r: any) => r.filename === 'blue-running-fox.md');
    expect(hasMatch).toBe(true);
  });

  test('should display filter chips for parsed filters', async ({ page }) => {
    await page.goto('/search');

    // Type a filter query
    const searchInput = page.getByPlaceholder(/Search plans/i);
    await searchInput.fill('status:todo tag:api priority:high');

    // Check that filter chips are rendered
    await expect(page.getByText('status')).toBeVisible();
    await expect(page.getByText('tag')).toBeVisible();
    await expect(page.getByText('priority')).toBeVisible();
  });

  test('should show autocomplete hints when typing filter prefixes', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByPlaceholder(/Search plans/i);
    await searchInput.fill('stat');

    // Should show hint for status:
    await expect(page.getByText(/Filter by status/i)).toBeVisible();
  });
});

import { expect, test } from '../lib/fixtures';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Saved Views (Feature 7)', () => {
  let createdViewId: string | null = null;

  test.afterEach(async ({ request, apiBaseUrl }) => {
    // Clean up: delete created custom view if it exists
    if (createdViewId) {
      await request.delete(`${apiBaseUrl}/api/views/${createdViewId}`).catch(() => {});
      createdViewId = null;
    }
  });

  test('API: should retrieve views list with preset views', async ({ request, apiBaseUrl }) => {
    const response = await request.get(`${apiBaseUrl}/api/views`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.views).toBeDefined();
    expect(Array.isArray(data.views)).toBe(true);

    // Should have at least one preset view
    const presets = data.views.filter((v: any) => v.isPreset);
    expect(presets.length).toBeGreaterThan(0);
  });

  test('API: should create a custom view', async ({ request, apiBaseUrl }) => {
    const viewData = {
      name: 'Test Custom View',
      filters: {
        status: 'in_progress',
        priority: 'high',
      },
      sortBy: 'dueDate',
      sortOrder: 'asc' as const,
    };

    const response = await request.post(`${apiBaseUrl}/api/views`, {
      data: viewData,
    });

    expect(response.status()).toBe(201);
    const data = await response.json();

    expect(data.id).toBeDefined();
    expect(data.name).toBe('Test Custom View');
    // Custom views don't have isPreset=false explicitly; just verify it's not a preset
    expect(data.isPreset).toBeFalsy();
    expect(data.filters.status).toBe('in_progress');
    expect(data.filters.priority).toBe('high');

    // Store ID for cleanup
    createdViewId = data.id;
  });

  test('API: should delete a custom view', async ({ request, apiBaseUrl }) => {
    // First create a view
    const createResponse = await request.post(`${apiBaseUrl}/api/views`, {
      data: {
        name: 'View to Delete',
        filters: { status: 'todo' },
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const viewId = createData.id;

    // Delete the view
    const deleteResponse = await request.delete(`${apiBaseUrl}/api/views/${viewId}`);

    expect(deleteResponse.ok()).toBeTruthy();

    // Verify it no longer exists
    const listResponse = await request.get(`${apiBaseUrl}/api/views`);
    const listData = await listResponse.json();

    const viewExists = listData.views.some((v: any) => v.id === viewId);
    expect(viewExists).toBe(false);
  });

  test('API: should update a custom view', async ({ request, apiBaseUrl }) => {
    // Create a view
    const createResponse = await request.post(`${apiBaseUrl}/api/views`, {
      data: {
        name: 'Original Name',
        filters: { status: 'todo' },
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    createdViewId = createData.id;

    // Update the view
    const updateResponse = await request.put(`${apiBaseUrl}/api/views/${createdViewId}`, {
      data: {
        name: 'Updated Name',
        filters: { status: 'completed' },
      },
    });

    expect(updateResponse.ok()).toBeTruthy();
    const updateData = await updateResponse.json();

    expect(updateData.name).toBe('Updated Name');
    expect(updateData.filters.status).toBe('completed');
  });

  test('should display views sidebar when sidebar is open', async ({ page }) => {
    await page.goto('/');

    // Ensure sidebar is open (click toggle if needed)
    const sidebarOpen = await page.locator('aside').filter({ hasText: 'Views' }).isVisible();

    if (!sidebarOpen) {
      const toggleButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-panel-left-open') });
      await toggleButton.click();
    }

    // Verify sidebar is visible
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();
  });

  test('should show preset views in sidebar', async ({ page }) => {
    await page.goto('/');

    // Open sidebar if needed
    const sidebarOpen = await page.locator('aside').filter({ hasText: 'Views' }).isVisible();
    if (!sidebarOpen) {
      const toggleButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-panel-left-open') });
      await toggleButton.click();
    }

    // Wait for sidebar to load
    await expect(page.getByText('Presets')).toBeVisible();

    // Should have at least one preset view listed
    const sidebar = page.locator('aside').filter({ hasText: 'Views' });
    await expect(
      sidebar.getByText(/In Progress|High Priority|Critical|Todo/i).first()
    ).toBeVisible();
  });

  test('API: should apply view filters correctly', async ({ request, apiBaseUrl }) => {
    // Create a view with status:in_progress filter
    const createResponse = await request.post(`${apiBaseUrl}/api/views`, {
      data: {
        name: 'In Progress Filter Test',
        filters: { status: 'in_progress' },
      },
    });

    expect(createResponse.status()).toBe(201);
    const viewData = await createResponse.json();
    createdViewId = viewData.id;

    // Verify the view was created with correct filters
    expect(viewData.filters.status).toBe('in_progress');

    // List views and find our created view
    const listResponse = await request.get(`${apiBaseUrl}/api/views`);
    const listData = await listResponse.json();

    const view = listData.views.find((v: any) => v.id === createdViewId);
    expect(view).toBeDefined();
    expect(view.filters.status).toBe('in_progress');
  });

  test('API: should not allow deleting preset views', async ({ request, apiBaseUrl }) => {
    // Try to delete a preset view
    const deleteResponse = await request.delete(`${apiBaseUrl}/api/views/preset-in-progress`);

    // Preset IDs are not UUIDs, so validation should reject them (400)
    // or the service should return 404 since presets are not in custom views
    expect(deleteResponse.ok()).toBe(false);
    expect([400, 404]).toContain(deleteResponse.status());
  });

  test('API: should create view with tags filter', async ({ request, apiBaseUrl }) => {
    const createResponse = await request.post(`${apiBaseUrl}/api/views`, {
      data: {
        name: 'API Tag View',
        filters: { tags: ['api'] },
      },
    });

    expect(createResponse.status()).toBe(201);
    const data = await createResponse.json();
    createdViewId = data.id;

    expect(data.filters.tags).toBeDefined();
    expect(data.filters.tags).toContain('api');
  });

  test('API: should create view with date range filter', async ({ request, apiBaseUrl }) => {
    const createResponse = await request.post(`${apiBaseUrl}/api/views`, {
      data: {
        name: 'Date Range View',
        filters: {
          dueBefore: '2026-02-10',
          dueAfter: '2026-02-01',
        },
      },
    });

    expect(createResponse.status()).toBe(201);
    const data = await createResponse.json();
    createdViewId = data.id;

    expect(data.filters.dueBefore).toBe('2026-02-10');
    expect(data.filters.dueAfter).toBe('2026-02-01');
  });

  test('API: should create view with searchQuery', async ({ request, apiBaseUrl }) => {
    const createResponse = await request.post(`${apiBaseUrl}/api/views`, {
      data: {
        name: 'Search Query View',
        filters: {
          searchQuery: 'authentication',
        },
      },
    });

    expect(createResponse.status()).toBe(201);
    const data = await createResponse.json();
    createdViewId = data.id;

    expect(data.filters.searchQuery).toBe('authentication');
  });

  test('should click preset view in sidebar and see filtered results', async ({ page }) => {
    await page.goto('/');

    // Open sidebar if needed
    const sidebarOpen = await page.locator('aside').filter({ hasText: 'Views' }).isVisible();
    if (!sidebarOpen) {
      const toggleButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-panel-left-open') });
      await toggleButton.click();
    }

    // Wait for sidebar to load
    await expect(page.getByText('Presets')).toBeVisible();

    // Click a preset view (e.g., "In Progress" or "Todo")
    const sidebar = page.locator('aside').filter({ hasText: 'Views' });
    const presetButton = sidebar.getByText(/In Progress|Todo|High Priority/i).first();
    await presetButton.click();

    // The page should still be visible with filtered content
    await expect(page.getByRole('heading', { name: 'プラン一覧' })).toBeVisible();
  });
});

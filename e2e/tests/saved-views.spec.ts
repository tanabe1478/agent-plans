import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Saved Views (Feature 7)', () => {
  let createdViewId: string | null = null;

  test.afterEach(async ({ request }) => {
    // Clean up: delete created custom view if it exists
    if (createdViewId) {
      await request.delete(`http://localhost:3001/api/views/${createdViewId}`).catch(() => {});
      createdViewId = null;
    }
  });

  test('API: should retrieve views list with preset views', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/views');

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.views).toBeDefined();
    expect(Array.isArray(data.views)).toBe(true);

    // Should have at least one preset view
    const presets = data.views.filter((v: any) => v.isPreset);
    expect(presets.length).toBeGreaterThan(0);
  });

  test('API: should create a custom view', async ({ request }) => {
    const viewData = {
      name: 'Test Custom View',
      filters: {
        status: 'in_progress',
        priority: 'high',
      },
      sortBy: 'dueDate',
      sortOrder: 'asc' as const,
    };

    const response = await request.post('http://localhost:3001/api/views', {
      data: viewData,
    });

    expect(response.status()).toBe(201);
    const data = await response.json();

    expect(data.id).toBeDefined();
    expect(data.name).toBe('Test Custom View');
    expect(data.isPreset).toBe(false);
    expect(data.filters.status).toBe('in_progress');
    expect(data.filters.priority).toBe('high');

    // Store ID for cleanup
    createdViewId = data.id;
  });

  test('API: should delete a custom view', async ({ request }) => {
    // First create a view
    const createResponse = await request.post('http://localhost:3001/api/views', {
      data: {
        name: 'View to Delete',
        filters: { status: 'todo' },
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const viewId = createData.id;

    // Delete the view
    const deleteResponse = await request.delete(`http://localhost:3001/api/views/${viewId}`);

    expect(deleteResponse.ok()).toBeTruthy();

    // Verify it no longer exists
    const listResponse = await request.get('http://localhost:3001/api/views');
    const listData = await listResponse.json();

    const viewExists = listData.views.some((v: any) => v.id === viewId);
    expect(viewExists).toBe(false);
  });

  test('API: should update a custom view', async ({ request }) => {
    // Create a view
    const createResponse = await request.post('http://localhost:3001/api/views', {
      data: {
        name: 'Original Name',
        filters: { status: 'todo' },
      },
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    createdViewId = createData.id;

    // Update the view
    const updateResponse = await request.put(`http://localhost:3001/api/views/${createdViewId}`, {
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
      const toggleButton = page.locator('button').filter({ has: page.locator('svg.lucide-panel-left-open') });
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
      const toggleButton = page.locator('button').filter({ has: page.locator('svg.lucide-panel-left-open') });
      await toggleButton.click();
    }

    // Wait for sidebar to load
    await expect(page.getByText('Presets')).toBeVisible();

    // Should have at least one preset view listed
    const sidebar = page.locator('aside').filter({ hasText: 'Views' });
    await expect(sidebar.getByText(/All Plans|My Plans|Urgent/i).first()).toBeVisible();
  });
});

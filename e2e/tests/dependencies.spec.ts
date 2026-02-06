import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

// Fixture files:
// - blue-running-fox.md (todo)
// - green-dancing-cat.md (in_progress, blockedBy: [blue-running-fox.md])

test.describe('Dependencies functionality (Feature 13)', () => {
  test('should navigate to /dependencies page', async ({ page }) => {
    await page.goto('/dependencies');
    await expect(page.getByRole('heading', { name: 'Dependency Graph' })).toBeVisible();
  });

  test('should retrieve dependency graph via API', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/dependencies');
    expect(response.ok()).toBeTruthy();

    const graph = await response.json();
    expect(graph.nodes).toBeDefined();
    expect(Array.isArray(graph.nodes)).toBeTruthy();
    expect(graph.edges).toBeDefined();
    expect(Array.isArray(graph.edges)).toBeTruthy();
    expect(graph.hasCycle).toBeDefined();
    expect(graph.criticalPath).toBeDefined();
  });

  test('should show dependency relationship in graph', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/dependencies');
    expect(response.ok()).toBeTruthy();

    const graph = await response.json();

    // Find green-dancing-cat node
    const catNode = graph.nodes.find((n: any) => n.filename === 'green-dancing-cat.md');
    expect(catNode).toBeDefined();
    expect(catNode.blockedBy).toContain('blue-running-fox.md');

    // Find blue-running-fox node
    const foxNode = graph.nodes.find((n: any) => n.filename === 'blue-running-fox.md');
    expect(foxNode).toBeDefined();
    expect(foxNode.blocks).toContain('green-dancing-cat.md');

    // Check edge exists
    const edge = graph.edges.find(
      (e: any) => e.from === 'blue-running-fox.md' && e.to === 'green-dancing-cat.md'
    );
    expect(edge).toBeDefined();
  });

  test('should retrieve dependencies for specific plan via API', async ({ request }) => {
    const response = await request.get(
      'http://localhost:3001/api/dependencies/green-dancing-cat.md'
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.filename).toBe('green-dancing-cat.md');
    expect(data.blockedBy).toBeDefined();
    expect(Array.isArray(data.blockedBy)).toBeTruthy();
    expect(data.blockedBy).toContain('blue-running-fox.md');
    expect(data.blocks).toBeDefined();
    expect(Array.isArray(data.blocks)).toBeTruthy();
  });

  test('should display dependency nodes on page', async ({ page }) => {
    await page.goto('/dependencies');
    await expect(page.getByRole('heading', { name: 'Dependency Graph' })).toBeVisible();

    // Wait for SVG to render
    await page.waitForTimeout(1000);

    // Check that SVG container exists
    const svg = page.locator('svg');
    await expect(svg).toBeVisible();

    // Legend should be visible
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Todo')).toBeVisible();
  });

  test('should show zoom controls', async ({ page }) => {
    await page.goto('/dependencies');
    await expect(page.getByRole('heading', { name: 'Dependency Graph' })).toBeVisible();

    // Check zoom controls exist
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    const zoomOut = page.getByRole('button', { name: 'Zoom out' });
    const reset = page.getByRole('button', { name: 'Reset view' });

    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();
    await expect(reset).toBeVisible();
  });
});

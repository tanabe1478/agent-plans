import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../lib/test-helpers';

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
    const response = await request.get(`${API_BASE_URL}/api/dependencies`);
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
    const response = await request.get(`${API_BASE_URL}/api/dependencies`);
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
      `${API_BASE_URL}/api/dependencies/green-dancing-cat.md`
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // API returns { blockedBy, blocks, chain } where blockedBy/blocks are DependencyNode arrays
    expect(data.blockedBy).toBeDefined();
    expect(Array.isArray(data.blockedBy)).toBeTruthy();
    // blockedBy is an array of DependencyNode objects with filename property
    const blockedByFilenames = data.blockedBy.map((n: any) => n.filename);
    expect(blockedByFilenames).toContain('blue-running-fox.md');
    expect(data.blocks).toBeDefined();
    expect(Array.isArray(data.blocks)).toBeTruthy();
  });

  test('should display dependency nodes on page', async ({ page }) => {
    await page.goto('/dependencies');
    await expect(page.getByRole('heading', { name: 'Dependency Graph' })).toBeVisible();

    // Wait for SVG to render
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 5000 });

    // Legend should be visible (legend items are in a flex gap-4 div with <span> elements)
    const legend = page.locator('.flex.gap-4.text-xs');
    await expect(legend.getByText('Completed')).toBeVisible();
    await expect(legend.getByText('In Progress')).toBeVisible();
    await expect(legend.getByText('Todo')).toBeVisible();
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

  test('should detect no cycle in fixture dependencies', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/dependencies`);
    expect(response.ok()).toBeTruthy();

    const graph = await response.json();
    // Fixture data has blue-running-fox -> green-dancing-cat (linear, no cycle)
    expect(graph.hasCycle).toBe(false);
  });

  test('should calculate critical path', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/dependencies`);
    expect(response.ok()).toBeTruthy();

    const graph = await response.json();
    expect(graph.criticalPath).toBeDefined();
    expect(Array.isArray(graph.criticalPath)).toBeTruthy();
    // There should be at least one item in the critical path since dependencies exist
    expect(graph.criticalPath.length).toBeGreaterThan(0);
  });

  test('should detect cycle when circular dependency exists', async ({ request }) => {
    const planA = 'test-dep-cycle-a.md';
    const planB = 'test-dep-cycle-b.md';

    try {
      // Create plan A that is blocked by plan B
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: planA,
          content: `---
status: todo
blockedBy:
  - "${planB}"
---
# Cycle Plan A

Depends on Plan B.
`,
        },
      });

      // Create plan B that is blocked by plan A (creating a cycle)
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: planB,
          content: `---
status: todo
blockedBy:
  - "${planA}"
---
# Cycle Plan B

Depends on Plan A.
`,
        },
      });

      // Check dependency graph for cycle
      const response = await request.get(`${API_BASE_URL}/api/dependencies`);
      expect(response.ok()).toBeTruthy();

      const graph = await response.json();
      expect(graph.hasCycle).toBe(true);
    } finally {
      // Clean up
      await request.delete(`${API_BASE_URL}/api/plans/${planA}`).catch(() => {});
      await request.delete(`${API_BASE_URL}/api/plans/${planB}`).catch(() => {});
    }
  });

  test('should show empty blockedBy/blocks for independent plan', async ({ request }) => {
    // red-sleeping-bear has no blockedBy in its frontmatter
    const response = await request.get(
      `${API_BASE_URL}/api/dependencies/red-sleeping-bear.md`
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // API returns { blockedBy, blocks, chain }
    expect(data.blockedBy).toBeDefined();
    expect(data.blockedBy).toHaveLength(0);
    expect(data.blocks).toBeDefined();
    expect(data.blocks).toHaveLength(0);
  });

  test('should update graph when blockedBy is added', async ({ request }) => {
    const testPlan = 'test-dep-added.md';

    try {
      // Create a plan without dependencies
      await request.post(`${API_BASE_URL}/api/plans`, {
        data: {
          filename: testPlan,
          content: `---
status: todo
---
# Test Dependency Added

No dependencies initially.
`,
        },
      });

      // Get initial graph - plan should have no dependencies
      const initialResponse = await request.get(`${API_BASE_URL}/api/dependencies/${testPlan}`);
      expect(initialResponse.ok()).toBeTruthy();
      const initialData = await initialResponse.json();
      expect(initialData.blockedBy).toHaveLength(0);

      // Update the plan to add a dependency
      await request.put(`${API_BASE_URL}/api/plans/${testPlan}`, {
        data: {
          content: `---
status: todo
blockedBy:
  - "blue-running-fox.md"
---
# Test Dependency Added

Now depends on blue-running-fox.
`,
        },
      });

      // Get updated graph - should show the new dependency
      const updatedResponse = await request.get(`${API_BASE_URL}/api/dependencies/${testPlan}`);
      expect(updatedResponse.ok()).toBeTruthy();
      const updatedData = await updatedResponse.json();
      // blockedBy is an array of DependencyNode objects with filename property
      const updatedBlockedByFilenames = updatedData.blockedBy.map((n: any) => n.filename);
      expect(updatedBlockedByFilenames).toContain('blue-running-fox.md');

      // Also check full graph for the edge
      const graphResponse = await request.get(`${API_BASE_URL}/api/dependencies`);
      expect(graphResponse.ok()).toBeTruthy();
      const graph = await graphResponse.json();
      const edge = graph.edges.find(
        (e: any) => e.from === 'blue-running-fox.md' && e.to === testPlan
      );
      expect(edge).toBeDefined();
    } finally {
      await request.delete(`${API_BASE_URL}/api/plans/${testPlan}`).catch(() => {});
    }
  });

  test('should display dependency info on plan detail page', async ({ page }) => {
    // green-dancing-cat has blockedBy: [blue-running-fox.md]
    await page.goto('/plan/green-dancing-cat.md');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: 'Mobile App Performance Optimization' }).first()).toBeVisible();

    // Check for dependency-related info on the page
    // The plan detail should show that it is blocked by blue-running-fox
    await expect(page.getByText(/blue-running-fox/).first()).toBeVisible();
  });
});

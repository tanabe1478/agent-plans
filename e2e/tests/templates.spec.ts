import { test, expect } from '@playwright/test';

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

const CUSTOM_TEMPLATE_NAME = 'test-custom-template';

test.describe('Templates functionality (Feature 12)', () => {
  test.afterEach(async ({ request }) => {
    // Clean up: try to delete custom template if created
    await request.delete(`http://localhost:3001/api/templates/${CUSTOM_TEMPLATE_NAME}`).catch(() => {});
  });

  test('should navigate to /templates page', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  });

  test('should include built-in templates in API response', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/templates');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.templates).toBeDefined();
    expect(Array.isArray(data.templates)).toBeTruthy();

    // Verify built-in templates exist
    const templateNames = data.templates.map((t: any) => t.name);
    expect(templateNames).toContain('research');
    expect(templateNames).toContain('implementation');
    expect(templateNames).toContain('refactor');
    expect(templateNames).toContain('incident');

    // Verify they are marked as built-in
    const researchTemplate = data.templates.find((t: any) => t.name === 'research');
    expect(researchTemplate.isBuiltIn).toBe(true);
  });

  test('should retrieve template content via API', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/templates/research');
    expect(response.ok()).toBeTruthy();

    const template = await response.json();
    expect(template.name).toBe('research');
    expect(template.displayName).toBeDefined();
    expect(template.description).toBeDefined();
    expect(template.content).toBeDefined();
    expect(template.category).toBe('research');
  });

  test('should create plan from template via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/templates/from-template', {
      data: {
        templateName: 'implementation',
        title: 'Test Implementation Plan',
      },
    });
    expect(response.status()).toBe(201);

    const plan = await response.json();
    expect(plan.filename).toBeDefined();
    expect(plan.content).toContain('Test Implementation Plan');

    // Clean up created plan
    await request.delete(`http://localhost:3001/api/plans/${plan.filename}`).catch(() => {});
  });

  test('should create custom template via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/templates', {
      data: {
        name: CUSTOM_TEMPLATE_NAME,
        displayName: 'Test Custom Template',
        description: 'A custom template for testing',
        category: 'custom',
        content: '# {{title}}\n\nCustom template content.',
        frontmatter: {
          status: 'todo',
          priority: 'medium',
        },
      },
    });
    expect(response.status()).toBe(201);

    const template = await response.json();
    expect(template.name).toBe(CUSTOM_TEMPLATE_NAME);
    expect(template.isBuiltIn).toBe(false);

    // Verify template was created
    const getResponse = await request.get(`http://localhost:3001/api/templates/${CUSTOM_TEMPLATE_NAME}`);
    expect(getResponse.ok()).toBeTruthy();
  });

  test('should delete custom template via API', async ({ request }) => {
    // Create custom template first
    await request.post('http://localhost:3001/api/templates', {
      data: {
        name: CUSTOM_TEMPLATE_NAME,
        displayName: 'Test Custom Template',
        description: 'A custom template for testing',
        category: 'custom',
        content: '# {{title}}\n\nCustom template content.',
      },
    });

    // Delete the template
    const deleteResponse = await request.delete(
      `http://localhost:3001/api/templates/${CUSTOM_TEMPLATE_NAME}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify template is gone
    const getResponse = await request.get(`http://localhost:3001/api/templates/${CUSTOM_TEMPLATE_NAME}`);
    expect(getResponse.status()).toBe(404);
  });

  test('should not delete built-in template', async ({ request }) => {
    const response = await request.delete('http://localhost:3001/api/templates/research');
    expect(response.status()).toBe(403);

    const error = await response.json();
    expect(error.error).toContain('Cannot delete built-in');
  });
});

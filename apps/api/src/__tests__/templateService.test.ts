import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const testDir = vi.hoisted(() => {
  const { join: pathJoin } = require('node:path');
  const { tmpdir: osTmpdir } = require('node:os');
  return pathJoin(osTmpdir(), `ccplans-template-test-${Date.now()}`);
});

// Mock config to use temp directory
vi.mock('../config.js', () => ({
  config: {
    plansDir: testDir,
    archiveDir: testDir + '/archive',
    previewLength: 200,
  },
}));

// Mock historyService
vi.mock('../services/historyService.js', () => ({
  saveVersion: vi.fn().mockResolvedValue({
    version: new Date().toISOString(),
    filename: 'mock.md',
    size: 0,
    createdAt: new Date().toISOString(),
    summary: 'mock',
  }),
}));

import {
  listTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  createPlanFromTemplate,
  getBuiltInTemplates,
} from '../services/templateService.js';

describe('templateService', () => {
  const templatesDir = join(testDir, '.templates');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await mkdir(templatesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getBuiltInTemplates', () => {
    it('should return 4 built-in templates', () => {
      const templates = getBuiltInTemplates();
      expect(templates).toHaveLength(4);
    });

    it('should include research, implementation, refactor, and incident categories', () => {
      const templates = getBuiltInTemplates();
      const categories = templates.map((t) => t.category);
      expect(categories).toContain('research');
      expect(categories).toContain('implementation');
      expect(categories).toContain('refactor');
      expect(categories).toContain('incident');
    });

    it('should mark all built-in templates as isBuiltIn', () => {
      const templates = getBuiltInTemplates();
      for (const template of templates) {
        expect(template.isBuiltIn).toBe(true);
      }
    });
  });

  describe('listTemplates', () => {
    it('should return built-in templates when no custom templates exist', async () => {
      const templates = await listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(4);
    });

    it('should include custom templates', async () => {
      const customContent = `---
displayName: "My Custom"
description: "A custom template"
category: custom
---
# Custom: {{title}}

## Content
`;
      await writeFile(join(templatesDir, 'my-custom.md'), customContent, 'utf-8');

      const templates = await listTemplates();
      const customTemplate = templates.find((t) => t.name === 'my-custom');
      expect(customTemplate).toBeDefined();
      expect(customTemplate!.displayName).toBe('My Custom');
      expect(customTemplate!.isBuiltIn).toBe(false);
    });
  });

  describe('getTemplate', () => {
    it('should return a built-in template by name', async () => {
      const template = await getTemplate('research');
      expect(template).not.toBeNull();
      expect(template!.name).toBe('research');
      expect(template!.isBuiltIn).toBe(true);
    });

    it('should return null for non-existent template', async () => {
      const template = await getTemplate('nonexistent');
      expect(template).toBeNull();
    });

    it('should return a custom template by name', async () => {
      const customContent = `---
displayName: "Test Template"
description: "For testing"
category: custom
---
# Test: {{title}}
`;
      await writeFile(join(templatesDir, 'test-tpl.md'), customContent, 'utf-8');

      const template = await getTemplate('test-tpl');
      expect(template).not.toBeNull();
      expect(template!.displayName).toBe('Test Template');
      expect(template!.isBuiltIn).toBe(false);
    });
  });

  describe('createTemplate', () => {
    it('should create a custom template file', async () => {
      const template = await createTemplate({
        name: 'new-template',
        displayName: 'New Template',
        description: 'A new template',
        category: 'custom',
        content: '# New: {{title}}\n\n## Content\n',
        frontmatter: { status: 'todo', tags: ['test'] },
      });

      expect(template.name).toBe('new-template');
      expect(template.isBuiltIn).toBe(false);

      // Verify file was created
      const files = await readdir(templatesDir);
      expect(files).toContain('new-template.md');
    });

    it('should reject invalid template names', async () => {
      await expect(
        createTemplate({
          name: '../evil',
          displayName: 'Evil',
          description: 'Bad template',
          category: 'custom',
          content: '# Evil',
          frontmatter: {},
        })
      ).rejects.toThrow('Invalid template name');
    });

    it('should not overwrite built-in templates', async () => {
      await expect(
        createTemplate({
          name: 'research',
          displayName: 'Fake Research',
          description: 'Overwrite attempt',
          category: 'research',
          content: '# Fake',
          frontmatter: {},
        })
      ).rejects.toThrow('Cannot overwrite built-in template');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a custom template', async () => {
      await writeFile(join(templatesDir, 'to-delete.md'), '# Delete me', 'utf-8');
      await deleteTemplate('to-delete');

      const files = await readdir(templatesDir);
      expect(files).not.toContain('to-delete.md');
    });

    it('should not allow deleting built-in templates', async () => {
      await expect(deleteTemplate('research')).rejects.toThrow('Cannot delete built-in template');
    });

    it('should throw for non-existent template', async () => {
      await expect(deleteTemplate('nonexistent')).rejects.toThrow();
    });
  });

  describe('createPlanFromTemplate', () => {
    it('should create a plan from a built-in template', async () => {
      const plan = await createPlanFromTemplate('research', 'My Research Topic');
      expect(plan.filename).toMatch(/\.md$/);

      // Verify the created file contains the title
      const content = await readFile(join(testDir, plan.filename), 'utf-8');
      expect(content).toContain('My Research Topic');
      expect(content).toContain('status: todo');
    });

    it('should replace {{title}} placeholder', async () => {
      const plan = await createPlanFromTemplate('implementation', 'Auth Module');
      const content = await readFile(join(testDir, plan.filename), 'utf-8');
      expect(content).toContain('Implementation: Auth Module');
      expect(content).not.toContain('{{title}}');
    });

    it('should use default title when none provided', async () => {
      const plan = await createPlanFromTemplate('research');
      const content = await readFile(join(testDir, plan.filename), 'utf-8');
      expect(content).toContain('New Plan');
    });

    it('should throw for non-existent template', async () => {
      await expect(createPlanFromTemplate('nonexistent')).rejects.toThrow('Template not found');
    });

    it('should use custom filename if provided', async () => {
      const plan = await createPlanFromTemplate('research', 'Test', 'custom-filename.md');
      expect(plan.filename).toBe('custom-filename.md');
    });

    it('should include template frontmatter in the plan', async () => {
      const plan = await createPlanFromTemplate('incident', 'Server Down');
      const content = await readFile(join(testDir, plan.filename), 'utf-8');
      expect(content).toContain('status: in_progress');
      expect(content).toContain('priority: critical');
    });
  });
});

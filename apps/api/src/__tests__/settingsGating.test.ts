import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Mock auditService
vi.mock('../services/auditService.js', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

// vi.hoisted runs before vi.mock hoisting, so testDir is available in the mock factory
const testDir = vi.hoisted(() => {
  const path = require('node:path');
  const os = require('node:os');
  return path.join(os.tmpdir(), `ccplans-gating-test-${Date.now()}`);
});

vi.mock('../config.js', () => ({
  config: {
    plansDir: testDir,
    previewLength: 200,
  },
}));

import { clearFileStateCache } from '../services/conflictService.js';
import { PlanService } from '../services/planService.js';
import { resetSettingsCache, updateSettings } from '../services/settingsService.js';

const PLAN_WITH_FRONTMATTER = `---
created: "2025-01-01T00:00:00Z"
status: todo
estimate: "3d"
---
# Test Plan

Some content here.
`;

describe('Frontmatter gating', () => {
  let service: PlanService;

  beforeEach(async () => {
    clearFileStateCache();
    resetSettingsCache();
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'test-plan.md'), PLAN_WITH_FRONTMATTER, 'utf-8');
    service = new PlanService(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getPlanMeta', () => {
    it('returns frontmatter: undefined when disabled (default)', async () => {
      const meta = await service.getPlanMeta('test-plan.md');
      expect(meta.frontmatter).toBeUndefined();
      expect(meta.title).toBe('Test Plan');
    });

    it('returns frontmatter when enabled', async () => {
      await updateSettings({ frontmatterEnabled: true });
      const meta = await service.getPlanMeta('test-plan.md');
      expect(meta.frontmatter).toBeDefined();
      expect(meta.frontmatter?.status).toBe('todo');
      expect(meta.frontmatter?.estimate).toBe('3d');
    });
  });

  describe('getPlan', () => {
    it('returns frontmatter: undefined when disabled', async () => {
      const plan = await service.getPlan('test-plan.md');
      expect(plan.frontmatter).toBeUndefined();
      expect(plan.content).toContain('Some content here.');
    });

    it('returns frontmatter when enabled', async () => {
      await updateSettings({ frontmatterEnabled: true });
      const plan = await service.getPlan('test-plan.md');
      expect(plan.frontmatter).toBeDefined();
      expect(plan.frontmatter?.estimate).toBe('3d');
    });
  });
});

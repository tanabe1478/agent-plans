import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArchiveService } from '../../services/archiveService.js';
import {
  PlanService,
  type PlanServiceConfig,
  type PlanServiceDependencies,
} from '../../services/planService.js';
import { SettingsService } from '../../services/settingsService.js';

describe('PlanService', () => {
  let tempDir: string;
  let plansDir: string;
  let secondaryPlansDir: string;
  let archiveDir: string;
  let planService: PlanService;
  let archiveService: ArchiveService;
  let settingsService: SettingsService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `ccplans-test-${Date.now()}`);
    plansDir = join(tempDir, 'plans');
    secondaryPlansDir = join(plansDir, 'secondary');
    archiveDir = join(tempDir, 'archive');
    await mkdir(plansDir, { recursive: true });
    await mkdir(secondaryPlansDir, { recursive: true });
    await mkdir(archiveDir, { recursive: true });

    // Create services with DI
    const config: PlanServiceConfig = {
      plansDir,
      archiveDir,
      previewLength: 200,
    };

    archiveService = new ArchiveService({
      plansDir,
      archiveDir,
      archiveRetentionDays: 30,
    });

    settingsService = new SettingsService({ plansDir });

    const deps: PlanServiceDependencies = {
      archiveService,
      settingsService,
    };

    planService = new PlanService(config, deps);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('listPlans', () => {
    it('should return empty array when no plans exist', async () => {
      const plans = await planService.listPlans();
      expect(plans).toEqual([]);
    });

    it('should list all markdown files in plans directory', async () => {
      // Create test plans
      await writeFile(
        join(plansDir, 'test-plan-1.md'),
        '---\nstatus: todo\n---\n\n# Test Plan 1\n\nContent here.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'test-plan-2.md'),
        '---\nstatus: in_progress\n---\n\n# Test Plan 2\n\nMore content.',
        'utf-8'
      );

      const plans = await planService.listPlans();
      expect(plans).toHaveLength(2);
      expect(plans.map((p) => p.filename)).toContain('test-plan-1.md');
      expect(plans.map((p) => p.filename)).toContain('test-plan-2.md');
    });

    it('should list markdown files from multiple configured directories', async () => {
      await settingsService.updateSettings({
        planDirectories: [plansDir, secondaryPlansDir],
      });

      await writeFile(join(plansDir, 'primary.md'), '# Primary', 'utf-8');
      await writeFile(join(secondaryPlansDir, 'secondary.md'), '# Secondary', 'utf-8');

      const plans = await planService.listPlans();
      expect(plans.map((plan) => plan.filename).sort()).toEqual(['primary.md', 'secondary.md']);
    });
  });

  describe('getPlan', () => {
    it('should return plan detail with content', async () => {
      await writeFile(
        join(plansDir, 'test-plan.md'),
        '---\nstatus: todo\n---\n\n# Test Plan\n\nThis is the content.',
        'utf-8'
      );

      const plan = await planService.getPlan('test-plan.md');
      expect(plan.filename).toBe('test-plan.md');
      expect(plan.title).toBe('Test Plan');
      expect(plan.content).toContain('This is the content.');
    });

    it('should throw error for invalid filename', async () => {
      await expect(planService.getPlan('../invalid.md')).rejects.toThrow('Invalid filename');
    });

    it('should normalize legacy status values from frontmatter', async () => {
      await writeFile(
        join(plansDir, 'legacy-status.md'),
        '---\nstatus: draft\n---\n\n# Legacy Plan\n\nLegacy content.',
        'utf-8'
      );

      const plan = await planService.getPlan('legacy-status.md');
      expect(plan.frontmatter?.status).toBe('todo');
    });
  });

  describe('createPlan', () => {
    it('should create a new plan file', async () => {
      const content = '# New Plan\n\nThis is a new plan.';
      const plan = await planService.createPlan(content, 'new-plan.md');

      expect(plan.filename).toBe('new-plan.md');
      expect(plan.title).toBe('New Plan');
    });
  });

  describe('updatePlan', () => {
    it('should update existing plan', async () => {
      await writeFile(
        join(plansDir, 'existing-plan.md'),
        '---\nstatus: todo\n---\n\n# Original Title\n\nOriginal content.',
        'utf-8'
      );

      const newContent = '---\nstatus: todo\n---\n\n# Updated Title\n\nUpdated content.';
      const plan = await planService.updatePlan('existing-plan.md', newContent);

      expect(plan.title).toBe('Updated Title');
    });

    it('should update plan from a secondary configured directory', async () => {
      await settingsService.updateSettings({
        planDirectories: [plansDir, secondaryPlansDir],
      });

      await writeFile(
        join(secondaryPlansDir, 'secondary-plan.md'),
        '---\nstatus: todo\n---\n\n# Secondary Title\n\nOriginal content.',
        'utf-8'
      );

      await planService.updatePlan(
        'secondary-plan.md',
        '---\nstatus: todo\n---\n\n# Updated Secondary\n\nUpdated content.'
      );

      const updated = await planService.getPlan('secondary-plan.md');
      expect(updated.title).toBe('Updated Secondary');
    });
  });

  describe('deletePlan', () => {
    it('should permanently delete plan when archive is false', async () => {
      await writeFile(join(plansDir, 'to-delete.md'), '# To Delete', 'utf-8');

      await planService.deletePlan('to-delete.md', false);

      await expect(stat(join(plansDir, 'to-delete.md'))).rejects.toThrow();
    });

    it('should move plan to archive when archive is true', async () => {
      await writeFile(join(plansDir, 'to-archive.md'), '# To Archive', 'utf-8');

      await planService.deletePlan('to-archive.md', true);

      await expect(stat(join(plansDir, 'to-archive.md'))).rejects.toThrow();
      await expect(stat(join(archiveDir, 'to-archive.md'))).resolves.toBeDefined();
    });
  });

  describe('validateFilename', () => {
    it('should reject filenames with path traversal', async () => {
      await expect(planService.getPlan('../secret.md')).rejects.toThrow('Invalid filename');
      await expect(planService.getPlan('..%2Fsecret.md')).rejects.toThrow('Invalid filename');
    });

    it('should reject filenames without .md extension', async () => {
      await expect(planService.getPlan('invalid')).rejects.toThrow('Invalid filename');
    });

    it('should accept valid filenames', async () => {
      await writeFile(join(plansDir, 'valid-name.md'), '# Valid', 'utf-8');
      const plan = await planService.getPlan('valid-name.md');
      expect(plan.filename).toBe('valid-name.md');
    });
  });
});

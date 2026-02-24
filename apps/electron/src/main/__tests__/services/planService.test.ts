import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArchiveService } from '../../services/archiveService.js';
import { CodexSessionService } from '../../services/codexSessionService.js';
import { MetadataService } from '../../services/metadataService.js';
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
  let codexSessionsDir: string;
  let archiveDir: string;
  let planService: PlanService;
  let archiveService: ArchiveService;
  let settingsService: SettingsService;
  let metadataService: MetadataService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `agent-plans-test-${Date.now()}`);
    plansDir = join(tempDir, 'plans');
    secondaryPlansDir = join(plansDir, 'secondary');
    codexSessionsDir = join(tempDir, 'codex-sessions');
    archiveDir = join(tempDir, 'archive');
    await mkdir(plansDir, { recursive: true });
    await mkdir(secondaryPlansDir, { recursive: true });
    await mkdir(codexSessionsDir, { recursive: true });
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
    metadataService = new MetadataService(join(tempDir, 'metadata.db'));

    const deps: PlanServiceDependencies = {
      archiveService,
      settingsService,
      metadataService,
      codexSessionService: new CodexSessionService({ maxSessionFiles: 50 }),
    };

    planService = new PlanService(config, deps);
  });

  afterEach(async () => {
    metadataService.close();
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

    it('should preserve plan status when directory is removed and re-added', async () => {
      await settingsService.updateSettings({
        planDirectories: [plansDir, secondaryPlansDir],
      });

      await writeFile(join(plansDir, 'keep-status-a.md'), '# Keep Status A', 'utf-8');
      await writeFile(join(plansDir, 'keep-status-b.md'), '# Keep Status B', 'utf-8');
      await writeFile(join(secondaryPlansDir, 'secondary-only.md'), '# Secondary', 'utf-8');

      await planService.updateStatus('keep-status-a.md', 'in_progress');
      await planService.updateStatus('keep-status-b.md', 'review');

      await settingsService.updateSettings({
        planDirectories: [secondaryPlansDir],
      });
      await planService.listPlans();

      await settingsService.updateSettings({
        planDirectories: [plansDir],
      });
      const plans = await planService.listPlans();

      expect(plans.find((plan) => plan.filename === 'keep-status-a.md')?.metadata.status).toBe(
        'in_progress'
      );
      expect(plans.find((plan) => plan.filename === 'keep-status-b.md')?.metadata.status).toBe(
        'review'
      );
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

    it('should return metadata from DB, not from file content', async () => {
      await writeFile(
        join(plansDir, 'legacy-status.md'),
        '# Legacy Plan\n\nLegacy content.',
        'utf-8'
      );

      const plan = await planService.getPlan('legacy-status.md');
      // Metadata comes from DB (empty when no MetadataService)
      expect(plan.metadata).toEqual({});
    });

    it('should load codex plan detail when integration is enabled', async () => {
      await settingsService.updateSettings({
        codexIntegrationEnabled: true,
        codexSessionLogDirectories: [codexSessionsDir],
      });

      const sessionPath = join(codexSessionsDir, 'session-a.jsonl');
      await writeFile(
        sessionPath,
        [
          JSON.stringify({
            timestamp: '2026-02-16T08:10:00.000Z',
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: '<proposed_plan>\n# Codex ReadOnly Plan\n\n## Step\n- [ ] verify\n</proposed_plan>',
                },
              ],
            },
          }),
        ].join('\n'),
        'utf-8'
      );

      const plans = await planService.listPlans();
      const codexPlan = plans.find((plan) => plan.source === 'codex');

      expect(codexPlan).toBeDefined();
      if (!codexPlan) {
        throw new Error('Expected Codex plan');
      }
      const detail = await planService.getPlan(codexPlan.filename);
      expect(detail.readOnly).toBe(true);
      expect(detail.content).toContain('Codex ReadOnly Plan');
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

  describe('createPlan with defaultPlanStatus', () => {
    it('should use configured defaultPlanStatus from settings', async () => {
      await settingsService.updateSettings({ defaultPlanStatus: 'in_progress' });

      const content = '# Plan With Custom Default\n\nContent here.';
      const plan = await planService.createPlan(content, 'custom-default.md');

      expect(plan.metadata.status).toBe('in_progress');
    });

    it('should default to todo when no defaultPlanStatus configured', async () => {
      const content = '# Plan With Fallback\n\nContent here.';
      const plan = await planService.createPlan(content, 'fallback-default.md');

      expect(plan.metadata.status).toBe('todo');
    });
  });

  describe('syncMetadataOnChange', () => {
    it('should reset status when title changes (different plan)', async () => {
      const content = '# Original Plan\n\nContent.';
      await planService.createPlan(content, 'sync-test-plan.md');
      await planService.updateStatus('sync-test-plan.md', 'completed');

      let plan = await planService.getPlanMeta('sync-test-plan.md');
      expect(plan.metadata.status).toBe('completed');

      // Overwrite with a different title
      await writeFile(
        join(plansDir, 'sync-test-plan.md'),
        '# Completely Different Plan\n\nNew content.',
        'utf-8'
      );

      await planService.syncMetadataOnChange('sync-test-plan.md');

      plan = await planService.getPlanMeta('sync-test-plan.md');
      expect(plan.metadata.status).toBe('todo');
    });

    it('should use defaultPlanStatus when title changes', async () => {
      await settingsService.updateSettings({ defaultPlanStatus: 'review' });

      const content = '# Plan A\n\nContent.';
      await planService.createPlan(content, 'title-change-default.md');
      await planService.updateStatus('title-change-default.md', 'completed');

      // Overwrite with a different title
      await writeFile(
        join(plansDir, 'title-change-default.md'),
        '# Plan B\n\nDifferent content.',
        'utf-8'
      );

      await planService.syncMetadataOnChange('title-change-default.md');

      const plan = await planService.getPlanMeta('title-change-default.md');
      expect(plan.metadata.status).toBe('review');
    });

    it('should preserve status when title stays the same (content-only edit)', async () => {
      const content = '# Keep Status Plan\n\nContent.';
      await planService.createPlan(content, 'no-reset.md');
      await planService.updateStatus('no-reset.md', 'completed');

      // Edit content but keep the same title
      await writeFile(
        join(plansDir, 'no-reset.md'),
        '# Keep Status Plan\n\nEdited content by user.',
        'utf-8'
      );

      await planService.syncMetadataOnChange('no-reset.md');

      const plan = await planService.getPlanMeta('no-reset.md');
      expect(plan.metadata.status).toBe('completed');
    });

    it('should do nothing for non-existent files', async () => {
      await planService.syncMetadataOnChange('nonexistent.md');
    });
  });

  describe('createPlan stores title in DB', () => {
    it('should save the extracted title to metadata', async () => {
      const content = '# My New Plan\n\nSome content.';
      await planService.createPlan(content, 'title-test.md');

      const meta = metadataService.getMetadata('title-test.md');
      expect(meta?.title).toBe('My New Plan');
    });
  });

  describe('updatePlan updates title in DB', () => {
    it('should update the title in metadata after content change', async () => {
      await writeFile(join(plansDir, 'update-title.md'), '# Before\n\nContent.', 'utf-8');
      // Ensure DB metadata exists
      const now = new Date().toISOString();
      metadataService.upsertMetadata('update-title.md', {
        source: 'markdown',
        status: 'todo',
        title: 'Before',
        createdAt: now,
        modifiedAt: now,
      });

      await planService.updatePlan('update-title.md', '# After\n\nUpdated content.');

      const meta = metadataService.getMetadata('update-title.md');
      expect(meta?.title).toBe('After');
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

    it('should reject updating codex read-only plans', async () => {
      await settingsService.updateSettings({
        codexIntegrationEnabled: true,
        codexSessionLogDirectories: [codexSessionsDir],
      });

      const sessionPath = join(codexSessionsDir, 'session-readonly.jsonl');
      await writeFile(
        sessionPath,
        [
          JSON.stringify({
            timestamp: '2026-02-16T10:10:00.000Z',
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: '<proposed_plan>\n# ReadOnly Target\n\n- body\n</proposed_plan>',
                },
              ],
            },
          }),
        ].join('\n'),
        'utf-8'
      );

      const plans = await planService.listPlans();
      const target = plans.find((plan) => plan.source === 'codex');
      expect(target).toBeDefined();
      if (!target) {
        throw new Error('Expected read-only target plan');
      }

      await expect(planService.updatePlan(target.filename, '# New Body')).rejects.toThrow(
        'read-only'
      );
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

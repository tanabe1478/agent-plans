import { describe, expect, it } from 'vitest';

describe('Utility Services Import Tests', () => {
  describe('nameGenerator', () => {
    it('should export generatePlanName function', async () => {
      const { generatePlanName } = await import('../nameGenerator.js');
      expect(typeof generatePlanName).toBe('function');
    });

    it('should generate valid plan names', async () => {
      const { generatePlanName } = await import('../nameGenerator.js');
      const name = generatePlanName();
      expect(name).toMatch(/^[a-z]+-[a-z]+-[a-z]+\.md$/);
    });
  });

  describe('validationService', () => {
    it('should export validateFrontmatter function', async () => {
      const { validateFrontmatter } = await import('../validationService.js');
      expect(typeof validateFrontmatter).toBe('function');
    });

    it('should export autoCorrectFrontmatter function', async () => {
      const { autoCorrectFrontmatter } = await import('../validationService.js');
      expect(typeof autoCorrectFrontmatter).toBe('function');
    });

    it('should validate correct frontmatter', async () => {
      const { validateFrontmatter } = await import('../validationService.js');
      const result = validateFrontmatter({ status: 'todo' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return corrected frontmatter for invalid data', async () => {
      const { validateFrontmatter } = await import('../validationService.js');
      const result = validateFrontmatter({ status: 'invalid_status' });
      expect(result.valid).toBe(false);
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.status).toBe('todo');
    });
  });

  describe('auditService', () => {
    it('should export log function', async () => {
      const { log } = await import('../auditService.js');
      expect(typeof log).toBe('function');
    });

    it('should export getAuditLog function', async () => {
      const { getAuditLog } = await import('../auditService.js');
      expect(typeof getAuditLog).toBe('function');
    });
  });

  describe('conflictService', () => {
    it('should export recordFileState function', async () => {
      const { recordFileState } = await import('../conflictService.js');
      expect(typeof recordFileState).toBe('function');
    });

    it('should export checkConflict function', async () => {
      const { checkConflict } = await import('../conflictService.js');
      expect(typeof checkConflict).toBe('function');
    });

    it('should export clearFileStateCache function', async () => {
      const { clearFileStateCache } = await import('../conflictService.js');
      expect(typeof clearFileStateCache).toBe('function');
    });
  });

  describe('migrationService', () => {
    it('should export getCurrentSchemaVersion function', async () => {
      const { getCurrentSchemaVersion } = await import('../migrationService.js');
      expect(typeof getCurrentSchemaVersion).toBe('function');
    });

    it('should export needsMigration function', async () => {
      const { needsMigration } = await import('../migrationService.js');
      expect(typeof needsMigration).toBe('function');
    });

    it('should export migrate function', async () => {
      const { migrate } = await import('../migrationService.js');
      expect(typeof migrate).toBe('function');
    });

    it('should export migrateAllPlans function', async () => {
      const { migrateAllPlans } = await import('../migrationService.js');
      expect(typeof migrateAllPlans).toBe('function');
    });

    it('should return current schema version', async () => {
      const { getCurrentSchemaVersion } = await import('../migrationService.js');
      expect(getCurrentSchemaVersion()).toBe(1);
    });
  });

  describe('exportService', () => {
    it('should export exportAsJson function', async () => {
      const { exportAsJson } = await import('../exportService.js');
      expect(typeof exportAsJson).toBe('function');
    });

    it('should export exportAsCsv function', async () => {
      const { exportAsCsv } = await import('../exportService.js');
      expect(typeof exportAsCsv).toBe('function');
    });

    it('should export exportAsTarGz function', async () => {
      const { exportAsTarGz } = await import('../exportService.js');
      expect(typeof exportAsTarGz).toBe('function');
    });
  });

  describe('openerService', () => {
    it('should export OpenerService class', async () => {
      const { OpenerService } = await import('../openerService.js');
      expect(typeof OpenerService).toBe('function');
    });

    it('should export openerService instance', async () => {
      const { openerService } = await import('../openerService.js');
      expect(openerService).toBeDefined();
      expect(typeof openerService.openFile).toBe('function');
    });
  });
});

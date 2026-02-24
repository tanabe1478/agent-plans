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
    it('should export validateMetadata function', async () => {
      const { validateMetadata } = await import('../validationService.js');
      expect(typeof validateMetadata).toBe('function');
    });

    it('should export autoCorrectMetadata function', async () => {
      const { autoCorrectMetadata } = await import('../validationService.js');
      expect(typeof autoCorrectMetadata).toBe('function');
    });

    it('should validate correct metadata', async () => {
      const { validateMetadata } = await import('../validationService.js');
      const result = validateMetadata({ status: 'todo' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return corrected metadata for invalid data', async () => {
      const { validateMetadata } = await import('../validationService.js');
      // priority has an enum constraint, so an invalid value should fail
      const result = validateMetadata({ priority: 'invalid_priority' });
      expect(result.valid).toBe(false);
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.priority).toBe('medium');
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

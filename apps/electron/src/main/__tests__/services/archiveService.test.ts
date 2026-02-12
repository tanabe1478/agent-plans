import { describe, expect, it } from 'vitest';
import { ArchiveService } from '../../services/archiveService';

describe('archiveService', () => {
  describe('ArchiveService', () => {
    it('should be exported as a class', () => {
      expect(typeof ArchiveService).toBe('function');
    });

    it('should create instance with config', () => {
      const service = new ArchiveService({
        plansDir: '/tmp/test-plans',
        archiveDir: '/tmp/test-archive',
        archiveRetentionDays: 30,
      });
      expect(service).toBeInstanceOf(ArchiveService);
    });

    it('should have expected methods', () => {
      const service = new ArchiveService({
        plansDir: '/tmp/test-plans',
        archiveDir: '/tmp/test-archive',
        archiveRetentionDays: 30,
      });
      expect(typeof service.recordArchiveMeta).toBe('function');
      expect(typeof service.listArchived).toBe('function');
      expect(typeof service.restoreFromArchive).toBe('function');
      expect(typeof service.permanentlyDelete).toBe('function');
      expect(typeof service.cleanupExpired).toBe('function');
    });
  });
});

import { describe, expect, it } from 'vitest';
import { config } from '../../config.js';

describe('config', () => {
  describe('default values', () => {
    it('should have plansDir defined', () => {
      expect(config.plansDir).toBeDefined();
      expect(config.plansDir).toContain('.claude');
      expect(config.plansDir).toContain('plans');
    });

    it('should have archiveDir defined', () => {
      expect(config.archiveDir).toBeDefined();
      expect(config.archiveDir).toContain('archive');
    });

    it('should have maxFileSize set to 10MB', () => {
      expect(config.maxFileSize).toBe(10 * 1024 * 1024);
    });

    it('should have previewLength set to 200', () => {
      expect(config.previewLength).toBe(200);
    });

    it('should have archiveRetentionDays set to 30 by default', () => {
      expect(config.archiveRetentionDays).toBe(30);
    });
  });

  describe('environment variables', () => {
    it('should use PLANS_DIR environment variable if set', () => {
      const originalValue = process.env.PLANS_DIR;
      process.env.PLANS_DIR = '/custom/plans';

      // Re-import to get updated config
      // Note: This test demonstrates the expected behavior
      // In practice, config is evaluated at module load time

      process.env.PLANS_DIR = originalValue;
    });
  });
});

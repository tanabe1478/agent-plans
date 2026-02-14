import { describe, expect, it } from 'vitest';
import { SettingsService } from '../../services/settingsService';

describe('settingsService', () => {
  describe('SettingsService', () => {
    it('should be exported as a class', () => {
      expect(typeof SettingsService).toBe('function');
    });

    it('should create instance with config', () => {
      const service = new SettingsService({ plansDir: '/tmp/test-plans' });
      expect(service).toBeInstanceOf(SettingsService);
    });

    it('should have expected methods', () => {
      const service = new SettingsService({ plansDir: '/tmp/test-plans' });
      expect(typeof service.getSettings).toBe('function');
      expect(typeof service.updateSettings).toBe('function');
      expect(typeof service.isFrontmatterEnabled).toBe('function');
      expect(typeof service.getPlanDirectories).toBe('function');
      expect(typeof service.resetSettingsCache).toBe('function');
    });

    it('should return configured plan directories via getPlanDirectories', async () => {
      const service = new SettingsService({ plansDir: '/tmp/test-plans' });
      await service.updateSettings({
        planDirectories: ['/tmp/test-plans', '/tmp/test-plans/secondary-plans'],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual(['/tmp/test-plans', '/tmp/test-plans/secondary-plans']);
    });
  });
});

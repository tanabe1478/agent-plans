import { describe, expect, it } from 'vitest';
import { SettingsService } from '../../services/settingsService';

function createService(): SettingsService {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new SettingsService({ plansDir: `/tmp/test-plans-${nonce}` });
}

describe('settingsService', () => {
  describe('SettingsService', () => {
    it('should be exported as a class', () => {
      expect(typeof SettingsService).toBe('function');
    });

    it('should create instance with config', () => {
      const service = createService();
      expect(service).toBeInstanceOf(SettingsService);
    });

    it('should have expected methods', () => {
      const service = createService();
      expect(typeof service.getSettings).toBe('function');
      expect(typeof service.updateSettings).toBe('function');
      expect(typeof service.getPlanDirectories).toBe('function');
      expect(typeof service.resetSettingsCache).toBe('function');
    });

    it('should return configured plan directories via getPlanDirectories', async () => {
      const service = createService();
      await service.updateSettings({
        planDirectories: ['/tmp/base-plans', '/tmp/base-plans/secondary-plans'],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual(['/tmp/base-plans', '/tmp/base-plans/secondary-plans']);
    });

    it('should keep plan directories outside base path', async () => {
      const service = new SettingsService({ plansDir: '/tmp/base-plans' });
      await service.updateSettings({
        planDirectories: ['/tmp/base-plans', '/tmp/another-plans'],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual(['/tmp/base-plans', '/tmp/another-plans']);
    });

    it('should deduplicate plan directories while preserving first-seen order', async () => {
      const service = createService();
      await service.updateSettings({
        planDirectories: ['/tmp/plans-a', '/tmp/plans-b', '/tmp/plans-a'],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual(['/tmp/plans-a', '/tmp/plans-b']);
    });

    it('should expose codex integration defaults', async () => {
      const service = createService();
      const settings = await service.getSettings();

      expect(settings.codexIntegrationEnabled).toBe(false);
      expect(settings.codexSessionLogDirectories?.[0]).toContain('/.codex/sessions');
      expect(settings.themeMode).toBe('system');
      expect(settings.customStylesheetPath).toBeNull();
    });

    it('should normalize codex session directories', async () => {
      const service = createService();
      await service.updateSettings({
        codexSessionLogDirectories: ['/tmp/codex-logs', '/tmp/codex-logs', ''],
      });

      const settings = await service.getSettings();
      expect(settings.codexSessionLogDirectories).toEqual(['/tmp/codex-logs']);
    });

    it('should normalize appearance settings', async () => {
      const service = createService();
      await service.updateSettings({
        themeMode: 'monokai',
        customStylesheetPath: '~/styles/custom.css',
      });

      const settings = await service.getSettings();
      expect(settings.themeMode).toBe('monokai');
      expect(settings.customStylesheetPath).toContain('/styles/custom.css');
    });
  });
});

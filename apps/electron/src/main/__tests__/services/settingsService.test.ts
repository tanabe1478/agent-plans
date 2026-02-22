import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SettingsService } from '../../services/settingsService';

function createService(): SettingsService {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new SettingsService({ plansDir: join(tmpdir(), `test-plans-${nonce}`) });
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
      const basePlans = join(tmpdir(), 'base-plans');
      const secondaryPlans = join(basePlans, 'secondary-plans');
      await service.updateSettings({
        planDirectories: [basePlans, secondaryPlans],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual([basePlans, secondaryPlans]);
    });

    it('should keep plan directories outside base path', async () => {
      const basePlans = join(tmpdir(), 'base-plans');
      const anotherPlans = join(tmpdir(), 'another-plans');
      const service = new SettingsService({ plansDir: basePlans });
      await service.updateSettings({
        planDirectories: [basePlans, anotherPlans],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual([basePlans, anotherPlans]);
    });

    it('should deduplicate plan directories while preserving first-seen order', async () => {
      const service = createService();
      const plansA = join(tmpdir(), 'plans-a');
      const plansB = join(tmpdir(), 'plans-b');
      await service.updateSettings({
        planDirectories: [plansA, plansB, plansA],
      });

      const directories = await service.getPlanDirectories();
      expect(directories).toEqual([plansA, plansB]);
    });

    it('should expose codex integration defaults', async () => {
      const service = createService();
      const settings = await service.getSettings();

      expect(settings.codexIntegrationEnabled).toBe(false);
      // The path should contain .codex and sessions, regardless of separator
      const codexDir = settings.codexSessionLogDirectories?.[0] ?? '';
      expect(codexDir).toContain('.codex');
      expect(codexDir).toContain('sessions');
      expect(settings.themeMode).toBe('system');
      expect(settings.customStylesheetPath).toBeNull();
    });

    it('should normalize codex session directories', async () => {
      const service = createService();
      const codexLogs = join(tmpdir(), 'codex-logs');
      await service.updateSettings({
        codexSessionLogDirectories: [codexLogs, codexLogs, ''],
      });

      const settings = await service.getSettings();
      expect(settings.codexSessionLogDirectories).toEqual([codexLogs]);
    });

    it('should normalize appearance settings', async () => {
      const service = createService();
      await service.updateSettings({
        themeMode: 'monokai',
        customStylesheetPath: '~/styles/custom.css',
      });

      const settings = await service.getSettings();
      expect(settings.themeMode).toBe('monokai');
      // The path should contain styles and custom.css, regardless of separator
      const stylePath = settings.customStylesheetPath ?? '';
      expect(stylePath).toContain('styles');
      expect(stylePath).toContain('custom.css');
    });

    it('should default savedSearches to empty array', async () => {
      const service = createService();
      const settings = await service.getSettings();
      expect(settings.savedSearches).toEqual([]);
    });

    it('should normalize savedSearches stripping invalid entries', async () => {
      const service = createService();
      await service.updateSettings({
        savedSearches: [
          { name: 'Valid', query: 'status:todo' },
          { name: '', query: 'bad' },
          { name: 'No query', query: '' },
          null as any,
          42 as any,
          { name: 'Also Valid', query: 'keyword' },
        ],
      });

      const settings = await service.getSettings();
      expect(settings.savedSearches).toEqual([
        { name: 'Valid', query: 'status:todo' },
        { name: 'Also Valid', query: 'keyword' },
      ]);
    });
  });
});

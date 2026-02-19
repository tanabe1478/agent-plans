import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../../shared/shortcutDefaults.js';
import {
  getSettings,
  selectPlanDirectory,
  selectStylesheetFile,
  updateSettings,
} from '../../services/settingsService.js';
import { loadStylesheet } from '../../services/stylesheetService.js';
import { registerSettingsHandlers } from '../settings.js';

vi.mock('../../services/settingsService.js', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  selectPlanDirectory: vi.fn(),
  selectStylesheetFile: vi.fn(),
}));
vi.mock('../../services/stylesheetService.js', () => ({
  loadStylesheet: vi.fn(),
}));

describe('Settings IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  function getRegisteredHandler(channel: string) {
    return mockIpcMain.handle.mock.calls.find((call) => call[0] === channel)?.[1] as
      | ((...args: unknown[]) => unknown)
      | undefined;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    registerSettingsHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register settings:get handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('settings:get', expect.any(Function));
  });

  it('should register settings:update handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('settings:update', expect.any(Function));
  });

  it('should register settings:selectDirectory handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'settings:selectDirectory',
      expect.any(Function)
    );
  });

  it('should register settings:selectStylesheet handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'settings:selectStylesheet',
      expect.any(Function)
    );
  });

  it('should register settings:loadStylesheet handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'settings:loadStylesheet',
      expect.any(Function)
    );
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(5);
  });

  it('should return plain settings object from settings:get', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({
      planDirectories: ['/tmp/test-plans'],
      shortcuts: DEFAULT_SHORTCUTS,
    });
    const handler = getRegisteredHandler('settings:get');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never);

    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      planDirectories: ['/tmp/test-plans'],
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it('should return plain settings object from settings:update', async () => {
    vi.mocked(updateSettings).mockResolvedValueOnce({
      planDirectories: ['/tmp/updated-plans'],
      shortcuts: DEFAULT_SHORTCUTS,
    });
    const handler = getRegisteredHandler('settings:update');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never, {
      planDirectories: ['/tmp/updated-plans'],
    });

    expect(updateSettings).toHaveBeenCalledWith({
      planDirectories: ['/tmp/updated-plans'],
    });
    expect(result).toEqual({
      planDirectories: ['/tmp/updated-plans'],
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it('should return selected directory path from settings:selectDirectory', async () => {
    vi.mocked(selectPlanDirectory).mockResolvedValueOnce('/tmp/selected-plans');
    const handler = getRegisteredHandler('settings:selectDirectory');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never, '/tmp/current');

    expect(selectPlanDirectory).toHaveBeenCalledWith('/tmp/current');
    expect(result).toEqual('/tmp/selected-plans');
  });

  it('should return selected stylesheet path from settings:selectStylesheet', async () => {
    vi.mocked(selectStylesheetFile).mockResolvedValueOnce('/tmp/theme.css');
    const handler = getRegisteredHandler('settings:selectStylesheet');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never, '/tmp/current.css');

    expect(selectStylesheetFile).toHaveBeenCalledWith('/tmp/current.css');
    expect(result).toEqual('/tmp/theme.css');
  });

  it('should load stylesheet via settings:loadStylesheet', async () => {
    vi.mocked(loadStylesheet).mockResolvedValueOnce({
      ok: true,
      path: '/tmp/theme.css',
      cssText: 'body { color: #111; }',
    });
    const handler = getRegisteredHandler('settings:loadStylesheet');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never, '/tmp/theme.css');

    expect(loadStylesheet).toHaveBeenCalledWith('/tmp/theme.css');
    expect(result).toEqual({
      ok: true,
      path: '/tmp/theme.css',
      cssText: 'body { color: #111; }',
    });
  });
});

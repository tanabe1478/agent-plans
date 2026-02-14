import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSettings,
  selectPlanDirectory,
  updateSettings,
} from '../../services/settingsService.js';
import { registerSettingsHandlers } from '../settings.js';

vi.mock('../../services/settingsService.js', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  selectPlanDirectory: vi.fn(),
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

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(3);
  });

  it('should return plain settings object from settings:get', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({
      frontmatterEnabled: true,
      planDirectories: ['/tmp/test-plans'],
    });
    const handler = getRegisteredHandler('settings:get');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never);

    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      frontmatterEnabled: true,
      planDirectories: ['/tmp/test-plans'],
    });
  });

  it('should return plain settings object from settings:update', async () => {
    vi.mocked(updateSettings).mockResolvedValueOnce({
      frontmatterEnabled: false,
      planDirectories: ['/tmp/updated-plans'],
    });
    const handler = getRegisteredHandler('settings:update');

    expect(handler).toBeDefined();
    const result = await handler?.({} as never, {
      frontmatterEnabled: false,
      planDirectories: ['/tmp/updated-plans'],
    });

    expect(updateSettings).toHaveBeenCalledWith({
      frontmatterEnabled: false,
      planDirectories: ['/tmp/updated-plans'],
    });
    expect(result).toEqual({
      frontmatterEnabled: false,
      planDirectories: ['/tmp/updated-plans'],
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
});

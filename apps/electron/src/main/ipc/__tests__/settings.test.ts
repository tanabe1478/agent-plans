import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSettingsHandlers } from '../settings.js';

vi.mock('../../services/settingsService.js', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

describe('Settings IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

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

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(2);
  });
});

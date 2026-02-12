import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerArchiveHandlers } from '../archive.js';

vi.mock('../../services/archiveService.js', () => ({
  listArchived: vi.fn(),
  restoreFromArchive: vi.fn(),
  permanentlyDelete: vi.fn(),
  cleanupExpired: vi.fn(),
}));

describe('Archive IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerArchiveHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register archive:list handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('archive:list', expect.any(Function));
  });

  it('should register archive:restore handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('archive:restore', expect.any(Function));
  });

  it('should register archive:delete handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('archive:delete', expect.any(Function));
  });

  it('should register archive:cleanup handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('archive:cleanup', expect.any(Function));
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(4);
  });
});

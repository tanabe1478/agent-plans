import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerViewsHandlers } from '../views.js';

vi.mock('../../services/viewService.js', () => ({
  viewService: {
    listViews: vi.fn(),
    getView: vi.fn(),
    createView: vi.fn(),
    updateView: vi.fn(),
    deleteView: vi.fn(),
  },
}));

describe('Views IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerViewsHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register views:list handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('views:list', expect.any(Function));
  });

  it('should register views:get handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('views:get', expect.any(Function));
  });

  it('should register views:create handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('views:create', expect.any(Function));
  });

  it('should register views:update handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('views:update', expect.any(Function));
  });

  it('should register views:delete handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('views:delete', expect.any(Function));
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(5);
  });
});

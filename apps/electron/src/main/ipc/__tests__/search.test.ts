import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSearchHandlers } from '../search.js';

vi.mock('../../services/searchService.js', () => ({
  searchService: {
    search: vi.fn(),
  },
}));

describe('Search IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerSearchHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register search:query handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('search:query', expect.any(Function));
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(1);
  });
});

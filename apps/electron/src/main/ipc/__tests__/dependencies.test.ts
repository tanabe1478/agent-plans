import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerDependenciesHandlers } from '../dependencies.js';

vi.mock('../../services/dependencyService.js', () => ({
  buildDependencyGraph: vi.fn(),
  getPlanDependencies: vi.fn(),
}));

describe('Dependencies IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerDependenciesHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register dependencies:graph handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('dependencies:graph', expect.any(Function));
  });

  it('should register dependencies:get handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('dependencies:get', expect.any(Function));
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(2);
  });
});

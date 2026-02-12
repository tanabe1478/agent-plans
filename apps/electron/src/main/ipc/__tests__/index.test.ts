import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAllHandlers } from '../index.js';

// Mock electron IPC main
const mockIpcMain = {
  handle: vi.fn(),
};

// Mock all individual handler modules
vi.mock('../plans.js', () => ({
  registerPlansHandlers: vi.fn(),
}));

vi.mock('../search.js', () => ({
  registerSearchHandlers: vi.fn(),
}));

vi.mock('../views.js', () => ({
  registerViewsHandlers: vi.fn(),
}));

vi.mock('../notifications.js', () => ({
  registerNotificationsHandlers: vi.fn(),
}));

vi.mock('../archive.js', () => ({
  registerArchiveHandlers: vi.fn(),
}));

vi.mock('../dependencies.js', () => ({
  registerDependenciesHandlers: vi.fn(),
}));

vi.mock('../import-export.js', () => ({
  registerImportExportHandlers: vi.fn(),
}));

vi.mock('../settings.js', () => ({
  registerSettingsHandlers: vi.fn(),
}));

describe('IPC Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all handlers when registerAllHandlers is called', async () => {
    const { registerPlansHandlers } = await import('../plans.js');
    const { registerSearchHandlers } = await import('../search.js');
    const { registerViewsHandlers } = await import('../views.js');
    const { registerNotificationsHandlers } = await import('../notifications.js');
    const { registerArchiveHandlers } = await import('../archive.js');
    const { registerDependenciesHandlers } = await import('../dependencies.js');
    const { registerImportExportHandlers } = await import('../import-export.js');
    const { registerSettingsHandlers } = await import('../settings.js');

    registerAllHandlers(mockIpcMain as unknown as Electron.IpcMain);

    expect(registerPlansHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerSearchHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerViewsHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerNotificationsHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerArchiveHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerDependenciesHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerImportExportHandlers).toHaveBeenCalledWith(mockIpcMain);
    expect(registerSettingsHandlers).toHaveBeenCalledWith(mockIpcMain);
  });

  it('should register handlers in correct order', async () => {
    const callOrder: string[] = [];

    vi.mocked(await import('../plans.js')).registerPlansHandlers.mockImplementation(() => {
      callOrder.push('plans');
    });
    vi.mocked(await import('../search.js')).registerSearchHandlers.mockImplementation(() => {
      callOrder.push('search');
    });
    vi.mocked(await import('../views.js')).registerViewsHandlers.mockImplementation(() => {
      callOrder.push('views');
    });

    registerAllHandlers(mockIpcMain as unknown as Electron.IpcMain);

    expect(callOrder.indexOf('plans')).toBeLessThan(callOrder.indexOf('search'));
    expect(callOrder.indexOf('search')).toBeLessThan(callOrder.indexOf('views'));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerImportExportHandlers } from '../import-export.js';

vi.mock('../../services/importService.js', () => ({
  importMarkdownFiles: vi.fn(),
  createBackup: vi.fn(),
  listBackups: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock('../../services/exportService.js', () => ({
  exportAsJson: vi.fn(),
  exportAsCsv: vi.fn(),
  exportAsTarGz: vi.fn(),
}));

describe('Import/Export IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerImportExportHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register import:markdown handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('import:markdown', expect.any(Function));
  });

  it('should register export:backup handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('export:backup', expect.any(Function));
  });

  it('should register export:listBackups handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('export:listBackups', expect.any(Function));
  });

  it('should register export:restoreBackup handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('export:restoreBackup', expect.any(Function));
  });

  it('should register export:json handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('export:json', expect.any(Function));
  });

  it('should register export:csv handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('export:csv', expect.any(Function));
  });

  it('should register export:tarball handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('export:tarball', expect.any(Function));
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(7);
  });
});

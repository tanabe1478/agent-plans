// @ts-nocheck
import type { ImportMarkdownRequest, ImportMarkdownResponse } from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import { exportAsCsv, exportAsJson, exportAsTarGz } from '../services/exportService.js';
import {
  createBackup,
  importMarkdownFiles,
  listBackups,
  restoreBackup,
} from '../services/importService.js';

/**
 * Register import/export-related IPC handlers
 */
export function registerImportExportHandlers(ipcMain: Electron.IpcMain): void {
  // Import markdown files
  ipcMain.handle(
    'import:markdown',
    async (
      _event: IpcMainInvokeEvent,
      request: ImportMarkdownRequest
    ): Promise<ImportMarkdownResponse> => {
      const result = await importMarkdownFiles(request.files);
      return result;
    }
  );

  // Create a backup
  ipcMain.handle('export:backup', async (_event: IpcMainInvokeEvent) => {
    return createBackup();
  });

  // List available backups
  ipcMain.handle('export:listBackups', async (_event: IpcMainInvokeEvent) => {
    return listBackups();
  });

  // Restore from backup
  ipcMain.handle('export:restoreBackup', async (_event: IpcMainInvokeEvent, backupId: string) => {
    return restoreBackup(backupId);
  });

  // Export as JSON
  ipcMain.handle(
    'export:json',
    async (
      _event: IpcMainInvokeEvent,
      options?: { filterStatus?: string; filterTags?: string[] }
    ): Promise<string> => {
      return exportAsJson(options);
    }
  );

  // Export as CSV
  ipcMain.handle(
    'export:csv',
    async (
      _event: IpcMainInvokeEvent,
      options?: { filterStatus?: string; filterTags?: string[] }
    ): Promise<string> => {
      return exportAsCsv(options);
    }
  );

  // Export as tar.gz
  ipcMain.handle(
    'export:tarball',
    async (
      _event: IpcMainInvokeEvent,
      options?: { filterStatus?: string; filterTags?: string[] }
    ): Promise<Buffer> => {
      return exportAsTarGz(options);
    }
  );
}

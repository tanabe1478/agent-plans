import type {
  BackupInfo,
  ImportMarkdownRequest,
  ImportMarkdownResponse,
  PlanStatus,
} from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { exportAsCsv, exportAsJson, exportAsTarGz } from '../services/exportService.js';
import {
  createBackup,
  importMarkdownFiles,
  listBackups,
  restoreBackup,
} from '../services/importService.js';

interface ExportOptions {
  includeArchived?: boolean;
  filterStatus?: PlanStatus;
  filterTags?: string[];
}

/**
 * Register import/export-related IPC handlers
 */
export function registerImportExportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'import:markdown',
    async (
      _event: IpcMainInvokeEvent,
      request: ImportMarkdownRequest
    ): Promise<ImportMarkdownResponse> => {
      return importMarkdownFiles(request.files);
    }
  );

  ipcMain.handle('export:backup', async (_event: IpcMainInvokeEvent): Promise<BackupInfo> => {
    return createBackup();
  });

  ipcMain.handle(
    'export:listBackups',
    async (_event: IpcMainInvokeEvent): Promise<BackupInfo[]> => {
      return listBackups();
    }
  );

  ipcMain.handle(
    'export:restoreBackup',
    async (_event: IpcMainInvokeEvent, backupId: string): Promise<ImportMarkdownResponse> => {
      return restoreBackup(backupId);
    }
  );

  ipcMain.handle(
    'export:json',
    async (_event: IpcMainInvokeEvent, options?: ExportOptions): Promise<string> => {
      return exportAsJson(options);
    }
  );

  ipcMain.handle(
    'export:csv',
    async (_event: IpcMainInvokeEvent, options?: ExportOptions): Promise<string> => {
      return exportAsCsv(options);
    }
  );

  ipcMain.handle(
    'export:tarball',
    async (_event: IpcMainInvokeEvent, options?: ExportOptions): Promise<Buffer> => {
      return exportAsTarGz(options);
    }
  );
}

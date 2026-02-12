import type { ArchiveListResponse } from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import {
  cleanupExpired,
  listArchived,
  permanentlyDelete,
  restoreFromArchive,
} from '../services/archiveService.js';

/**
 * Register archive-related IPC handlers
 */
export function registerArchiveHandlers(ipcMain: Electron.IpcMain): void {
  // List all archived plans
  ipcMain.handle(
    'archive:list',
    async (_event: IpcMainInvokeEvent): Promise<ArchiveListResponse> => {
      const archived = await listArchived();
      return { archived, total: archived.length };
    }
  );

  // Restore an archived plan
  ipcMain.handle(
    'archive:restore',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<void> => {
      return restoreFromArchive(filename);
    }
  );

  // Permanently delete an archived plan
  ipcMain.handle(
    'archive:delete',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<void> => {
      return permanentlyDelete(filename);
    }
  );

  // Clean up expired archives
  ipcMain.handle(
    'archive:cleanup',
    async (_event: IpcMainInvokeEvent): Promise<{ deletedCount: number }> => {
      const deletedCount = await cleanupExpired();
      return { deletedCount };
    }
  );
}

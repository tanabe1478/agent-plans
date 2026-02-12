// @ts-nocheck
import type { CreateViewRequest, SavedView, UpdateViewRequest } from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import { viewService } from '../services/viewService.js';

/**
 * Register views-related IPC handlers
 */
export function registerViewsHandlers(ipcMain: Electron.IpcMain): void {
  // List all views (presets + custom)
  ipcMain.handle('views:list', async (_event: IpcMainInvokeEvent): Promise<SavedView[]> => {
    return viewService.listViews();
  });

  // Get a single view by ID
  ipcMain.handle(
    'views:get',
    async (_event: IpcMainInvokeEvent, id: string): Promise<SavedView | null> => {
      return viewService.getView(id);
    }
  );

  // Create a new custom view
  ipcMain.handle(
    'views:create',
    async (_event: IpcMainInvokeEvent, request: CreateViewRequest): Promise<SavedView> => {
      return viewService.createView(request);
    }
  );

  // Update an existing custom view
  ipcMain.handle(
    'views:update',
    async (_event: IpcMainInvokeEvent, request: UpdateViewRequest): Promise<SavedView> => {
      return viewService.updateView(request.id, request);
    }
  );

  // Delete a custom view
  ipcMain.handle('views:delete', async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
    return viewService.deleteView(id);
  });
}

import type {
  CreateViewRequest,
  SavedView,
  UpdateViewRequest,
  ViewsListResponse,
} from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { viewService } from '../services/viewService.js';

interface UpdateViewRequestWithId extends UpdateViewRequest {
  id: string;
}

/**
 * Register views-related IPC handlers
 */
export function registerViewsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('views:list', async (_event: IpcMainInvokeEvent): Promise<ViewsListResponse> => {
    const views = await viewService.listViews();
    return { views };
  });

  ipcMain.handle(
    'views:get',
    async (_event: IpcMainInvokeEvent, id: string): Promise<SavedView | null> => {
      return viewService.getView(id);
    }
  );

  ipcMain.handle(
    'views:create',
    async (_event: IpcMainInvokeEvent, request: CreateViewRequest): Promise<SavedView> => {
      return viewService.createView(request);
    }
  );

  ipcMain.handle(
    'views:update',
    async (_event: IpcMainInvokeEvent, request: UpdateViewRequestWithId): Promise<SavedView> => {
      return viewService.updateView(request.id, request);
    }
  );

  ipcMain.handle('views:delete', async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
    return viewService.deleteView(id);
  });
}

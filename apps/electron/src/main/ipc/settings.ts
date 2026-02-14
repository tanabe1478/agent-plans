import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { getSettings, selectPlanDirectory, updateSettings } from '../services/settingsService.js';

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(ipcMain: IpcMain): void {
  // Get current settings
  ipcMain.handle(
    'settings:get',
    async (_event: IpcMainInvokeEvent): Promise<GetSettingsResponse> => {
      return getSettings();
    }
  );

  // Update settings
  ipcMain.handle(
    'settings:update',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdateSettingsRequest
    ): Promise<UpdateSettingsResponse> => {
      return updateSettings(request);
    }
  );

  // Open native directory picker (Finder on macOS)
  ipcMain.handle(
    'settings:selectDirectory',
    async (_event: IpcMainInvokeEvent, initialPath?: string): Promise<string | null> =>
      selectPlanDirectory(initialPath)
  );
}

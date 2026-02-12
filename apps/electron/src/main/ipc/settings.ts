// @ts-nocheck
import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import { getSettings, updateSettings } from '../services/settingsService.js';

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(ipcMain: Electron.IpcMain): void {
  // Get current settings
  ipcMain.handle(
    'settings:get',
    async (_event: IpcMainInvokeEvent): Promise<GetSettingsResponse> => {
      const settings = await getSettings();
      return { settings };
    }
  );

  // Update settings
  ipcMain.handle(
    'settings:update',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdateSettingsRequest
    ): Promise<UpdateSettingsResponse> => {
      const settings = await updateSettings(request);
      return { settings };
    }
  );
}

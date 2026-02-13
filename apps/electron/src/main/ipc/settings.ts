import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { BrowserWindow, dialog } from 'electron';
import { getSettings, updateSettings } from '../services/settingsService.js';

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
    async (event: IpcMainInvokeEvent, initialPath?: string): Promise<string | null> => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        title: 'Select Plan Directory',
        defaultPath: initialPath?.trim() ? initialPath : undefined,
        properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
      });
      if (canceled || filePaths.length === 0) {
        return null;
      }
      return filePaths[0] ?? null;
    }
  );
}

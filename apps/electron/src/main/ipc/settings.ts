import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@agent-plans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { FileWatcherService } from '../services/fileWatcherService.js';
import { getSettings, selectPlanDirectory, updateSettings } from '../services/settingsService.js';

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(ipcMain: IpcMain, fileWatcher?: FileWatcherService): void {
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
      const previous = await getSettings();
      const updated = await updateSettings(request);

      if (fileWatcher) {
        const watcherToggled =
          request.fileWatcherEnabled !== undefined &&
          request.fileWatcherEnabled !== previous.fileWatcherEnabled;
        const directoriesChanged =
          request.planDirectories !== undefined &&
          JSON.stringify(request.planDirectories) !== JSON.stringify(previous.planDirectories);

        if (watcherToggled) {
          if (updated.fileWatcherEnabled) {
            await fileWatcher.restart();
          } else {
            fileWatcher.stop();
          }
        } else if (directoriesChanged && fileWatcher.isRunning()) {
          await fileWatcher.restart();
        }
      }

      return updated;
    }
  );

  // Open native directory picker (Finder on macOS)
  ipcMain.handle(
    'settings:selectDirectory',
    async (_event: IpcMainInvokeEvent, initialPath?: string): Promise<string | null> =>
      selectPlanDirectory(initialPath)
  );
}

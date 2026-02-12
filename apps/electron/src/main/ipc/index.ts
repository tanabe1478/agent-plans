import type { IpcMain } from 'electron';
import { registerArchiveHandlers } from './archive.js';
import { registerDependenciesHandlers } from './dependencies.js';
import { registerImportExportHandlers } from './import-export.js';
import { registerNotificationsHandlers } from './notifications.js';
import { registerPlansHandlers } from './plans.js';
import { registerSearchHandlers } from './search.js';
import { registerSettingsHandlers } from './settings.js';
import { registerViewsHandlers } from './views.js';

/**
 * Register all IPC handlers
 * Call this when the app is ready
 */
export function registerAllHandlers(ipcMain: IpcMain): void {
  registerPlansHandlers(ipcMain);
  registerSearchHandlers(ipcMain);
  registerViewsHandlers(ipcMain);
  registerNotificationsHandlers(ipcMain);
  registerArchiveHandlers(ipcMain);
  registerDependenciesHandlers(ipcMain);
  registerImportExportHandlers(ipcMain);
  registerSettingsHandlers(ipcMain);
}

// Export individual handlers for testing
export {
  registerPlansHandlers,
  registerSearchHandlers,
  registerViewsHandlers,
  registerNotificationsHandlers,
  registerArchiveHandlers,
  registerDependenciesHandlers,
  registerImportExportHandlers,
  registerSettingsHandlers,
};

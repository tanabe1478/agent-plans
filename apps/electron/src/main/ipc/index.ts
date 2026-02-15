import type { IpcMain } from 'electron';
import type { FileWatcherService } from '../services/fileWatcherService.js';
import { registerDependenciesHandlers } from './dependencies.js';
import { registerPlansHandlers } from './plans.js';
import { registerSearchHandlers } from './search.js';
import { registerSettingsHandlers } from './settings.js';

/**
 * Register all IPC handlers
 * Call this when the app is ready
 */
export function registerAllHandlers(ipcMain: IpcMain, fileWatcher?: FileWatcherService): void {
  registerPlansHandlers(ipcMain);
  registerSearchHandlers(ipcMain);
  registerDependenciesHandlers(ipcMain);
  registerSettingsHandlers(ipcMain, fileWatcher);
}

// Export individual handlers for testing
export {
  registerPlansHandlers,
  registerSearchHandlers,
  registerDependenciesHandlers,
  registerSettingsHandlers,
};

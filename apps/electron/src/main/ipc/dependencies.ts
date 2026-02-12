import type { DependencyGraphResponse, PlanDependencies } from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import { buildDependencyGraph, getPlanDependencies } from '../services/dependencyService.js';

/**
 * Register dependencies-related IPC handlers
 */
export function registerDependenciesHandlers(ipcMain: Electron.IpcMain): void {
  // Get the full dependency graph
  ipcMain.handle(
    'dependencies:graph',
    async (_event: IpcMainInvokeEvent): Promise<DependencyGraphResponse> => {
      return buildDependencyGraph();
    }
  );

  // Get dependencies for a specific plan
  ipcMain.handle(
    'dependencies:get',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<PlanDependencies> => {
      return getPlanDependencies(filename);
    }
  );
}

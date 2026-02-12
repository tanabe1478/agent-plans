import type { SearchResponse } from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { searchService } from '../services/searchService.js';

/**
 * Register search-related IPC handlers
 */
export function registerSearchHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'search:query',
    async (_event: IpcMainInvokeEvent, query: string, limit?: number): Promise<SearchResponse> => {
      const results = await searchService.search(query, limit);
      return { results, query, total: results.length };
    }
  );
}

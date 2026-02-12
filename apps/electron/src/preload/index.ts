// @ts-nocheck
import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for IPC channels
export type IpcChannel =
  | `plans:${string}`
  | `search:${string}`
  | `views:${string}`
  | `notifications:${string}`
  | `archive:${string}`
  | `dependencies:${string}`
  | `import:${string}`
  | `export:${string}`
  | `settings:${string}`;

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Generic invoke for any IPC channel
  invoke: (channel: IpcChannel, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const subscription = (_event: unknown, ...args: unknown[]): void => callback(...args);
    ipcRenderer.on(channel, subscription);
    return (): void => ipcRenderer.removeListener(channel, subscription);
  },
});

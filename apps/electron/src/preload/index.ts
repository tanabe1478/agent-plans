// @ts-nocheck
import { clipboard, contextBridge, ipcRenderer } from 'electron';

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

  // Clipboard write fallback for contexts where navigator.clipboard is unavailable.
  writeClipboard: (text: string): void => {
    clipboard.writeText(text);
  },

  // Platform info for renderer layout decisions.
  getPlatform: (): NodeJS.Platform => process.platform,

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const subscription = (_event: unknown, ...args: unknown[]): void => callback(...args);
    ipcRenderer.on(channel, subscription);
    return (): void => ipcRenderer.removeListener(channel, subscription);
  },
});

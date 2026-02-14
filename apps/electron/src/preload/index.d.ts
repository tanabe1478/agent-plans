import { IpcChannel } from './index';

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>;
      writeClipboard: (text: string) => void;
      getPlatform: () => NodeJS.Platform;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

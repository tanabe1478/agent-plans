import { IpcChannel } from './index';

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

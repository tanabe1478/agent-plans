import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
};

const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
}));

describe('Preload Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache to allow re-importing
    vi.resetModules();
  });

  it('should expose electronAPI to main world', async () => {
    await import('../index');

    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.any(Object)
    );
  });

  it('should expose invoke function for IPC', async () => {
    await import('../index');

    const call = mockContextBridge.exposeInMainWorld.mock.calls[0];
    const api = call[1] as { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> };

    expect(api).toHaveProperty('invoke');
    expect(typeof api.invoke).toBe('function');
  });

  it('should expose on function for event listeners', async () => {
    await import('../index');

    const call = mockContextBridge.exposeInMainWorld.mock.calls[0];
    const api = call[1] as {
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };

    expect(api).toHaveProperty('on');
    expect(typeof api.on).toBe('function');
  });

  it('invoke should call ipcRenderer.invoke with channel and args', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });

    await import('../index');

    const call = mockContextBridge.exposeInMainWorld.mock.calls[0];
    const api = call[1] as { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> };

    await api.invoke('plans:list', { status: 'active' });

    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('plans:list', { status: 'active' });
  });

  it('on should register listener and return unsubscribe function', async () => {
    await import('../index');

    const call = mockContextBridge.exposeInMainWorld.mock.calls[0];
    const api = call[1] as {
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };

    const callback = vi.fn();
    const unsubscribe = api.on('plans:changed', callback);

    expect(mockIpcRenderer.on).toHaveBeenCalledWith('plans:changed', expect.any(Function));

    // Test unsubscribe
    unsubscribe();
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith(
      'plans:changed',
      expect.any(Function)
    );
  });
});

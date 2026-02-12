import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock IPC handlers module
vi.mock('../ipc/index.js', () => ({
  registerAllHandlers: vi.fn(),
}));

// Mock electron module
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    getPath: vi.fn(() => '/mock/path'),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    webContents: {
      on: vi.fn(),
      openDevTools: vi.fn(),
    },
  })),
  ipcMain: {
    handle: vi.fn(),
  },
}));

describe('Main Process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should create BrowserWindow on app ready', async () => {
    const { app } = await import('electron');
    await import('../index');

    expect(app.whenReady).toHaveBeenCalled();
  });

  it('should use titleBarStyle hidden for macOS native look', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        titleBarStyle: 'hidden',
      })
    );
  });

  it('should set contextIsolation to true for security', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
        }),
      })
    );
  });

  it('should set nodeIntegration to false for security', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          nodeIntegration: false,
        }),
      })
    );
  });

  it('should set sandbox to true for security', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          sandbox: true,
        }),
      })
    );
  });

  it('should set minimum window dimensions', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        minWidth: 800,
        minHeight: 600,
      })
    );
  });

  it('should configure traffic light position for macOS', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        trafficLightPosition: { x: 15, y: 15 },
      })
    );
  });
});

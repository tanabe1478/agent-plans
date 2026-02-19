import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock IPC handlers module
vi.mock('../ipc/index.js', () => ({
  registerAllHandlers: vi.fn(),
}));

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mock/out/main/index.js'),
}));

// Mock frontmatter migration (no-op in unit tests)
vi.mock('../services/frontmatterMigration.js', () => ({
  migrateFrontmatterToDb: vi.fn(() => Promise.resolve({ migrated: 0, skipped: 0, errors: [] })),
}));

// Mock planService exports used by index.ts
vi.mock('../services/planService.js', () => ({
  getDefaultMetadataService: vi.fn(() => ({})),
  planService: {},
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
    show: vi.fn(),
    once: vi.fn(),
    isDestroyed: vi.fn(() => false),
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

  it('should disable sandbox so preload can expose IPC bridge', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          sandbox: false,
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
        trafficLightPosition: { x: 15, y: 8 },
      })
    );
  });

  it('should load preload index.mjs file', async () => {
    const { BrowserWindow } = await import('electron');
    await import('../index');

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          preload: expect.stringContaining('/mock/out/preload/index.mjs'),
        }),
      })
    );
  });
});

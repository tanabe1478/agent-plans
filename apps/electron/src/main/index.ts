import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import { registerAllHandlers } from './ipc/index.js';

let mainWindow: BrowserWindow | null = null;
const currentDir = dirname(fileURLToPath(import.meta.url));
const DEV_LOAD_MAX_RETRIES = 30;
const DEV_LOAD_RETRY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function loadRendererWindow(window: BrowserWindow, rendererUrl: string): Promise<void> {
  for (let attempt = 1; attempt <= DEV_LOAD_MAX_RETRIES; attempt += 1) {
    try {
      await window.loadURL(rendererUrl);
      return;
    } catch (error) {
      if (attempt === DEV_LOAD_MAX_RETRIES) {
        throw error;
      }
      await sleep(DEV_LOAD_RETRY_MS);
    }
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hidden', // macOS native title bar
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(currentDir, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Preload must expose ipc bridge to renderer APIs.
      // On this app/runtime combination, sandboxed preload fails to expose the bridge.
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
    if (!isMainFrame) return;
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  // Development/preview: load from renderer dev server URL when provided.
  if (rendererUrl) {
    try {
      await loadRendererWindow(mainWindow, rendererUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>agent-plans: failed to load renderer</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 12px 0; font-size: 20px; }
      p, pre { margin: 8px 0; }
      pre { background: #f3f4f6; padding: 12px; border-radius: 8px; white-space: pre-wrap; }
      code { background: #eef2ff; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>Renderer failed to load</h1>
    <p>URL: <code>${rendererUrl}</code></p>
    <pre>${message}</pre>
    <p>Retry command: <code>pnpm --filter @agent-plans/electron dev</code></p>
  </body>
</html>`;
      await mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
    }

    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    // Production: load built files
    await mainWindow.loadFile(join(currentDir, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Register all IPC handlers
  registerAllHandlers(ipcMain);

  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

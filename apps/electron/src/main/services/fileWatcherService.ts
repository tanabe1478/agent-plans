import { type FSWatcher, watch } from 'node:fs';
import { basename } from 'node:path';
import type { BrowserWindow } from 'electron';

export interface FileChangeEvent {
  eventType: 'rename' | 'change';
  filename: string;
}

export class FileWatcherService {
  private watchers: FSWatcher[] = [];
  private window: BrowserWindow | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private directoryResolver: () => Promise<string[]>;
  private running = false;

  private static readonly DEBOUNCE_MS = 300;

  constructor(directoryResolver: () => Promise<string[]>) {
    this.directoryResolver = directoryResolver;
  }

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  async start(): Promise<void> {
    if (this.running) return;

    const directories = await this.directoryResolver();
    for (const dir of directories) {
      try {
        const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
          if (!filename || !filename.endsWith('.md')) return;
          this.handleFileChange(eventType as 'rename' | 'change', filename);
        });

        watcher.on('error', () => {
          // Silently ignore watch errors (directory removed, permissions, etc.)
        });

        this.watchers.push(watcher);
      } catch {
        // Directory may not exist yet — skip silently
      }
    }

    this.running = true;
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.running = false;
  }

  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  isRunning(): boolean {
    return this.running;
  }

  private handleFileChange(eventType: 'rename' | 'change', filename: string): void {
    const key = filename;
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.sendChangeEvent({ eventType, filename: basename(filename) });
    }, FileWatcherService.DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }

  private sendChangeEvent(event: FileChangeEvent): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send('plans:fileChanged', event);
  }
}

import { resolve } from 'node:path';
import type { ElectronViteConfig } from 'electron-vite';
import { describe, expect, it } from 'vitest';

describe('electron.vite.config', () => {
  it('should export valid configuration object', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    expect(config).toBeDefined();
    expect(config.main).toBeDefined();
    expect(config.preload).toBeDefined();
    expect(config.renderer).toBeDefined();
  });

  it('should have correct main process configuration', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    expect(config.main).toBeDefined();
    expect(config.main?.plugins).toBeDefined();
    expect(config.main?.resolve?.alias).toBeDefined();
    expect(config.main?.resolve?.alias?.['@services']).toBe(resolve('src/main/services'));
    expect(config.main?.resolve?.alias?.['@ipc']).toBe(resolve('src/main/ipc'));
    expect(config.main?.build?.rollupOptions?.input).toBeDefined();
  });

  it('should have correct preload script configuration', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    expect(config.preload).toBeDefined();
    expect(config.preload?.plugins).toBeDefined();
    expect(config.preload?.build?.rollupOptions?.input).toBeDefined();
  });

  it('should have correct renderer process configuration', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    expect(config.renderer).toBeDefined();
    expect(config.renderer?.plugins).toBeDefined();
    expect(config.renderer?.resolve?.alias).toBeDefined();
    expect(config.renderer?.resolve?.alias?.['@renderer']).toBe(resolve('src/renderer'));
    expect(config.renderer?.resolve?.alias?.['@components']).toBe(
      resolve('src/renderer/components')
    );
    expect(config.renderer?.resolve?.alias?.['@pages']).toBe(resolve('src/renderer/pages'));
    expect(config.renderer?.resolve?.alias?.['@hooks']).toBe(resolve('src/renderer/hooks'));
    expect(config.renderer?.resolve?.alias?.['@stores']).toBe(resolve('src/renderer/stores'));
    expect(config.renderer?.resolve?.alias?.['@lib']).toBe(resolve('src/renderer/lib'));
    expect(config.renderer?.build?.rollupOptions?.input).toBeDefined();
  });

  it('should externalize dependencies in main process', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    const mainPlugins = config.main?.plugins;
    expect(mainPlugins).toHaveLength(1);

    // Check that externalizeDepsPlugin is present (it's an object)
    expect(typeof mainPlugins?.[0]).toBe('object');
  });

  it('should externalize dependencies in preload script', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    const preloadPlugins = config.preload?.plugins;
    expect(preloadPlugins).toHaveLength(1);
  });

  it('should include react plugin in renderer', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    const rendererPlugins = config.renderer?.plugins;
    expect(rendererPlugins).toHaveLength(1);
  });

  it('should have correct main entry point', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    const mainInput = config.main?.build?.rollupOptions?.input as { index: string };
    expect(mainInput.index).toContain('src/main/index.ts');
  });

  it('should have correct preload entry point', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    const preloadInput = config.preload?.build?.rollupOptions?.input as { index: string };
    expect(preloadInput.index).toContain('src/preload/index.ts');
  });

  it('should have correct renderer entry point', async () => {
    const { default: config } = (await import('../../electron.vite.config')) as {
      default: ElectronViteConfig;
    };

    const rendererInput = config.renderer?.build?.rollupOptions?.input as { index: string };
    expect(rendererInput.index).toContain('src/renderer/index.html');
  });
});

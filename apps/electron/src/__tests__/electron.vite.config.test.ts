import { existsSync, readFileSync } from 'node:fs';
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

describe('native module ABI guard', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

  const NATIVE_MODULES = ['better-sqlite3'];

  const hasNativeModule = NATIVE_MODULES.some(
    (mod) => pkg.dependencies?.[mod] || pkg.devDependencies?.[mod]
  );

  it('should have postinstall script that runs rebuild-native when native modules are present', () => {
    expect(hasNativeModule).toBe(true);
    expect(pkg.scripts?.postinstall).toBeDefined();
    expect(pkg.scripts.postinstall).toContain('rebuild-native');
  });

  it('should have rebuild-native script file', () => {
    const scriptPath = resolve(__dirname, '../../scripts/rebuild-native.cjs');
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('should have verify:native script for Electron runtime ABI verification', () => {
    expect(pkg.scripts?.['verify:native']).toBeDefined();
    expect(pkg.scripts['verify:native']).toContain('verify-native-modules');
  });

  it('should have verify-native-modules script file', () => {
    const scriptPath = resolve(__dirname, '../../scripts/verify-native-modules.cjs');
    expect(existsSync(scriptPath)).toBe(true);
  });
});

describe('Electron runtime debug infrastructure', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

  const mcpJsonPath = resolve(__dirname, '../../../../.mcp.json');
  const hasMcpJson = existsSync(mcpJsonPath);

  it('should use worktree-aware dev script', () => {
    expect(pkg.scripts?.dev).toBeDefined();
    expect(pkg.scripts.dev).toContain('dev-worktree.cjs');
  });

  it('should have dev:debug script routed through worktree launcher', () => {
    expect(pkg.scripts?.['dev:debug']).toBeDefined();
    expect(pkg.scripts['dev:debug']).toContain('dev-worktree.cjs');
    expect(pkg.scripts['dev:debug']).toContain('--debug');
  });

  it('should have verify:runtime script', () => {
    expect(pkg.scripts?.['verify:runtime']).toBeDefined();
    expect(pkg.scripts['verify:runtime']).toContain('verify-electron-runtime');
  });

  it('should have verify-electron-runtime script file', () => {
    const scriptPath = resolve(__dirname, '../../scripts/verify-electron-runtime.cjs');
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('should have worktree dev launcher script file', () => {
    const scriptPath = resolve(__dirname, '../../scripts/dev-worktree.cjs');
    expect(existsSync(scriptPath)).toBe(true);
  });

  it.skipIf(!hasMcpJson)('should have electron-debug MCP server configured in .mcp.json', () => {
    const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
    expect(mcpConfig.mcpServers?.['electron-debug']).toBeDefined();
    expect(mcpConfig.mcpServers['electron-debug'].command).toBe('electron-debug-mcp');
  });
});

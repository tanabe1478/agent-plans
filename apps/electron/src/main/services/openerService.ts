import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { dirname } from 'node:path';
import type { ExternalApp } from '@ccplans/shared';
import { clipboard } from 'electron';

/**
 * Open a file with an external application
 */
export class OpenerService {
  /**
   * Open file with specified application
   */
  async openFile(filePath: string, app: ExternalApp): Promise<void> {
    switch (app) {
      case 'vscode':
        await this.openWithVSCode(filePath);
        break;
      case 'zed':
        await this.openWithNamedApp(filePath, this.getZedAppCandidates());
        break;
      case 'ghostty':
        await this.openInGhostty(filePath);
        break;
      case 'terminal':
        await this.openInTerminal(filePath);
        break;
      case 'copy-path':
        this.copyPath(filePath);
        break;
      case 'default':
        await this.openWithDefault(filePath);
        break;
      default:
        throw new Error(`Unknown app: ${app}`);
    }
  }

  /**
   * Open file in VS Code
   */
  private async openWithVSCode(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn('code', [filePath], {
        detached: true,
        stdio: 'ignore',
      });

      childProcess.on('error', (err) => {
        reject(new Error(`Failed to open VS Code: ${err.message}`));
      });

      childProcess.unref();
      resolve();
    });
  }

  /**
   * Open terminal at the plan's directory
   */
  private async openInTerminal(filePath: string): Promise<void> {
    const os = platform();
    const targetDir = dirname(filePath);

    return new Promise((resolve, reject) => {
      let terminalCmd: string;
      let terminalArgs: string[];

      if (os === 'darwin') {
        // macOS
        terminalCmd = 'open';
        terminalArgs = ['-a', 'Terminal', targetDir];
      } else if (os === 'win32') {
        // Windows
        terminalCmd = 'cmd';
        terminalArgs = ['/c', 'start', 'cmd', '/k', `cd /d "${targetDir}"`];
      } else {
        // Linux - try common terminal emulators at target directory
        const shell = process.env.SHELL || '/bin/sh';
        const shellCommand = `cd -- '${targetDir.replace(/'/g, `'\\''`)}' && exec "${shell}"`;
        const terminals = [
          { cmd: 'gnome-terminal', args: [`--working-directory=${targetDir}`] },
          { cmd: 'konsole', args: [`--workdir`, targetDir] },
          { cmd: 'xterm', args: ['-e', shell, '-lc', shellCommand] },
          { cmd: 'x-terminal-emulator', args: ['-e', shell, '-lc', shellCommand] },
        ];

        // Try to use the first available terminal
        for (const term of terminals) {
          try {
            const proc = spawn(term.cmd, term.args, {
              detached: true,
              stdio: 'ignore',
            });
            proc.unref();
            resolve();
            return;
          } catch {}
        }

        reject(new Error('No suitable terminal emulator found'));
        return;
      }

      const childProcess = spawn(terminalCmd, terminalArgs, {
        detached: true,
        stdio: 'ignore',
      });

      childProcess.on('error', (err) => {
        reject(new Error(`Failed to open terminal: ${err.message}`));
      });

      childProcess.unref();
      resolve();
    });
  }

  /**
   * Open file with a named application
   */
  private async openWithNamedApp(filePath: string, appNames: string[]): Promise<void> {
    const [primaryAppName] = appNames;
    if (!primaryAppName) {
      throw new Error('No application name provided');
    }

    if (platform() === 'darwin') {
      return new Promise((resolve, reject) => {
        const childProcess = spawn('open', ['-a', primaryAppName, filePath], {
          detached: true,
          stdio: 'ignore',
        });

        childProcess.on('error', (err) => {
          reject(new Error(`Failed to open ${primaryAppName}: ${err.message}`));
        });

        childProcess.unref();
        resolve();
      });
    }

    const open = await import('open');
    await open.default(filePath, { app: { name: appNames } });
  }

  private getZedAppCandidates(): string[] {
    switch (platform()) {
      case 'darwin':
        return ['Zed', 'zed'];
      case 'win32':
        return ['zed.exe', 'zed'];
      default:
        return ['zed', 'Zed'];
    }
  }

  /**
   * Open Ghostty at the plan's directory
   */
  private async openInGhostty(filePath: string): Promise<void> {
    const targetDir = dirname(filePath);

    if (platform() === 'darwin') {
      return new Promise((resolve, reject) => {
        const childProcess = spawn('open', ['-a', 'Ghostty', targetDir], {
          detached: true,
          stdio: 'ignore',
        });

        childProcess.on('error', (err) => {
          reject(new Error(`Failed to open Ghostty: ${err.message}`));
        });

        childProcess.unref();
        resolve();
      });
    }

    const open = await import('open');
    await open.default(targetDir, { app: { name: 'Ghostty' } });
  }

  /**
   * Copy file path to clipboard
   */
  private copyPath(filePath: string): void {
    clipboard.writeText(filePath);
  }

  /**
   * Open file with system default application
   */
  private async openWithDefault(filePath: string): Promise<void> {
    const open = await import('open');
    await open.default(filePath);
  }
}

export const openerService = new OpenerService();

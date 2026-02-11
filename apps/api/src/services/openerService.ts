import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import type { ExternalApp } from '@ccplans/shared';

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
      case 'terminal':
        await this.openInTerminal(filePath);
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
      const process = spawn('code', [filePath], {
        detached: true,
        stdio: 'ignore',
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to open VS Code: ${err.message}`));
      });

      process.unref();
      resolve();
    });
  }

  /**
   * Open file in terminal with default editor
   */
  private async openInTerminal(filePath: string): Promise<void> {
    const os = platform();
    const editor = process.env.EDITOR || process.env.VISUAL || 'vim';

    return new Promise((resolve, reject) => {
      let terminalCmd: string;
      let terminalArgs: string[];

      if (os === 'darwin') {
        // macOS
        terminalCmd = 'open';
        terminalArgs = ['-a', 'Terminal', filePath];
      } else if (os === 'win32') {
        // Windows
        terminalCmd = 'cmd';
        terminalArgs = ['/c', 'start', 'cmd', '/k', editor, filePath];
      } else {
        // Linux - try common terminal emulators
        const terminals = [
          { cmd: 'gnome-terminal', args: ['--', editor, filePath] },
          { cmd: 'konsole', args: ['-e', editor, filePath] },
          { cmd: 'xterm', args: ['-e', editor, filePath] },
          { cmd: 'x-terminal-emulator', args: ['-e', `${editor} "${filePath}"`] },
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

      const process = spawn(terminalCmd, terminalArgs, {
        detached: true,
        stdio: 'ignore',
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to open terminal: ${err.message}`));
      });

      process.unref();
      resolve();
    });
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

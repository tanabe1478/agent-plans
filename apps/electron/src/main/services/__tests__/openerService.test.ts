import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();
const platformMock = vi.fn(() => 'darwin');
const writeTextMock = vi.fn();
const openDefaultMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('node:os', () => ({
  platform: platformMock,
}));

vi.mock('electron', () => ({
  clipboard: {
    writeText: writeTextMock,
  },
}));

vi.mock('open', () => ({
  default: openDefaultMock,
}));

describe('OpenerService', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    platformMock.mockReset();
    writeTextMock.mockReset();
    openDefaultMock.mockReset();
    platformMock.mockReturnValue('darwin');
    spawnMock.mockReturnValue({
      on: vi.fn(),
      unref: vi.fn(),
    });
  });

  it('opens Terminal at the file directory on macOS', async () => {
    const { OpenerService } = await import('../openerService.js');
    const service = new OpenerService();
    const filePath = '/Users/test/.claude/plans/sample.md';

    await service.openFile(filePath, 'terminal');

    expect(spawnMock).toHaveBeenCalledWith(
      'open',
      ['-a', 'Terminal', '/Users/test/.claude/plans'],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      })
    );
  });

  it('opens Ghostty by opening the file directory on macOS', async () => {
    const { OpenerService } = await import('../openerService.js');
    const service = new OpenerService();
    const filePath = '/Users/test/.claude/plans/sample.md';

    await service.openFile(filePath, 'ghostty');

    expect(spawnMock).toHaveBeenCalledWith(
      'open',
      ['-a', 'Ghostty', '/Users/test/.claude/plans'],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      })
    );
  });

  it('copies full file path for copy-path action', async () => {
    const { OpenerService } = await import('../openerService.js');
    const service = new OpenerService();
    const filePath = '/Users/test/.claude/plans/sample.md';

    await service.openFile(filePath, 'copy-path');

    expect(writeTextMock).toHaveBeenCalledWith(filePath);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('uses platform-aware Zed app names on non-macOS', async () => {
    platformMock.mockReturnValue('linux');
    const { OpenerService } = await import('../openerService.js');
    const service = new OpenerService();
    const filePath = '/Users/test/.claude/plans/sample.md';

    await service.openFile(filePath, 'zed');

    expect(spawnMock).not.toHaveBeenCalled();
    expect(openDefaultMock).toHaveBeenCalledWith(filePath, {
      app: { name: ['zed', 'Zed'] },
    });
  });
});

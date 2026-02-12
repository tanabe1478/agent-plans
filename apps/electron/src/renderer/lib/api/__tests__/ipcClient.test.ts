/**
 * Tests for IPC client
 *
 * Note: These tests mock window.electronAPI which is normally provided by the preload script.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock window.electronAPI
const mockInvoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.window = {
    electronAPI: {
      invoke: mockInvoke,
      on: vi.fn(() => vi.fn()),
    },
  } as unknown as Window & typeof globalThis;
});

describe('ipcClient', () => {
  it('should be defined after import', async () => {
    const { ipcClient } = await import('../ipcClient');
    expect(ipcClient).toBeDefined();
  });

  describe('plans', () => {
    it('should call plans:list channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce([]);

      await ipcClient.plans.list();

      expect(mockInvoke).toHaveBeenCalledWith('plans:list');
    });

    it('should call plans:get channel with filename', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ filename: 'test.md', content: '' });

      await ipcClient.plans.get('test.md');

      expect(mockInvoke).toHaveBeenCalledWith('plans:get', 'test.md');
    });

    it('should call plans:create channel with request object', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ filename: 'new.md' });

      await ipcClient.plans.create('content', 'new.md');

      expect(mockInvoke).toHaveBeenCalledWith('plans:create', {
        content: 'content',
        filename: 'new.md',
      });
    });

    it('should call plans:delete channel with filename and archive flag', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce(undefined);

      await ipcClient.plans.delete('test.md', false);

      expect(mockInvoke).toHaveBeenCalledWith('plans:delete', 'test.md', false);
    });

    it('should call plans:updateStatus channel with request object', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ filename: 'test.md' });

      await ipcClient.plans.updateStatus('test.md', 'in_progress');

      expect(mockInvoke).toHaveBeenCalledWith('plans:updateStatus', {
        filename: 'test.md',
        status: 'in_progress',
      });
    });

    it('should call plans:bulkTags channel with action', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ succeeded: ['test.md'], failed: [] });

      await ipcClient.plans.bulkTags(['test.md'], 'remove', ['api']);

      expect(mockInvoke).toHaveBeenCalledWith('plans:bulkTags', {
        filenames: ['test.md'],
        action: 'remove',
        tags: ['api'],
      });
    });
  });

  describe('search', () => {
    it('should call search:query channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ results: [], total: 0 });

      await ipcClient.search.query('test query');

      expect(mockInvoke).toHaveBeenCalledWith('search:query', 'test query', undefined);
    });

    it('should call search:query channel with limit', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ results: [], total: 0 });

      await ipcClient.search.query('test query', 10);

      expect(mockInvoke).toHaveBeenCalledWith('search:query', 'test query', 10);
    });
  });

  describe('views', () => {
    it('should call views:list channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce([]);

      await ipcClient.views.list();

      expect(mockInvoke).toHaveBeenCalledWith('views:list');
    });

    it('should call views:create channel with data', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ id: 'view-1' });

      await ipcClient.views.create({
        name: 'Test View',
        filters: {},
        sortBy: 'filename',
        sortOrder: 'asc',
      });

      expect(mockInvoke).toHaveBeenCalledWith('views:create', {
        name: 'Test View',
        filters: {},
        sortBy: 'filename',
        sortOrder: 'asc',
      });
    });
  });

  describe('notifications', () => {
    it('should call notifications:list channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ notifications: [], unreadCount: 0 });

      await ipcClient.notifications.list();

      expect(mockInvoke).toHaveBeenCalledWith('notifications:list');
    });

    it('should call notifications:markRead channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce(undefined);

      await ipcClient.notifications.markRead('notif-1');

      expect(mockInvoke).toHaveBeenCalledWith('notifications:markRead', 'notif-1');
    });
  });

  describe('archive', () => {
    it('should call archive:list channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ archives: [] });

      await ipcClient.archive.list();

      expect(mockInvoke).toHaveBeenCalledWith('archive:list');
    });

    it('should call archive:restore channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce(undefined);

      await ipcClient.archive.restore('archived.md');

      expect(mockInvoke).toHaveBeenCalledWith('archive:restore', 'archived.md');
    });
  });

  describe('dependencies', () => {
    it('should call dependencies:graph channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ graph: { nodes: [], edges: [] } });

      await ipcClient.dependencies.graph();

      expect(mockInvoke).toHaveBeenCalledWith('dependencies:graph');
    });
  });

  describe('importExport', () => {
    it('should call import:markdown channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ imported: [], errors: [] });

      await ipcClient.importExport.importMarkdown([{ filename: 'test.md', content: '# Test' }]);

      expect(mockInvoke).toHaveBeenCalledWith('import:markdown', {
        files: [{ filename: 'test.md', content: '# Test' }],
      });
    });

    it('should call export:backup channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ id: 'backup-1' });

      await ipcClient.importExport.backup();

      expect(mockInvoke).toHaveBeenCalledWith('export:backup');
    });
  });

  describe('settings', () => {
    it('should call settings:get channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ settings: {} });

      await ipcClient.settings.get();

      expect(mockInvoke).toHaveBeenCalledWith('settings:get');
    });

    it('should call settings:update channel', async () => {
      const { ipcClient } = await import('../ipcClient');
      mockInvoke.mockResolvedValueOnce({ settings: { theme: 'dark' } });

      await ipcClient.settings.update({ theme: 'dark' });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', { theme: 'dark' });
    });
  });
});

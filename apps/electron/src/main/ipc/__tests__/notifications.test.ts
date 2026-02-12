import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerNotificationsHandlers } from '../notifications.js';

vi.mock('../../services/notificationService.js', () => ({
  generateNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

describe('Notifications IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerNotificationsHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register notifications:list handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('notifications:list', expect.any(Function));
  });

  it('should register notifications:markRead handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('notifications:markRead', expect.any(Function));
  });

  it('should register notifications:markAllRead handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'notifications:markAllRead',
      expect.any(Function)
    );
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(3);
  });
});

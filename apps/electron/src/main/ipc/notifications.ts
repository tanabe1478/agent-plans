import type { NotificationsListResponse } from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import {
  generateNotifications,
  markAllAsRead,
  markAsRead,
} from '../services/notificationService.js';

/**
 * Register notifications-related IPC handlers
 */
export function registerNotificationsHandlers(ipcMain: Electron.IpcMain): void {
  // List all notifications
  ipcMain.handle(
    'notifications:list',
    async (_event: IpcMainInvokeEvent): Promise<NotificationsListResponse> => {
      const notifications = await generateNotifications();
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    }
  );

  // Mark a single notification as read
  ipcMain.handle(
    'notifications:markRead',
    async (_event: IpcMainInvokeEvent, notificationId: string): Promise<void> => {
      return markAsRead(notificationId);
    }
  );

  // Mark all notifications as read
  ipcMain.handle('notifications:markAllRead', async (_event: IpcMainInvokeEvent): Promise<void> => {
    return markAllAsRead();
  });
}

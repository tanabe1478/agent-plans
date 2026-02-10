import type { FastifyPluginAsync } from 'fastify';
import {
  generateNotifications,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService.js';

export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/notifications - List all notifications
  fastify.get('/', async () => {
    const notifications = await generateNotifications();
    const unreadCount = notifications.filter((n) => !n.read).length;
    return { notifications, unreadCount };
  });

  // PATCH /api/notifications/:id/read - Mark a notification as read
  fastify.patch<{
    Params: { id: string };
  }>('/:id/read', async (request, reply) => {
    const { id } = request.params;
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid notification ID' });
    }
    await markAsRead(id);
    return { success: true };
  });

  // POST /api/notifications/mark-all-read - Mark all notifications as read
  fastify.post('/mark-all-read', async () => {
    await markAllAsRead();
    return { success: true };
  });
};

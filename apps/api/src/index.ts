import cors from '@fastify/cors';
import Fastify from 'fastify';
import { config } from './config.js';
import { adminRoutes } from './routes/admin.js';
import { archiveRoutes } from './routes/archive.js';
import { dependenciesRoutes } from './routes/dependencies.js';
import { exportRoutes } from './routes/export.js';
import { importRoutes } from './routes/import.js';
import { notificationsRoutes } from './routes/notifications.js';
import { plansRoutes } from './routes/plans.js';
import { searchRoutes } from './routes/search.js';
import { settingsRoutes } from './routes/settings.js';
import { viewsRoutes } from './routes/views.js';

const fastify = Fastify({
  logger: true,
});

// Register CORS
await fastify.register(cors, {
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});

// Register routes
await fastify.register(plansRoutes, { prefix: '/api/plans' });
await fastify.register(searchRoutes, { prefix: '/api/search' });
await fastify.register(viewsRoutes, { prefix: '/api/views' });
await fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
await fastify.register(archiveRoutes, { prefix: '/api/archive' });
await fastify.register(dependenciesRoutes, { prefix: '/api/dependencies' });
await fastify.register(exportRoutes, { prefix: '/api/export' });
await fastify.register(importRoutes, { prefix: '/api/import' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });
await fastify.register(settingsRoutes, { prefix: '/api/settings' });

// Backup routes (registered under /api/backup for create/restore, /api/backups for list)
fastify.post('/api/backup', async (_request, reply) => {
  const { createBackup } = await import('./services/importService.js');
  try {
    const backup = await createBackup();
    return reply.status(201).send(backup);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return reply.status(500).send({ error: `Failed to create backup: ${message}` });
  }
});

fastify.get('/api/backups', async () => {
  const { listBackups } = await import('./services/importService.js');
  const backups = await listBackups();
  return { backups };
});

fastify.post<{ Params: { id: string } }>('/api/backup/:id/restore', async (request, reply) => {
  const { restoreBackup } = await import('./services/importService.js');
  const { id } = request.params;
  try {
    const result = await restoreBackup(id);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('ENOENT')) {
      return reply.status(404).send({ error: 'Backup not found' });
    }
    return reply.status(500).send({ error: `Failed to restore backup: ${message}` });
  }
});

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
try {
  await fastify.listen({ port: config.port, host: config.host });
  console.log(`Server running at http://localhost:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

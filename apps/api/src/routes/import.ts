import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createBackup,
  importMarkdownFiles,
  listBackups,
  restoreBackup,
} from '../services/importService.js';

const importFilesSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1),
        content: z.string(),
      })
    )
    .min(1),
});

export const importRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/import/markdown - Import markdown files
  fastify.post<{
    Body: { files: { filename: string; content: string }[] };
  }>('/markdown', async (request, reply) => {
    try {
      const { files } = importFilesSchema.parse(request.body);
      const result = await importMarkdownFiles(files);
      return result;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/backup - Create a backup
  fastify.post('/', async (_request, reply) => {
    try {
      const backup = await createBackup();
      return reply.status(201).send(backup);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to create backup: ${message}` });
    }
  });

  // GET /api/backups - List backups
  fastify.get('/', async () => {
    const backups = await listBackups();
    return { backups };
  });

  // POST /api/backup/:id/restore - Restore from backup
  fastify.post<{
    Params: { id: string };
  }>('/:id/restore', async (request, reply) => {
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
};

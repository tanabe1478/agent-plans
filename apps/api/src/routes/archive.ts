import type { ArchiveListResponse } from '@ccplans/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  cleanupExpired,
  listArchived,
  permanentlyDelete,
  restoreFromArchive,
} from '../services/archiveService.js';

const filenameSchema = z.string().regex(/^[a-zA-Z0-9_-]+\.md$/);

export const archiveRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/archive - List archived plans
  fastify.get<{ Reply: ArchiveListResponse }>('/', async () => {
    const archived = await listArchived();
    return { archived, total: archived.length };
  });

  // POST /api/archive/:filename/restore - Restore an archived plan
  fastify.post<{
    Params: { filename: string };
  }>('/:filename/restore', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      await restoreFromArchive(filename);
      return { success: true, message: 'Plan restored' };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('ENOENT')) {
        return reply.status(404).send({ error: 'Archived plan not found' });
      }
      throw err;
    }
  });

  // DELETE /api/archive/:filename - Permanently delete an archived plan
  fastify.delete<{
    Params: { filename: string };
  }>('/:filename', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      await permanentlyDelete(filename);
      return { success: true, message: 'Plan permanently deleted' };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('ENOENT')) {
        return reply.status(404).send({ error: 'Archived plan not found' });
      }
      throw err;
    }
  });

  // POST /api/archive/cleanup - Clean up expired archives
  fastify.post('/cleanup', async () => {
    const deleted = await cleanupExpired();
    return { success: true, deleted };
  });
};

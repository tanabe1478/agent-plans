import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  buildDependencyGraph,
  getPlanDependencies,
} from '../services/dependencyService.js';

const filenameSchema = z.string().regex(/^[a-zA-Z0-9_-]+\.md$/);

export const dependenciesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/dependencies - Full dependency graph
  fastify.get('/', async () => {
    return buildDependencyGraph();
  });

  // GET /api/dependencies/:filename - Dependencies for a specific plan
  fastify.get<{
    Params: { filename: string };
  }>('/:filename', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      return await getPlanDependencies(filename);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      throw err;
    }
  });
};

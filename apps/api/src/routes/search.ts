import type { SearchQuery, SearchResponse } from '@ccplans/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { searchService } from '../services/searchService.js';

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/search - Search plans
  fastify.get<{
    Querystring: SearchQuery;
    Reply: SearchResponse;
  }>('/', async (request, reply) => {
    try {
      const { q, limit } = searchQuerySchema.parse(request.query);
      const results = await searchService.search(q, limit);

      return {
        results,
        query: q,
        total: results.length,
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid query',
          details: err.errors,
        } as unknown as SearchResponse);
      }
      throw err;
    }
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { exportAsCsv, exportAsJson, exportAsTarGz } from '../services/exportService.js';

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv', 'zip']).default('json'),
  includeArchived: z.string().optional(),
  filterStatus: z.enum(['todo', 'in_progress', 'review', 'completed']).optional(),
  filterTags: z.string().optional(),
});

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/export?format=json|csv|zip
  fastify.get<{
    Querystring: {
      format?: string;
      includeArchived?: string;
      filterStatus?: string;
      filterTags?: string;
    };
  }>('/', async (request, reply) => {
    try {
      const query = exportQuerySchema.parse(request.query);

      const options = {
        includeArchived: query.includeArchived === 'true',
        filterStatus: query.filterStatus as import('@ccplans/shared').PlanStatus | undefined,
        filterTags: query.filterTags ? query.filterTags.split(',').map((t) => t.trim()) : undefined,
      };

      switch (query.format) {
        case 'json': {
          const json = await exportAsJson(options);
          return reply
            .header('Content-Type', 'application/json; charset=utf-8')
            .header('Content-Disposition', 'attachment; filename="plans-export.json"')
            .send(json);
        }
        case 'csv': {
          const csv = await exportAsCsv(options);
          return reply
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header('Content-Disposition', 'attachment; filename="plans-export.csv"')
            .send(csv);
        }
        case 'zip': {
          const tarGz = await exportAsTarGz(options);
          return reply
            .header('Content-Type', 'application/gzip')
            .header('Content-Disposition', 'attachment; filename="plans-export.tar.gz"')
            .send(tarGz);
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: err.errors });
      }
      throw err;
    }
  });
};

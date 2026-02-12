import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { exportAsCsv, exportAsJson, exportAsTarGz } from '../services/exportService.js';

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv', 'zip']).default('json'),
  filterStatus: z.enum(['todo', 'in_progress', 'review', 'completed']).optional(),
});

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/export?format=json|csv|zip
  fastify.get<{
    Querystring: {
      format?: string;
      filterStatus?: string;
    };
  }>('/', async (request, reply) => {
    try {
      const query = exportQuerySchema.parse(request.query);

      const options = {
        filterStatus: query.filterStatus as import('@ccplans/shared').PlanStatus | undefined,
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

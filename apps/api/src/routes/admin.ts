import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getAuditLog } from '../services/auditService.js';
import { getCurrentSchemaVersion, migrateAllPlans } from '../services/migrationService.js';

const auditQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),
  filename: z.string().optional(),
  action: z.string().optional(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/audit - Get audit log
  fastify.get<{
    Querystring: { limit?: string; filename?: string; action?: string };
  }>('/audit', async (request, reply) => {
    try {
      const { limit, filename, action } = auditQuerySchema.parse(request.query);
      const entries = await getAuditLog({ limit, filename, action });
      return { entries, total: entries.length };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/admin/migrate - Run migration on all plans
  fastify.post('/migrate', async () => {
    const result = await migrateAllPlans();
    return result;
  });

  // GET /api/admin/schema-version - Get current schema version
  fastify.get('/schema-version', async () => {
    return { version: getCurrentSchemaVersion() };
  });
};

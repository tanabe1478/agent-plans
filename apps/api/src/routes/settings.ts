import type { GetSettingsResponse, UpdateSettingsResponse } from '@ccplans/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSettings, updateSettings } from '../services/settingsService.js';

const updateSettingsSchema = z
  .object({
    frontmatterEnabled: z.boolean().optional(),
  })
  .strict();

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/settings
  fastify.get<{ Reply: GetSettingsResponse }>('/', async () => {
    return getSettings();
  });

  // PUT /api/settings
  fastify.put<{
    Body: z.infer<typeof updateSettingsSchema>;
    Reply: UpdateSettingsResponse;
  }>('/', async (request, reply) => {
    try {
      const body = updateSettingsSchema.parse(request.body);
      return await updateSettings(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: err.errors,
        } as unknown as UpdateSettingsResponse);
      }
      throw err;
    }
  });
};

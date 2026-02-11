import type {
  CreateViewRequest,
  SavedView,
  UpdateViewRequest,
  ViewsListResponse,
} from '@ccplans/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { viewService } from '../services/viewService.js';

const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.object({
    status: z.enum(['todo', 'in_progress', 'review', 'completed', 'all']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    tags: z.array(z.string()).optional(),
    assignee: z.string().optional(),
    dueBefore: z.string().optional(),
    dueAfter: z.string().optional(),
    searchQuery: z.string().optional(),
  }),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const updateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: z
    .object({
      status: z.enum(['todo', 'in_progress', 'review', 'completed', 'all']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      tags: z.array(z.string()).optional(),
      assignee: z.string().optional(),
      dueBefore: z.string().optional(),
      dueAfter: z.string().optional(),
      searchQuery: z.string().optional(),
    })
    .optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const viewIdSchema = z.string().uuid();

export const viewsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/views - List all views
  fastify.get<{ Reply: ViewsListResponse }>('/', async () => {
    const views = await viewService.listViews();
    return { views };
  });

  // POST /api/views - Create a view
  fastify.post<{ Body: CreateViewRequest; Reply: SavedView }>('/', async (request, reply) => {
    try {
      const body = createViewSchema.parse(request.body);
      const view = await viewService.createView(body);
      return reply.status(201).send(view);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply
          .status(400)
          .send({ error: 'Invalid request', details: err.errors } as unknown as SavedView);
      }
      throw err;
    }
  });

  // PUT /api/views/:id - Update a view
  fastify.put<{ Params: { id: string }; Body: UpdateViewRequest; Reply: SavedView }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      try {
        viewIdSchema.parse(id);
        const body = updateViewSchema.parse(request.body);
        const view = await viewService.updateView(id, body);
        return view;
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .status(400)
            .send({ error: 'Invalid request', details: err.errors } as unknown as SavedView);
        }
        if (err instanceof Error && err.message.startsWith('View not found')) {
          return reply.status(404).send({ error: 'View not found' } as unknown as SavedView);
        }
        throw err;
      }
    }
  );

  // DELETE /api/views/:id - Delete a view
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      viewIdSchema.parse(id);
      await viewService.deleteView(id);
      return { success: true, message: 'View deleted' };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid view ID' });
      }
      if (err instanceof Error && err.message.startsWith('View not found')) {
        return reply.status(404).send({ error: 'View not found' });
      }
      throw err;
    }
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { planService } from '../services/planService.js';
import { openerService } from '../services/openerService.js';
import type {
  PlansListResponse,
  PlanDetailResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
  UpdateStatusRequest,
  RenamePlanRequest,
  BulkDeleteRequest,
  OpenPlanRequest,
  ExportQuery,
} from '@ccplans/shared';

// Validation schemas
const filenameSchema = z.string().regex(/^[a-zA-Z0-9_-]+\.md$/);
const createPlanSchema = z.object({
  content: z.string().min(1),
  filename: z.string().regex(/^[a-zA-Z0-9_-]+\.md$/).optional(),
});
const updatePlanSchema = z.object({
  content: z.string().min(1),
});
const renamePlanSchema = z.object({
  newFilename: z.string().regex(/^[a-zA-Z0-9_-]+\.md$/),
});
const bulkDeleteSchema = z.object({
  filenames: z.array(z.string().regex(/^[a-zA-Z0-9_-]+\.md$/)).min(1),
});
const openPlanSchema = z.object({
  app: z.enum(['vscode', 'terminal', 'default']),
});
const updateStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'completed']),
});
const exportQuerySchema = z.object({
  format: z.enum(['md', 'pdf', 'html']).default('md'),
});

export const plansRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/plans - List all plans
  fastify.get<{ Reply: PlansListResponse }>('/', async () => {
    const plans = await planService.listPlans();
    return { plans, total: plans.length };
  });

  // GET /api/plans/:filename - Get plan details
  fastify.get<{
    Params: { filename: string };
    Reply: PlanDetailResponse;
  }>('/:filename', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
    } catch {
      return reply.status(400).send({ error: 'Invalid filename' } as unknown as PlanDetailResponse);
    }

    try {
      const plan = await planService.getPlan(filename);
      return plan;
    } catch (err) {
      return reply.status(404).send({ error: 'Plan not found' } as unknown as PlanDetailResponse);
    }
  });

  // POST /api/plans - Create new plan
  fastify.post<{
    Body: CreatePlanRequest;
  }>('/', async (request, reply) => {
    try {
      const { content, filename } = createPlanSchema.parse(request.body);
      const plan = await planService.createPlan(content, filename);
      return reply.status(201).send(plan);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // PUT /api/plans/:filename - Update plan
  fastify.put<{
    Params: { filename: string };
    Body: UpdatePlanRequest;
  }>('/:filename', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { content } = updatePlanSchema.parse(request.body);
      const plan = await planService.updatePlan(filename, content);
      return plan;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });

  // DELETE /api/plans/:filename - Delete plan
  fastify.delete<{
    Params: { filename: string };
    Querystring: { permanent?: string };
  }>('/:filename', async (request, reply) => {
    const { filename } = request.params;
    const permanent = request.query.permanent === 'true';

    try {
      filenameSchema.parse(filename);
      await planService.deletePlan(filename, !permanent);
      return { success: true, message: permanent ? 'Plan deleted' : 'Plan archived' };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });

  // POST /api/plans/bulk-delete - Bulk delete plans
  fastify.post<{
    Body: BulkDeleteRequest;
    Querystring: { permanent?: string };
  }>('/bulk-delete', async (request, reply) => {
    const permanent = request.query.permanent === 'true';

    try {
      const { filenames } = bulkDeleteSchema.parse(request.body);
      await planService.bulkDelete(filenames, !permanent);
      return { success: true, deleted: filenames.length };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/plans/:filename/rename - Rename plan
  fastify.post<{
    Params: { filename: string };
    Body: RenamePlanRequest;
  }>('/:filename/rename', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { newFilename } = renamePlanSchema.parse(request.body);
      const plan = await planService.renamePlan(filename, newFilename);
      return plan;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });

  // PATCH /api/plans/:filename/status - Update plan status
  fastify.patch<{
    Params: { filename: string };
    Body: UpdateStatusRequest;
  }>('/:filename/status', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { status } = updateStatusSchema.parse(request.body);
      const plan = await planService.updateStatus(filename, status);
      return plan;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });

  // POST /api/plans/:filename/open - Open with external app
  fastify.post<{
    Params: { filename: string };
    Body: OpenPlanRequest;
  }>('/:filename/open', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { app } = openPlanSchema.parse(request.body);
      const filePath = planService.getFilePath(filename);
      await openerService.openFile(filePath, app);
      return { success: true, message: `Opened with ${app}` };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      return reply.status(500).send({ error: 'Failed to open file' });
    }
  });

  // GET /api/plans/:filename/export - Export plan
  fastify.get<{
    Params: { filename: string };
    Querystring: ExportQuery;
  }>('/:filename/export', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { format } = exportQuerySchema.parse(request.query);
      const plan = await planService.getPlan(filename);
      const baseName = filename.replace(/\.md$/, '');

      switch (format) {
        case 'md':
          reply
            .header('Content-Type', 'text/markdown; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="${baseName}.md"`)
            .send(plan.content);
          break;
        case 'html': {
          const html = await generateHtml(plan.content, plan.title);
          reply
            .header('Content-Type', 'text/html; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="${baseName}.html"`)
            .send(html);
          break;
        }
        case 'pdf':
          // PDF generation will be implemented in Phase 6
          return reply.status(501).send({ error: 'PDF export not yet implemented' });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request' });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });
};

/**
 * Generate HTML from markdown content
 */
async function generateHtml(content: string, title: string): Promise<string> {
  // Simple markdown to HTML conversion
  // In Phase 6, we'll use a proper markdown parser
  const htmlContent = content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f6f8fa; }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
  </style>
</head>
<body>
  <p>${htmlContent}</p>
</body>
</html>`;
}

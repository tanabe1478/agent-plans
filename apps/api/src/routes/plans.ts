import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { planService } from '../services/planService.js';
import { openerService } from '../services/openerService.js';
import { isValidTransition } from '../services/statusTransitionService.js';
import {
  listVersions,
  getVersion,
  rollback as rollbackVersion,
  computeDiff,
} from '../services/historyService.js';
import { createPlanFromTemplate } from '../services/templateService.js';
import {
  addSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
} from '../services/subtaskService.js';
import { isFrontmatterEnabled } from '../services/settingsService.js';
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
  status: z.enum(['todo', 'in_progress', 'review', 'completed']),
});
const exportQuerySchema = z.object({
  format: z.enum(['md', 'pdf', 'html']).default('md'),
});
const rollbackSchema = z.object({
  version: z.string().min(1),
});

// Subtask schemas
const subtaskActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    subtask: z.object({
      title: z.string().min(1),
      status: z.enum(['todo', 'done']).default('todo'),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal('update'),
    subtaskId: z.string().min(1),
    subtask: z.object({
      title: z.string().min(1).optional(),
      status: z.enum(['todo', 'done']).optional(),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal('delete'),
    subtaskId: z.string().min(1),
  }),
  z.object({
    action: z.literal('toggle'),
    subtaskId: z.string().min(1),
  }),
]);

// Bulk operation schemas
const bulkFilenamesSchema = z.array(z.string().regex(/^[a-zA-Z0-9_-]+\.md$/)).min(1);

const bulkStatusSchema = z.object({
  filenames: bulkFilenamesSchema,
  status: z.enum(['todo', 'in_progress', 'review', 'completed']),
});
const bulkTagsSchema = z.object({
  filenames: bulkFilenamesSchema,
  action: z.enum(['add', 'remove']),
  tags: z.array(z.string().min(1)).min(1),
});
const bulkAssignSchema = z.object({
  filenames: bulkFilenamesSchema,
  assignee: z.string(),
});
const bulkPrioritySchema = z.object({
  filenames: bulkFilenamesSchema,
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});
const bulkArchiveSchema = z.object({
  filenames: bulkFilenamesSchema,
});

async function requireFrontmatter(reply: import('fastify').FastifyReply): Promise<boolean> {
  if (!(await isFrontmatterEnabled())) {
    reply.status(403).send({ error: 'Frontmatter features are disabled. Enable them in Settings.' });
    return false;
  }
  return true;
}

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

  // POST /api/plans/from-template - Create plan from template
  fastify.post<{
    Body: { templateName: string; title?: string; filename?: string };
  }>('/from-template', async (request, reply) => {
    const fromTemplateSchema = z.object({
      templateName: z.string().min(1),
      title: z.string().optional(),
      filename: z.string().regex(/^[a-zA-Z0-9_-]+\.md$/).optional(),
    });

    try {
      const { templateName, title, filename } = fromTemplateSchema.parse(request.body);
      const plan = await createPlanFromTemplate(templateName, title, filename);
      return reply.status(201).send(plan);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      if (err instanceof Error && err.message.includes('Template not found')) {
        return reply.status(404).send({ error: err.message });
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
      // Handle conflict errors from planService
      const conflict = (err as { conflict?: boolean; statusCode?: number; lastKnown?: number; current?: number }).conflict;
      if (conflict) {
        const conflictErr = err as { lastKnown?: number; current?: number };
        return reply.status(409).send({
          error: 'File was modified externally',
          conflict: true,
          lastKnown: conflictErr.lastKnown,
          current: conflictErr.current,
        });
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
    if (!(await requireFrontmatter(reply))) return;
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { status } = updateStatusSchema.parse(request.body);

      // Validate status transition
      const currentPlan = await planService.getPlanMeta(filename);
      const currentStatus = currentPlan.frontmatter?.status ?? 'todo';
      if (!isValidTransition(currentStatus, status)) {
        return reply.status(400).send({
          error: `Invalid status transition from '${currentStatus}' to '${status}'`,
        });
      }

      const plan = await planService.updateStatus(filename, status);
      return plan;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });

  // PATCH /api/plans/:filename/subtasks - Subtask operations
  fastify.patch<{
    Params: { filename: string };
    Body: z.infer<typeof subtaskActionSchema>;
  }>('/:filename/subtasks', async (request, reply) => {
    if (!(await requireFrontmatter(reply))) return;
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const body = subtaskActionSchema.parse(request.body);

      switch (body.action) {
        case 'add': {
          const subtask = await addSubtask(filename, body.subtask);
          return { success: true, subtask };
        }
        case 'update': {
          const subtask = await updateSubtask(filename, body.subtaskId, body.subtask);
          return { success: true, subtask };
        }
        case 'delete': {
          await deleteSubtask(filename, body.subtaskId);
          return { success: true };
        }
        case 'toggle': {
          const subtask = await toggleSubtask(filename, body.subtaskId);
          return { success: true, subtask };
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Subtask not found')) {
        return reply.status(404).send({ error: message });
      }
      if (message.includes('ENOENT')) {
        return reply.status(404).send({ error: 'Plan not found' });
      }
      throw err;
    }
  });

  // POST /api/plans/bulk-status - Bulk status change
  fastify.post<{
    Body: z.infer<typeof bulkStatusSchema>;
  }>('/bulk-status', async (request, reply) => {
    if (!(await requireFrontmatter(reply))) return;
    try {
      const { filenames, status } = bulkStatusSchema.parse(request.body);
      const succeeded: string[] = [];
      const failed: { filename: string; error: string }[] = [];

      for (const filename of filenames) {
        try {
          const currentPlan = await planService.getPlanMeta(filename);
          const currentStatus = currentPlan.frontmatter?.status ?? 'todo';
          if (!isValidTransition(currentStatus, status)) {
            failed.push({ filename, error: `Invalid transition from '${currentStatus}' to '${status}'` });
            continue;
          }
          await planService.updateStatus(filename, status);
          succeeded.push(filename);
        } catch (err) {
          failed.push({ filename, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return { succeeded, failed };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/plans/bulk-tags - Bulk tag add/remove
  fastify.post<{
    Body: z.infer<typeof bulkTagsSchema>;
  }>('/bulk-tags', async (request, reply) => {
    if (!(await requireFrontmatter(reply))) return;
    try {
      const { filenames, action, tags } = bulkTagsSchema.parse(request.body);
      const succeeded: string[] = [];
      const failed: { filename: string; error: string }[] = [];

      for (const filename of filenames) {
        try {
          const plan = await planService.getPlan(filename);
          const currentTags = plan.frontmatter?.tags || [];
          let newTags: string[];

          if (action === 'add') {
            const tagSet = new Set([...currentTags, ...tags]);
            newTags = Array.from(tagSet);
          } else {
            newTags = currentTags.filter((t) => !tags.includes(t));
          }

          await planService.updateFrontmatterField(filename, 'tags', newTags);
          succeeded.push(filename);
        } catch (err) {
          failed.push({ filename, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return { succeeded, failed };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/plans/bulk-assign - Bulk assignee change
  fastify.post<{
    Body: z.infer<typeof bulkAssignSchema>;
  }>('/bulk-assign', async (request, reply) => {
    if (!(await requireFrontmatter(reply))) return;
    try {
      const { filenames, assignee } = bulkAssignSchema.parse(request.body);
      const succeeded: string[] = [];
      const failed: { filename: string; error: string }[] = [];

      for (const filename of filenames) {
        try {
          await planService.updateFrontmatterField(filename, 'assignee', assignee);
          succeeded.push(filename);
        } catch (err) {
          failed.push({ filename, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return { succeeded, failed };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/plans/bulk-priority - Bulk priority change
  fastify.post<{
    Body: z.infer<typeof bulkPrioritySchema>;
  }>('/bulk-priority', async (request, reply) => {
    if (!(await requireFrontmatter(reply))) return;
    try {
      const { filenames, priority } = bulkPrioritySchema.parse(request.body);
      const succeeded: string[] = [];
      const failed: { filename: string; error: string }[] = [];

      for (const filename of filenames) {
        try {
          await planService.updateFrontmatterField(filename, 'priority', priority);
          succeeded.push(filename);
        } catch (err) {
          failed.push({ filename, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return { succeeded, failed };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
    }
  });

  // POST /api/plans/bulk-archive - Bulk archive
  fastify.post<{
    Body: z.infer<typeof bulkArchiveSchema>;
  }>('/bulk-archive', async (request, reply) => {
    try {
      const { filenames } = bulkArchiveSchema.parse(request.body);
      const succeeded: string[] = [];
      const failed: { filename: string; error: string }[] = [];

      for (const filename of filenames) {
        try {
          await planService.deletePlan(filename, true);
          succeeded.push(filename);
        } catch (err) {
          failed.push({ filename, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return { succeeded, failed };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      throw err;
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

  // GET /api/plans/:filename/history - List version history
  fastify.get<{
    Params: { filename: string };
  }>('/:filename/history', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const versions = await listVersions(filename);
      return { versions, filename };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }
      return reply.status(404).send({ error: 'Plan not found' });
    }
  });

  // GET /api/plans/:filename/history/:version - Get specific version content
  fastify.get<{
    Params: { filename: string; version: string };
  }>('/:filename/history/:version', async (request, reply) => {
    const { filename, version } = request.params;

    try {
      filenameSchema.parse(filename);
      const content = await getVersion(filename, version);
      return { content, version, filename };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request' });
      }
      return reply.status(404).send({ error: 'Version not found' });
    }
  });

  // POST /api/plans/:filename/rollback - Rollback to a specific version
  fastify.post<{
    Params: { filename: string };
    Body: { version: string };
  }>('/:filename/rollback', async (request, reply) => {
    const { filename } = request.params;

    try {
      filenameSchema.parse(filename);
      const { version } = rollbackSchema.parse(request.body);
      await rollbackVersion(filename, version);
      return { success: true, message: `Rolled back to version ${version}` };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      return reply.status(404).send({ error: 'Version not found' });
    }
  });

  // GET /api/plans/:filename/diff - Compute diff between versions
  fastify.get<{
    Params: { filename: string };
    Querystring: { from: string; to?: string };
  }>('/:filename/diff', async (request, reply) => {
    const { filename } = request.params;
    const { from, to } = request.query;

    try {
      filenameSchema.parse(filename);

      if (!from) {
        return reply.status(400).send({ error: 'Missing "from" query parameter' });
      }

      const oldContent = await getVersion(filename, from);

      let newContent: string;
      let newVersion: string;
      if (to) {
        newContent = await getVersion(filename, to);
        newVersion = to;
      } else {
        // Compare with current version
        const plan = await planService.getPlan(filename);
        newContent = plan.content;
        newVersion = 'current';
      }

      const diff = computeDiff(oldContent, newContent, from, newVersion);
      return diff;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request' });
      }
      return reply.status(404).send({ error: 'Version not found' });
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

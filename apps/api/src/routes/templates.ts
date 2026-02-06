import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  createPlanFromTemplate,
} from '../services/templateService.js';

const templateNameSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);

const createTemplateSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1),
  description: z.string(),
  category: z.enum(['research', 'implementation', 'refactor', 'incident', 'custom']),
  content: z.string().min(1),
  frontmatter: z
    .object({
      status: z.enum(['todo', 'in_progress', 'review', 'completed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

const createFromTemplateSchema = z.object({
  templateName: z.string().min(1),
  title: z.string().optional(),
  filename: z.string().regex(/^[a-zA-Z0-9_-]+\.md$/).optional(),
});

export const templatesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/templates - List all templates
  fastify.get('/', async () => {
    const templates = await listTemplates();
    return { templates };
  });

  // GET /api/templates/:name - Get a specific template
  fastify.get<{
    Params: { name: string };
  }>('/:name', async (request, reply) => {
    const { name } = request.params;

    try {
      templateNameSchema.parse(name);
    } catch {
      return reply.status(400).send({ error: 'Invalid template name' });
    }

    const template = await getTemplate(name);
    if (!template) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    return template;
  });

  // POST /api/templates - Create a custom template
  fastify.post('/', async (request, reply) => {
    try {
      const data = createTemplateSchema.parse(request.body);
      const template = await createTemplate({
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        category: data.category,
        content: data.content,
        frontmatter: data.frontmatter || {},
      });
      return reply.status(201).send(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: err.errors });
      }
      if (err instanceof Error && err.message.includes('Cannot overwrite')) {
        return reply.status(409).send({ error: err.message });
      }
      if (err instanceof Error && err.message.includes('Invalid template name')) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // DELETE /api/templates/:name - Delete a custom template
  fastify.delete<{
    Params: { name: string };
  }>('/:name', async (request, reply) => {
    const { name } = request.params;

    try {
      templateNameSchema.parse(name);
    } catch {
      return reply.status(400).send({ error: 'Invalid template name' });
    }

    try {
      await deleteTemplate(name);
      return { success: true, message: `Template '${name}' deleted` };
    } catch (err) {
      if (err instanceof Error && err.message.includes('Cannot delete built-in')) {
        return reply.status(403).send({ error: err.message });
      }
      if (err instanceof Error && err.message.includes('ENOENT')) {
        return reply.status(404).send({ error: 'Template not found' });
      }
      throw err;
    }
  });

  // POST /api/templates/from-template - Create a plan from a template
  fastify.post('/from-template', async (request, reply) => {
    try {
      const { templateName, title, filename } = createFromTemplateSchema.parse(request.body);
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
};

import type {
  BulkArchiveRequest,
  BulkAssignRequest,
  BulkDeleteRequest,
  BulkOperationResponse,
  BulkPriorityRequest,
  BulkStatusRequest,
  BulkTagsRequest,
  CreatePlanRequest,
  ExportFormat,
  ExternalApp,
  HistoryListResponse,
  PlanDetail,
  PlanFrontmatter,
  PlanMeta,
  PlanStatus,
  RenamePlanRequest,
  RollbackRequest,
  SubtaskActionRequest,
  UpdatePlanRequest,
  UpdateStatusRequest,
} from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { computeDiff, getVersion, listVersions, rollback } from '../services/historyService.js';
import { openerService } from '../services/openerService.js';
import { planService } from '../services/planService.js';
import { statusTransitionService } from '../services/statusTransitionService.js';
import { subtaskService } from '../services/subtaskService.js';

interface UpdatePlanRequestWithFilename extends UpdatePlanRequest {
  filename: string;
}

interface RenamePlanRequestWithFilename extends RenamePlanRequest {
  filename: string;
}

interface UpdateStatusRequestWithFilename extends UpdateStatusRequest {
  filename: string;
}

interface UpdateFrontmatterRequestWithFilename {
  filename: string;
  field: keyof PlanFrontmatter;
  value: unknown;
}

type SubtaskActionRequestWithFilename = SubtaskActionRequest & {
  filename: string;
};

interface RollbackRequestWithFilename extends RollbackRequest {
  filename: string;
}

interface BulkDeleteRequestWithArchive extends BulkDeleteRequest {
  archive?: boolean;
}

interface ExportedPlanFile {
  filename: string;
  content: string;
  mimeType: string;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

async function runBulkOperation(
  filenames: string[],
  op: (filename: string) => Promise<void>
): Promise<BulkOperationResponse> {
  const succeeded: string[] = [];
  const failed: { filename: string; error: string }[] = [];

  for (const filename of filenames) {
    try {
      await op(filename);
      succeeded.push(filename);
    } catch (err) {
      failed.push({ filename, error: toErrorMessage(err) });
    }
  }

  return { succeeded, failed };
}

function renderHtml(planTitle: string, markdown: string): string {
  const htmlContent = markdown
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${planTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
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

/**
 * Register all plans-related IPC handlers
 */
export function registerPlansHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('plans:list', async (_event: IpcMainInvokeEvent): Promise<PlanMeta[]> => {
    return planService.listPlans();
  });

  ipcMain.handle(
    'plans:get',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<PlanDetail> => {
      return planService.getPlan(filename);
    }
  );

  ipcMain.handle(
    'plans:create',
    async (_event: IpcMainInvokeEvent, request: CreatePlanRequest): Promise<PlanMeta> => {
      return planService.createPlan(request.content, request.filename);
    }
  );

  ipcMain.handle(
    'plans:update',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdatePlanRequestWithFilename
    ): Promise<PlanMeta> => {
      return planService.updatePlan(request.filename, request.content);
    }
  );

  ipcMain.handle(
    'plans:delete',
    async (_event: IpcMainInvokeEvent, filename: string, archive = true): Promise<void> => {
      return planService.deletePlan(filename, archive);
    }
  );

  ipcMain.handle(
    'plans:rename',
    async (
      _event: IpcMainInvokeEvent,
      request: RenamePlanRequestWithFilename
    ): Promise<PlanMeta> => {
      return planService.renamePlan(request.filename, request.newFilename);
    }
  );

  ipcMain.handle(
    'plans:updateStatus',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdateStatusRequestWithFilename
    ): Promise<PlanMeta> => {
      const plan = await planService.getPlan(request.filename);
      const currentStatus = plan.frontmatter?.status ?? 'todo';

      if (!statusTransitionService.isValidTransition(currentStatus, request.status)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${request.status}`);
      }

      return planService.updateStatus(request.filename, request.status);
    }
  );

  ipcMain.handle(
    'plans:updateFrontmatter',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdateFrontmatterRequestWithFilename
    ): Promise<PlanMeta> => {
      return planService.updateFrontmatterField(request.filename, request.field, request.value);
    }
  );

  ipcMain.handle(
    'plans:addSubtask',
    async (
      _event: IpcMainInvokeEvent,
      request: SubtaskActionRequestWithFilename
    ): Promise<void> => {
      if (request.action !== 'add') {
        throw new Error('Invalid action for plans:addSubtask');
      }
      await subtaskService.addSubtask(request.filename, request.subtask);
    }
  );

  ipcMain.handle(
    'plans:updateSubtask',
    async (
      _event: IpcMainInvokeEvent,
      request: SubtaskActionRequestWithFilename
    ): Promise<void> => {
      if (request.action !== 'update') {
        throw new Error('Invalid action for plans:updateSubtask');
      }
      await subtaskService.updateSubtask(request.filename, request.subtaskId, request.subtask);
    }
  );

  ipcMain.handle(
    'plans:deleteSubtask',
    async (
      _event: IpcMainInvokeEvent,
      request: SubtaskActionRequestWithFilename
    ): Promise<void> => {
      if (request.action !== 'delete') {
        throw new Error('Invalid action for plans:deleteSubtask');
      }
      await subtaskService.deleteSubtask(request.filename, request.subtaskId);
    }
  );

  ipcMain.handle(
    'plans:toggleSubtask',
    async (
      _event: IpcMainInvokeEvent,
      request: SubtaskActionRequestWithFilename
    ): Promise<void> => {
      if (request.action !== 'toggle') {
        throw new Error('Invalid action for plans:toggleSubtask');
      }
      await subtaskService.toggleSubtask(request.filename, request.subtaskId);
    }
  );

  ipcMain.handle(
    'plans:bulkDelete',
    async (_event: IpcMainInvokeEvent, request: BulkDeleteRequestWithArchive): Promise<void> => {
      await planService.bulkDelete(request.filenames, request.archive ?? true);
    }
  );

  ipcMain.handle(
    'plans:bulkStatus',
    async (
      _event: IpcMainInvokeEvent,
      request: BulkStatusRequest
    ): Promise<BulkOperationResponse> => {
      return runBulkOperation(request.filenames, async (filename) => {
        const plan = await planService.getPlan(filename);
        const currentStatus = plan.frontmatter?.status ?? 'todo';

        if (!statusTransitionService.isValidTransition(currentStatus, request.status)) {
          throw new Error(`Invalid transition from ${currentStatus} to ${request.status}`);
        }

        await planService.updateStatus(filename, request.status);
      });
    }
  );

  ipcMain.handle(
    'plans:bulkTags',
    async (
      _event: IpcMainInvokeEvent,
      request: BulkTagsRequest
    ): Promise<BulkOperationResponse> => {
      return runBulkOperation(request.filenames, async (filename) => {
        const plan = await planService.getPlan(filename);
        const currentTags = plan.frontmatter?.tags ?? [];

        let tags: string[];
        if (request.action === 'add') {
          tags = Array.from(new Set([...currentTags, ...request.tags]));
        } else if (request.action === 'remove') {
          tags = currentTags.filter((tag) => !request.tags.includes(tag));
        } else {
          tags = request.tags;
        }

        await planService.updateFrontmatterField(filename, 'tags', tags);
      });
    }
  );

  ipcMain.handle(
    'plans:bulkAssign',
    async (
      _event: IpcMainInvokeEvent,
      request: BulkAssignRequest
    ): Promise<BulkOperationResponse> => {
      return runBulkOperation(request.filenames, async (filename) => {
        await planService.updateFrontmatterField(filename, 'assignee', request.assignee);
      });
    }
  );

  ipcMain.handle(
    'plans:bulkPriority',
    async (
      _event: IpcMainInvokeEvent,
      request: BulkPriorityRequest
    ): Promise<BulkOperationResponse> => {
      return runBulkOperation(request.filenames, async (filename) => {
        await planService.updateFrontmatterField(filename, 'priority', request.priority);
      });
    }
  );

  ipcMain.handle(
    'plans:bulkArchive',
    async (
      _event: IpcMainInvokeEvent,
      request: BulkArchiveRequest
    ): Promise<BulkOperationResponse> => {
      return runBulkOperation(request.filenames, async (filename) => {
        await planService.deletePlan(filename, true);
      });
    }
  );

  ipcMain.handle(
    'plans:open',
    async (_event: IpcMainInvokeEvent, filename: string, app: ExternalApp): Promise<void> => {
      const filePath = planService.getFilePath(filename);
      await openerService.openFile(filePath, app);
    }
  );

  ipcMain.handle(
    'plans:history',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<HistoryListResponse> => {
      const versions = await listVersions(filename);
      return { versions, filename };
    }
  );

  ipcMain.handle(
    'plans:rollback',
    async (_event: IpcMainInvokeEvent, request: RollbackRequestWithFilename): Promise<void> => {
      return rollback(request.filename, request.version);
    }
  );

  ipcMain.handle(
    'plans:diff',
    async (
      _event: IpcMainInvokeEvent,
      filename: string,
      oldVersion: string,
      newVersion?: string
    ) => {
      const oldContent = await getVersion(filename, oldVersion);
      let newContent: string;

      if (newVersion) {
        newContent = await getVersion(filename, newVersion);
      } else {
        const plan = await planService.getPlan(filename);
        newContent = plan.content;
      }

      return computeDiff(oldContent, newContent, oldVersion, newVersion ?? 'current');
    }
  );

  ipcMain.handle(
    'plans:export',
    async (
      _event: IpcMainInvokeEvent,
      filename: string,
      format: ExportFormat
    ): Promise<ExportedPlanFile> => {
      const plan = await planService.getPlan(filename);
      const baseName = plan.filename.replace(/\.md$/, '');

      switch (format) {
        case 'md':
          return {
            filename: `${baseName}.md`,
            content: plan.content,
            mimeType: 'text/markdown; charset=utf-8',
          };
        case 'html':
          return {
            filename: `${baseName}.html`,
            content: renderHtml(plan.title, plan.content),
            mimeType: 'text/html; charset=utf-8',
          };
        case 'pdf':
          throw new Error('PDF export not yet implemented');
        default:
          throw new Error(`Unsupported format: ${String(format)}`);
      }
    }
  );

  ipcMain.handle(
    'plans:availableTransitions',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<PlanStatus[]> => {
      const plan = await planService.getPlan(filename);
      const currentStatus = plan.frontmatter?.status ?? 'todo';
      return statusTransitionService.getAvailableTransitions(currentStatus);
    }
  );
}

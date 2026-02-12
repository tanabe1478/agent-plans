// @ts-nocheck
import type {
  BulkAssignRequest,
  BulkDeleteRequest,
  BulkStatusRequest,
  BulkTagsRequest,
  CreatePlanRequest,
  PlanDetail,
  PlanMeta,
  PlanStatus,
  RenamePlanRequest,
  RollbackRequest,
  SubtaskActionRequest,
  UpdateFrontmatterRequest,
  UpdatePlanRequest,
  UpdateStatusRequest,
} from '@ccplans/shared';
import type { IpcMainInvokeEvent } from 'electron';
import { computeDiff, getVersion, listVersions, rollback } from '../services/historyService.js';
import { openerService } from '../services/openerService.js';
import { planService } from '../services/planService.js';
import { statusTransitionService } from '../services/statusTransitionService.js';
import { subtaskService } from '../services/subtaskService.js';

// Extended request types for IPC (includes filename which is passed separately from the API)
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
  frontmatter: UpdateFrontmatterRequest['frontmatter'];
  field: string;
  value: unknown;
}
interface SubtaskActionRequestWithFilename extends SubtaskActionRequest {
  filename: string;
}
interface RollbackRequestWithFilename extends RollbackRequest {
  filename: string;
}

/**
 * Register all plans-related IPC handlers
 */
export function registerPlansHandlers(ipcMain: Electron.IpcMain): void {
  // List all plans
  ipcMain.handle('plans:list', async (_event: IpcMainInvokeEvent): Promise<PlanMeta[]> => {
    return planService.listPlans();
  });

  // Get a single plan
  ipcMain.handle(
    'plans:get',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<PlanDetail> => {
      return planService.getPlan(filename);
    }
  );

  // Create a new plan
  ipcMain.handle(
    'plans:create',
    async (_event: IpcMainInvokeEvent, request: CreatePlanRequest): Promise<PlanMeta> => {
      return planService.createPlan(request.content, request.filename);
    }
  );

  // Update an existing plan
  ipcMain.handle(
    'plans:update',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdatePlanRequestWithFilename
    ): Promise<PlanMeta> => {
      return planService.updatePlan(request.filename, request.content);
    }
  );

  // Delete a plan
  ipcMain.handle(
    'plans:delete',
    async (_event: IpcMainInvokeEvent, filename: string, archive = true): Promise<void> => {
      return planService.deletePlan(filename, archive);
    }
  );

  // Rename a plan
  ipcMain.handle(
    'plans:rename',
    async (
      _event: IpcMainInvokeEvent,
      request: RenamePlanRequestWithFilename
    ): Promise<PlanMeta> => {
      return planService.renamePlan(request.filename, request.newFilename);
    }
  );

  // Update plan status with validation
  ipcMain.handle(
    'plans:updateStatus',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdateStatusRequestWithFilename
    ): Promise<PlanMeta> => {
      // Get current plan to check status transition
      const plan = await planService.getPlan(request.filename);
      const currentStatus = plan.frontmatter?.status ?? 'todo';

      // Validate transition
      if (!statusTransitionService.isValidTransition(currentStatus, request.status)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${request.status}`);
      }

      return planService.updateStatus(request.filename, request.status);
    }
  );

  // Update frontmatter field
  ipcMain.handle(
    'plans:updateFrontmatter',
    async (
      _event: IpcMainInvokeEvent,
      request: UpdateFrontmatterRequestWithFilename
    ): Promise<PlanMeta> => {
      return planService.updateFrontmatterField(request.filename, request.field, request.value);
    }
  );

  // Subtask actions
  ipcMain.handle(
    'plans:addSubtask',
    async (
      _event: IpcMainInvokeEvent,
      request: SubtaskActionRequestWithFilename
    ): Promise<void> => {
      if (!request.subtask) {
        throw new Error('Subtask data is required');
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
      if (!request.subtaskId || !request.subtask) {
        throw new Error('Subtask ID and data are required');
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
      if (!request.subtaskId) {
        throw new Error('Subtask ID is required');
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
      if (!request.subtaskId) {
        throw new Error('Subtask ID is required');
      }
      await subtaskService.toggleSubtask(request.filename, request.subtaskId);
    }
  );

  // Bulk operations
  ipcMain.handle(
    'plans:bulkDelete',
    async (_event: IpcMainInvokeEvent, request: BulkDeleteRequest): Promise<void> => {
      await planService.bulkDelete(request.filenames, request.archive ?? true);
    }
  );

  ipcMain.handle(
    'plans:bulkStatus',
    async (
      _event: IpcMainInvokeEvent,
      request: BulkStatusRequest
    ): Promise<{ success: string[]; failed: { filename: string; error: string }[] }> => {
      const success: string[] = [];
      const failed: { filename: string; error: string }[] = [];

      for (const filename of request.filenames) {
        try {
          const plan = await planService.getPlan(filename);
          const currentStatus = plan.frontmatter?.status ?? 'todo';

          if (statusTransitionService.isValidTransition(currentStatus, request.status)) {
            await planService.updateStatus(filename, request.status);
            success.push(filename);
          } else {
            failed.push({
              filename,
              error: `Invalid transition from ${currentStatus} to ${request.status}`,
            });
          }
        } catch (err) {
          failed.push({
            filename,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return { success, failed };
    }
  );

  ipcMain.handle(
    'plans:bulkTags',
    async (_event: IpcMainInvokeEvent, request: BulkTagsRequest): Promise<void> => {
      for (const filename of request.filenames) {
        await planService.updateFrontmatterField(filename, 'tags', request.tags);
      }
    }
  );

  ipcMain.handle(
    'plans:bulkAssign',
    async (_event: IpcMainInvokeEvent, request: BulkAssignRequest): Promise<void> => {
      for (const filename of request.filenames) {
        await planService.updateFrontmatterField(filename, 'assignee', request.assignee);
      }
    }
  );

  // Open plan in external app
  ipcMain.handle(
    'plans:open',
    async (_event: IpcMainInvokeEvent, filename: string, app: string): Promise<void> => {
      const filePath = planService.getFilePath(filename);
      await openerService.openFile(filePath, app as 'vscode' | 'terminal' | 'default');
    }
  );

  // History operations
  ipcMain.handle('plans:history', async (_event: IpcMainInvokeEvent, filename: string) => {
    return listVersions(filename);
  });

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
        // Compare with current version
        const plan = await planService.getPlan(filename);
        newContent = plan.content;
      }

      return computeDiff(oldContent, newContent, oldVersion, newVersion ?? 'current');
    }
  );

  // Export single plan
  ipcMain.handle(
    'plans:export',
    async (_event: IpcMainInvokeEvent, filename: string, format: 'json' | 'markdown') => {
      const plan = await planService.getPlan(filename);

      if (format === 'json') {
        return JSON.stringify(
          {
            filename: plan.filename,
            frontmatter: plan.frontmatter,
            content: plan.content,
          },
          null,
          2
        );
      }

      return plan.content;
    }
  );

  // Get available status transitions
  ipcMain.handle(
    'plans:availableTransitions',
    async (_event: IpcMainInvokeEvent, filename: string): Promise<PlanStatus[]> => {
      const plan = await planService.getPlan(filename);
      const currentStatus = plan.frontmatter?.status ?? 'todo';
      return statusTransitionService.getAvailableTransitions(currentStatus);
    }
  );
}

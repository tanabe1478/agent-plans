import type {
  BulkDeleteRequest,
  BulkOperationResponse,
  BulkStatusRequest,
  CreatePlanRequest,
  ExternalApp,
  PlanDetail,
  PlanFrontmatter,
  PlanMeta,
  PlanStatus,
  RenamePlanRequest,
  SubtaskActionRequest,
  UpdatePlanRequest,
  UpdateStatusRequest,
} from '@ccplans/shared';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
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
    async (_event: IpcMainInvokeEvent, filename: string): Promise<void> => {
      // Native app policy: delete permanently (no archive/restore feature).
      return planService.deletePlan(filename, false);
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
    async (_event: IpcMainInvokeEvent, request: BulkDeleteRequest): Promise<void> => {
      // Native app policy: delete permanently (no archive/restore feature).
      await planService.bulkDelete(request.filenames, false);
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
    'plans:open',
    async (_event: IpcMainInvokeEvent, filename: string, app: ExternalApp): Promise<void> => {
      const filePath = await planService.getFilePath(filename);
      await openerService.openFile(filePath, app);
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

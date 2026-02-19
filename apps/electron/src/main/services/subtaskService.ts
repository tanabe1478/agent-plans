import { randomUUID } from 'node:crypto';
import type { Subtask } from '@agent-plans/shared';
import { config } from '../config.js';
import type { MetadataService } from './metadataService.js';
import { getDefaultMetadataService } from './planService.js';

export function getSubtaskProgress(subtasks: Subtask[]): {
  done: number;
  total: number;
  percentage: number;
} {
  const total = subtasks.length;
  if (total === 0) return { done: 0, total: 0, percentage: 0 };
  const done = subtasks.filter((s) => s.status === 'done').length;
  const percentage = Math.round((done / total) * 100);
  return { done, total, percentage };
}

export interface SubtaskServiceConfig {
  plansDir: string;
  metadataService: MetadataService;
}

/**
 * SubtaskService manages subtasks via the SQLite metadata database.
 *
 * After the frontmatter-to-DB migration, subtask state lives exclusively in
 * the `subtasks` table.  Plan markdown files are never modified by this service.
 */
export class SubtaskService {
  private metadataService: MetadataService;

  constructor(cfg: SubtaskServiceConfig) {
    this.metadataService = cfg.metadataService;
  }

  /**
   * Ensure the plan has a metadata row so the subtask foreign key is valid.
   */
  private ensureMetadataExists(filename: string): void {
    const existing = this.metadataService.getMetadata(filename);
    if (!existing) {
      const now = new Date().toISOString();
      this.metadataService.upsertMetadata(filename, {
        source: 'markdown',
        status: 'todo',
        createdAt: now,
        modifiedAt: now,
      });
    }
  }

  /**
   * Get the next sort order for a new subtask.
   */
  private getNextSortOrder(filename: string): number {
    const existing = this.metadataService.listSubtasks(filename);
    if (existing.length === 0) return 0;
    return Math.max(...existing.map((s) => s.sortOrder)) + 1;
  }

  async addSubtask(filename: string, subtask: Omit<Subtask, 'id'>): Promise<Subtask> {
    this.ensureMetadataExists(filename);

    const newSubtask: Subtask = {
      id: randomUUID(),
      title: subtask.title,
      status: subtask.status || 'todo',
      ...(subtask.assignee ? { assignee: subtask.assignee } : {}),
      ...(subtask.dueDate ? { dueDate: subtask.dueDate } : {}),
    };

    this.metadataService.upsertSubtask(filename, {
      id: newSubtask.id,
      title: newSubtask.title,
      status: newSubtask.status as 'todo' | 'done',
      assignee: newSubtask.assignee ?? null,
      dueDate: newSubtask.dueDate ?? null,
      sortOrder: this.getNextSortOrder(filename),
    });

    return newSubtask;
  }

  async updateSubtask(
    filename: string,
    subtaskId: string,
    update: Partial<Omit<Subtask, 'id'>>
  ): Promise<Subtask> {
    const existing = this.metadataService.listSubtasks(filename);
    const current = existing.find((s) => s.id === subtaskId);

    if (!current) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    const updated: Subtask = {
      id: current.id,
      title: update.title ?? current.title,
      status: (update.status as 'todo' | 'done') ?? current.status,
      ...(('assignee' in update ? update.assignee : current.assignee)
        ? { assignee: update.assignee ?? current.assignee ?? undefined }
        : {}),
      ...(('dueDate' in update ? update.dueDate : current.dueDate)
        ? { dueDate: update.dueDate ?? current.dueDate ?? undefined }
        : {}),
    };

    this.metadataService.upsertSubtask(filename, {
      id: updated.id,
      title: updated.title,
      status: updated.status as 'todo' | 'done',
      assignee: updated.assignee ?? null,
      dueDate: updated.dueDate ?? null,
      sortOrder: current.sortOrder,
    });

    return updated;
  }

  async deleteSubtask(filename: string, subtaskId: string): Promise<void> {
    const existing = this.metadataService.listSubtasks(filename);
    const current = existing.find((s) => s.id === subtaskId);

    if (!current) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    this.metadataService.deleteSubtask(filename, subtaskId);
  }

  async toggleSubtask(filename: string, subtaskId: string): Promise<Subtask> {
    const existing = this.metadataService.listSubtasks(filename);
    const current = existing.find((s) => s.id === subtaskId);

    if (!current) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    const newStatus = current.status === 'done' ? 'todo' : 'done';

    this.metadataService.upsertSubtask(filename, {
      id: current.id,
      title: current.title,
      status: newStatus,
      assignee: current.assignee,
      dueDate: current.dueDate,
      sortOrder: current.sortOrder,
    });

    return {
      id: current.id,
      title: current.title,
      status: newStatus,
      ...(current.assignee ? { assignee: current.assignee } : {}),
      ...(current.dueDate ? { dueDate: current.dueDate } : {}),
    };
  }
}

type SubtaskServiceFacade = Pick<
  SubtaskService,
  'addSubtask' | 'updateSubtask' | 'deleteSubtask' | 'toggleSubtask'
>;

let defaultSubtaskService: SubtaskService | null = null;

function getSubtaskService(): SubtaskService {
  if (!defaultSubtaskService) {
    defaultSubtaskService = new SubtaskService({
      plansDir: config.plansDir,
      metadataService: getDefaultMetadataService(),
    });
  }
  return defaultSubtaskService;
}

// Default singleton facade (lazy-initialized to avoid DB side effects at import time)
export const subtaskService: SubtaskServiceFacade = {
  addSubtask: (...args) => getSubtaskService().addSubtask(...args),
  updateSubtask: (...args) => getSubtaskService().updateSubtask(...args),
  deleteSubtask: (...args) => getSubtaskService().deleteSubtask(...args),
  toggleSubtask: (...args) => getSubtaskService().toggleSubtask(...args),
};

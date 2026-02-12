import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Notification,
  NotificationSeverity,
  NotificationType,
  PlanMeta,
} from '@ccplans/shared';
import { config } from '../config.js';
import { planService } from './planService.js';

function generateId(type: NotificationType, planFilename: string, date: string): string {
  const raw = `${type}-${planFilename}-${date}`;
  return createHash('md5').update(raw).digest('hex').slice(0, 12);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface NotificationServiceConfig {
  plansDir: string;
}

/**
 * Plan provider interface for dependency injection
 * This allows the notification service to get plans without directly importing planService
 */
export interface PlanProvider {
  listPlans(): Promise<PlanMeta[]>;
}

export class NotificationService {
  private plansDir: string;
  private planProvider: PlanProvider;

  constructor(config: NotificationServiceConfig, planProvider: PlanProvider) {
    this.plansDir = config.plansDir;
    this.planProvider = planProvider;
  }

  private get readFile(): string {
    return join(this.plansDir, '.notifications-read.json');
  }

  private async loadReadIds(): Promise<Set<string>> {
    try {
      const data = await readFile(this.readFile, 'utf-8');
      const parsed = JSON.parse(data);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  private async saveReadIds(ids: Set<string>): Promise<void> {
    await writeFile(this.readFile, JSON.stringify([...ids]), 'utf-8');
  }

  async generateNotifications(): Promise<Notification[]> {
    const plans = await this.planProvider.listPlans();
    const readIds = await this.loadReadIds();
    const notifications: Notification[] = [];
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    for (const plan of plans) {
      const status = plan.frontmatter?.status ?? 'todo';
      if (status === 'completed') continue;

      const dueDate = plan.frontmatter?.dueDate;
      if (dueDate) {
        const due = startOfDay(new Date(dueDate));

        if (due < today) {
          // Overdue
          const id = generateId('overdue', plan.filename, dueDate);
          notifications.push({
            id,
            type: 'overdue',
            planFilename: plan.filename,
            planTitle: plan.title,
            message: `"${plan.title}" is overdue (due ${dueDate})`,
            severity: 'critical',
            createdAt: now.toISOString(),
            read: readIds.has(id),
          });
        } else if (due.getTime() === today.getTime()) {
          // Due today
          const id = generateId('due_soon', plan.filename, dueDate);
          notifications.push({
            id,
            type: 'due_soon',
            planFilename: plan.filename,
            planTitle: plan.title,
            message: `"${plan.title}" is due today`,
            severity: 'warning',
            createdAt: now.toISOString(),
            read: readIds.has(id),
          });
        } else if (due >= tomorrow && due < dayAfterTomorrow) {
          // Due tomorrow
          const id = generateId('due_soon', plan.filename, dueDate);
          notifications.push({
            id,
            type: 'due_soon',
            planFilename: plan.filename,
            planTitle: plan.title,
            message: `"${plan.title}" is due tomorrow`,
            severity: 'info',
            createdAt: now.toISOString(),
            read: readIds.has(id),
          });
        }
      }

      // Blocked and stale check
      const blockedBy = plan.frontmatter?.blockedBy;
      if (blockedBy && blockedBy.length > 0 && status === 'in_progress') {
        const modified = plan.frontmatter?.modified || plan.modifiedAt;
        const modifiedDate = new Date(modified);
        if (modifiedDate < threeDaysAgo) {
          const dateStr = modifiedDate.toISOString().split('T')[0];
          const id = generateId('blocked_stale', plan.filename, dateStr);
          notifications.push({
            id,
            type: 'blocked_stale',
            planFilename: plan.filename,
            planTitle: plan.title,
            message: `"${plan.title}" is blocked and hasn't been updated in 3+ days`,
            severity: 'warning',
            createdAt: now.toISOString(),
            read: readIds.has(id),
          });
        }
      }
    }

    // Sort by severity (critical first) then by creation time
    const severityOrder: Record<NotificationSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    notifications.sort((a, b) => {
      const diff = severityOrder[a.severity] - severityOrder[b.severity];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return notifications;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const readIds = await this.loadReadIds();
    readIds.add(notificationId);
    await this.saveReadIds(readIds);
  }

  async markAllAsRead(): Promise<void> {
    const notifications = await this.generateNotifications();
    const readIds = await this.loadReadIds();
    for (const n of notifications) {
      readIds.add(n.id);
    }
    await this.saveReadIds(readIds);
  }
}

// Default singleton instance
const notificationService = new NotificationService({ plansDir: config.plansDir }, planService);

// Function exports for backward compatibility with IPC handlers
export async function generateNotifications(): Promise<Notification[]> {
  return notificationService.generateNotifications();
}

export async function markAsRead(notificationId: string): Promise<void> {
  return notificationService.markAsRead(notificationId);
}

export async function markAllAsRead(): Promise<void> {
  return notificationService.markAllAsRead();
}

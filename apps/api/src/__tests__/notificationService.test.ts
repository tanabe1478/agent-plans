import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlanMeta } from '@ccplans/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testDir = join(
  tmpdir(),
  `ccplans-notify-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

vi.mock('../config.js', () => ({
  config: {
    plansDir: testDir,
    port: 3001,
    host: '0.0.0.0',
    corsOrigins: ['http://localhost:5173'],
    maxFileSize: 10 * 1024 * 1024,
    previewLength: 200,
  },
}));

// Mock planService.listPlans - we'll control the return value per test
const mockListPlans = vi.fn();

vi.mock('../services/planService.js', () => ({
  planService: {
    listPlans: (...args: unknown[]) => mockListPlans(...args),
  },
}));

const { generateNotifications, markAsRead, markAllAsRead } = await import(
  '../services/notificationService.js'
);

function makePlan(overrides: Partial<PlanMeta> = {}): PlanMeta {
  return {
    filename: 'test-plan.md',
    title: 'Test Plan',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    size: 100,
    preview: 'Test preview',
    sections: [],
    ...overrides,
  };
}

describe('NotificationService', () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    mockListPlans.mockReset();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('generateNotifications', () => {
    it('should generate due_soon warning for plans due today', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'due-today.md',
          title: 'Due Today Plan',
          frontmatter: { status: 'todo', dueDate: todayStr },
        }),
      ]);

      const notifications = await generateNotifications();

      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('due_soon');
      expect(notifications[0].severity).toBe('warning');
      expect(notifications[0].planFilename).toBe('due-today.md');
      expect(notifications[0].message).toContain('due today');
    });

    it('should generate due_soon info for plans due tomorrow', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'due-tomorrow.md',
          title: 'Due Tomorrow Plan',
          frontmatter: { status: 'in_progress', dueDate: tomorrowStr },
        }),
      ]);

      const notifications = await generateNotifications();

      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('due_soon');
      expect(notifications[0].severity).toBe('info');
      expect(notifications[0].message).toContain('due tomorrow');
    });

    it('should generate overdue critical for past due plans', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const pastStr = pastDate.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'overdue-plan.md',
          title: 'Overdue Plan',
          frontmatter: { status: 'todo', dueDate: pastStr },
        }),
      ]);

      const notifications = await generateNotifications();

      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('overdue');
      expect(notifications[0].severity).toBe('critical');
      expect(notifications[0].planFilename).toBe('overdue-plan.md');
    });

    it('should not generate notifications for completed plans', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const pastStr = pastDate.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'completed-plan.md',
          title: 'Completed Plan',
          frontmatter: { status: 'completed', dueDate: pastStr },
        }),
      ]);

      const notifications = await generateNotifications();
      expect(notifications.length).toBe(0);
    });

    it('should generate blocked_stale for blocked in_progress plans not modified in 3+ days', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'blocked-stale.md',
          title: 'Blocked Stale Plan',
          modifiedAt: fiveDaysAgo.toISOString(),
          frontmatter: {
            status: 'in_progress',
            blockedBy: ['other-plan.md'],
            modified: fiveDaysAgo.toISOString(),
          },
        }),
      ]);

      const notifications = await generateNotifications();

      const staleNotif = notifications.find((n) => n.type === 'blocked_stale');
      expect(staleNotif).toBeDefined();
      expect(staleNotif?.severity).toBe('warning');
      expect(staleNotif?.message).toContain('blocked');
      expect(staleNotif?.message).toContain('3+ days');
    });

    it('should NOT generate blocked_stale when modified recently', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'blocked-recent.md',
          title: 'Blocked Recent Plan',
          modifiedAt: yesterday.toISOString(),
          frontmatter: {
            status: 'in_progress',
            blockedBy: ['other-plan.md'],
            modified: yesterday.toISOString(),
          },
        }),
      ]);

      const notifications = await generateNotifications();

      const staleNotif = notifications.find((n) => n.type === 'blocked_stale');
      expect(staleNotif).toBeUndefined();
    });

    it('should NOT generate blocked_stale for non-in_progress plans', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'blocked-todo.md',
          title: 'Blocked Todo Plan',
          modifiedAt: fiveDaysAgo.toISOString(),
          frontmatter: {
            status: 'todo',
            blockedBy: ['other-plan.md'],
            modified: fiveDaysAgo.toISOString(),
          },
        }),
      ]);

      const notifications = await generateNotifications();

      const staleNotif = notifications.find((n) => n.type === 'blocked_stale');
      expect(staleNotif).toBeUndefined();
    });

    it('should generate unique IDs for different plans', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'plan-a.md',
          title: 'Plan A',
          frontmatter: { status: 'todo', dueDate: today },
        }),
        makePlan({
          filename: 'plan-b.md',
          title: 'Plan B',
          frontmatter: { status: 'todo', dueDate: today },
        }),
      ]);

      const notifications = await generateNotifications();

      expect(notifications.length).toBe(2);
      expect(notifications[0].id).not.toBe(notifications[1].id);
    });

    it('should not generate due date notifications when dueDate is not set', async () => {
      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'no-due.md',
          title: 'No Due Date Plan',
          frontmatter: { status: 'todo' },
        }),
      ]);

      const notifications = await generateNotifications();
      expect(notifications.length).toBe(0);
    });

    it('should not generate due notifications for future dates beyond tomorrow', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'future-plan.md',
          title: 'Future Plan',
          frontmatter: { status: 'todo', dueDate: nextWeekStr },
        }),
      ]);

      const notifications = await generateNotifications();
      expect(notifications.length).toBe(0);
    });

    it('should sort notifications by severity (critical first)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const pastStr = pastDate.toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'tomorrow-plan.md',
          title: 'Tomorrow Plan',
          frontmatter: { status: 'todo', dueDate: tomorrowStr },
        }),
        makePlan({
          filename: 'today-plan.md',
          title: 'Today Plan',
          frontmatter: { status: 'todo', dueDate: today },
        }),
        makePlan({
          filename: 'overdue-plan.md',
          title: 'Overdue Plan',
          frontmatter: { status: 'todo', dueDate: pastStr },
        }),
      ]);

      const notifications = await generateNotifications();

      expect(notifications.length).toBe(3);
      expect(notifications[0].severity).toBe('critical');
      expect(notifications[1].severity).toBe('warning');
      expect(notifications[2].severity).toBe('info');
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'read-test.md',
          title: 'Read Test Plan',
          frontmatter: { status: 'todo', dueDate: today },
        }),
      ]);

      const notificationsBefore = await generateNotifications();
      expect(notificationsBefore[0].read).toBe(false);

      await markAsRead(notificationsBefore[0].id);

      const notificationsAfter = await generateNotifications();
      expect(notificationsAfter[0].read).toBe(true);
    });

    it('should persist read status to file', async () => {
      await markAsRead('test-notification-id');

      const readFile_ = await readFile(join(testDir, '.notifications-read.json'), 'utf-8');
      const readIds = JSON.parse(readFile_);
      expect(readIds).toContain('test-notification-id');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const today = new Date().toISOString().split('T')[0];
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const pastStr = pastDate.toISOString().split('T')[0];

      mockListPlans.mockResolvedValue([
        makePlan({
          filename: 'plan-1.md',
          title: 'Plan 1',
          frontmatter: { status: 'todo', dueDate: today },
        }),
        makePlan({
          filename: 'plan-2.md',
          title: 'Plan 2',
          frontmatter: { status: 'todo', dueDate: pastStr },
        }),
      ]);

      const before = await generateNotifications();
      expect(before.some((n) => n.read)).toBe(false);

      await markAllAsRead();

      const after = await generateNotifications();
      expect(after.every((n) => n.read)).toBe(true);
    });
  });
});

import type { PlanMeta } from '@ccplans/shared';
import { describe, expect, it } from 'vitest';
import { NotificationService } from '../../services/notificationService';

// Mock plan provider for testing
const mockPlanProvider = {
  listPlans: async (): Promise<PlanMeta[]> => [],
};

describe('notificationService', () => {
  describe('NotificationService', () => {
    it('should be exported as a class', () => {
      expect(typeof NotificationService).toBe('function');
    });

    it('should create instance with config and plan provider', () => {
      const service = new NotificationService({ plansDir: '/tmp/test-plans' }, mockPlanProvider);
      expect(service).toBeInstanceOf(NotificationService);
    });

    it('should have expected methods', () => {
      const service = new NotificationService({ plansDir: '/tmp/test-plans' }, mockPlanProvider);
      expect(typeof service.generateNotifications).toBe('function');
      expect(typeof service.markAsRead).toBe('function');
      expect(typeof service.markAllAsRead).toBe('function');
    });
  });
});

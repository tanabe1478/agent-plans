import { describe, expect, it } from 'vitest';
import { getDefaultViews, ViewService } from '../../services/viewService';

describe('viewService', () => {
  describe('getDefaultViews', () => {
    it('should be exported as a function', () => {
      expect(typeof getDefaultViews).toBe('function');
    });

    it('should return preset views', () => {
      const views = getDefaultViews();
      expect(Array.isArray(views)).toBe(true);
      expect(views.length).toBe(4);
      expect(views.every((v) => v.isPreset === true)).toBe(true);
    });
  });

  describe('ViewService', () => {
    it('should be exported as a class', () => {
      expect(typeof ViewService).toBe('function');
    });

    it('should create instance with config', () => {
      const service = new ViewService({ plansDir: '/tmp/test-plans' });
      expect(service).toBeInstanceOf(ViewService);
    });

    it('should have expected methods', () => {
      const service = new ViewService({ plansDir: '/tmp/test-plans' });
      expect(typeof service.listViews).toBe('function');
      expect(typeof service.getView).toBe('function');
      expect(typeof service.createView).toBe('function');
      expect(typeof service.updateView).toBe('function');
      expect(typeof service.deleteView).toBe('function');
    });
  });
});

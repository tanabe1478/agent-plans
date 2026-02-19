import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEMS_PER_PAGE_OPTIONS, useUiStore } from '../../stores/uiStore';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('uiStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset store to initial state
    useUiStore.setState({
      theme: 'system',
      modalOpen: null,
      toasts: [],
      itemsPerPage: 20,
    });
  });

  describe('theme', () => {
    it('should have default theme as system', () => {
      const { theme } = useUiStore.getState();
      expect(theme).toBe('system');
    });

    it('should update theme', () => {
      const { setTheme } = useUiStore.getState();
      act(() => {
        setTheme('dark');
      });
      expect(useUiStore.getState().theme).toBe('dark');
    });

    it('should save theme to localStorage', () => {
      const { setTheme } = useUiStore.getState();
      act(() => {
        setTheme('light');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
    });
  });

  describe('modal', () => {
    it('should have modalOpen as null by default', () => {
      const { modalOpen } = useUiStore.getState();
      expect(modalOpen).toBeNull();
    });

    it('should open modal', () => {
      const { openModal } = useUiStore.getState();
      act(() => {
        openModal('test-modal');
      });
      expect(useUiStore.getState().modalOpen).toBe('test-modal');
    });

    it('should close modal', () => {
      const { openModal, closeModal } = useUiStore.getState();
      act(() => {
        openModal('test-modal');
      });
      expect(useUiStore.getState().modalOpen).toBe('test-modal');
      act(() => {
        closeModal();
      });
      expect(useUiStore.getState().modalOpen).toBeNull();
    });
  });

  describe('toasts', () => {
    it('should have empty toasts by default', () => {
      const { toasts } = useUiStore.getState();
      expect(toasts).toEqual([]);
    });

    it('should add toast', () => {
      const { addToast } = useUiStore.getState();
      act(() => {
        addToast('Test message', 'success');
      });
      const { toasts } = useUiStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('success');
    });

    it('should remove toast', () => {
      const { addToast, removeToast } = useUiStore.getState();
      act(() => {
        addToast('Test message');
      });
      const toastId = useUiStore.getState().toasts[0].id;
      act(() => {
        removeToast(toastId);
      });
      expect(useUiStore.getState().toasts).toHaveLength(0);
    });

    it('should default to info type', () => {
      const { addToast } = useUiStore.getState();
      act(() => {
        addToast('Test message');
      });
      const { toasts } = useUiStore.getState();
      expect(toasts[0].type).toBe('info');
    });
  });

  describe('itemsPerPage', () => {
    it('should export ITEMS_PER_PAGE_OPTIONS', () => {
      expect(ITEMS_PER_PAGE_OPTIONS).toEqual([10, 20, 50, 100]);
    });

    it('should have default itemsPerPage as 20', () => {
      const { itemsPerPage } = useUiStore.getState();
      expect(itemsPerPage).toBe(20);
    });

    it('should update itemsPerPage', () => {
      const { setItemsPerPage } = useUiStore.getState();
      act(() => {
        setItemsPerPage(50);
      });
      expect(useUiStore.getState().itemsPerPage).toBe(50);
    });

    it('should save itemsPerPage to localStorage', () => {
      const { setItemsPerPage } = useUiStore.getState();
      act(() => {
        setItemsPerPage(100);
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('itemsPerPage', '100');
    });
  });
});

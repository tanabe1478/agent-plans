import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../../stores/uiStore';

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
      sidebarOpen: true,
      modalOpen: null,
      toasts: [],
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

  describe('sidebar', () => {
    it('should have sidebar open by default', () => {
      const { sidebarOpen } = useUiStore.getState();
      expect(sidebarOpen).toBe(true);
    });

    it('should toggle sidebar', () => {
      const { toggleSidebar } = useUiStore.getState();
      act(() => {
        toggleSidebar();
      });
      expect(useUiStore.getState().sidebarOpen).toBe(false);
      act(() => {
        toggleSidebar();
      });
      expect(useUiStore.getState().sidebarOpen).toBe(true);
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
});

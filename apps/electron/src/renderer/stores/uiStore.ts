import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type Theme = 'light' | 'dark' | 'system';

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;

interface UiStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Modal
  modalOpen: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  // Pagination
  itemsPerPage: number;
  setItemsPerPage: (n: number) => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
};

const getInitialItemsPerPage = (): number => {
  if (typeof window === 'undefined') return 20;
  const stored = localStorage.getItem('itemsPerPage');
  if (stored) {
    const parsed = Number(stored);
    if ((ITEMS_PER_PAGE_OPTIONS as readonly number[]).includes(parsed)) return parsed;
  }
  return 20;
};

export const useUiStore = create<UiStore>((set) => ({
  // Theme
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },

  // Modal
  modalOpen: null,
  openModal: (id) => set({ modalOpen: id }),
  closeModal: () => set({ modalOpen: null }),

  // Toasts
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Date.now().toString();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Pagination
  itemsPerPage: getInitialItemsPerPage(),
  setItemsPerPage: (n) => {
    localStorage.setItem('itemsPerPage', String(n));
    set({ itemsPerPage: n });
  },
}));

import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface UiStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Modal
  modalOpen: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('theme') as Theme | null;
  return stored || 'system';
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
}));

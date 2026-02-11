import type { PlanStatus, ViewMode } from '@ccplans/shared';
import { create } from 'zustand';

interface PlanStore {
  // Selection state
  selectedPlans: Set<string>;
  toggleSelect: (filename: string) => void;
  selectAll: (filenames: string[]) => void;
  clearSelection: () => void;
  isSelected: (filename: string) => boolean;

  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Sort state
  sortBy: 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  setSortBy: (sortBy: 'name' | 'size') => void;
  toggleSortOrder: () => void;

  // Filter state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: PlanStatus | 'all';
  setStatusFilter: (status: PlanStatus | 'all') => void;
  projectFilter: string | 'all';
  setProjectFilter: (project: string | 'all') => void;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  // Selection
  selectedPlans: new Set(),
  toggleSelect: (filename) =>
    set((state) => {
      const newSet = new Set(state.selectedPlans);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return { selectedPlans: newSet };
    }),
  selectAll: (filenames) => set({ selectedPlans: new Set(filenames) }),
  clearSelection: () => set({ selectedPlans: new Set() }),
  isSelected: (filename) => get().selectedPlans.has(filename),

  // View
  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Sort
  sortBy: 'name',
  sortOrder: 'asc',
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () =>
    set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

  // Filter
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  statusFilter: 'all',
  setStatusFilter: (status) => set({ statusFilter: status }),
  projectFilter: 'all',
  setProjectFilter: (project) => set({ projectFilter: project }),
}));

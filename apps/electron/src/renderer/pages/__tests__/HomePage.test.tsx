import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Mock the hooks
vi.mock('@/lib/hooks/usePlans', () => ({
  usePlans: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useBulkDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useFrontmatterEnabled: () => false,
}));

vi.mock('@/stores/planStore', () => ({
  usePlanStore: () => ({
    selectedPlans: new Set(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    sortBy: 'date',
    setSortBy: vi.fn(),
    sortOrder: 'desc',
    toggleSortOrder: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    projectFilter: 'all',
    setProjectFilter: vi.fn(),
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: vi.fn(),
  }),
}));

// Mock components that haven't been migrated yet
vi.mock('@/components/plan/BulkActionBar', () => ({
  BulkActionBar: () => <div data-testid="bulk-action-bar" />,
}));

vi.mock('@/components/plan/PlanList', () => ({
  PlanList: () => <div data-testid="plan-list" />,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, title }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      title={title}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open, onClose, title }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

import { HomePage } from '../HomePage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
};

describe('HomePage', () => {
  it('should render without crashing', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Plans').length).toBeGreaterThan(0);
  });

  it('should display plan count', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText(/0 plans/).length).toBeGreaterThan(0);
  });

  it('should have filter input', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByPlaceholderText('Filter...').length).toBeGreaterThan(0);
  });

  it('should have sort dropdown', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });

  it('should have select button', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Select').length).toBeGreaterThan(0);
  });
});

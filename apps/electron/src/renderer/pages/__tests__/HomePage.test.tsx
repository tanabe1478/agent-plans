import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  plans: [] as Array<Record<string, unknown>>,
  bulkDeleteMutateAsync: vi.fn(),
  bulkStatusMutateAsync: vi.fn(),
  updateStatusMutate: vi.fn(),
  addToast: vi.fn(),
  setItemsPerPage: vi.fn(),
  searchData: null as { total: number; results: Array<Record<string, unknown>> } | null,
  searchLoading: false,
}));

// Mock the hooks
vi.mock('@/lib/hooks/usePlans', () => ({
  usePlans: () => ({
    data: mocks.plans,
    isLoading: false,
    error: null,
  }),
  useBulkDelete: () => ({
    mutateAsync: mocks.bulkDeleteMutateAsync,
    isPending: false,
  }),
  useBulkUpdateStatus: () => ({
    mutateAsync: mocks.bulkStatusMutateAsync,
    isPending: false,
  }),
  useUpdateStatus: () => ({
    mutate: mocks.updateStatusMutate,
    isPending: false,
  }),
}));

vi.mock('@/lib/hooks/useSearch', () => ({
  useSearch: () => ({
    data: mocks.searchData,
    isLoading: mocks.searchLoading,
  }),
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettingsLoading: () => false,
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: mocks.addToast,
    itemsPerPage: 20,
    setItemsPerPage: mocks.setItemsPerPage,
  }),
  ITEMS_PER_PAGE_OPTIONS: [10, 20, 50, 100],
}));

vi.mock('@/lib/hooks/useStatusColumns', () => ({
  useStatusColumns: () => ({
    columns: [
      { id: 'todo', label: 'Todo', color: 'gray' },
      { id: 'in_progress', label: 'In Progress', color: 'blue' },
      { id: 'review', label: 'Review', color: 'orange' },
      { id: 'completed', label: 'Completed', color: 'green' },
    ],
    getStatusLabel: (id: string) => id,
    getStatusColor: () => 'gray',
  }),
  getColorClassName: () => '',
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, title }: any) => (
    <button
      type="button"
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

vi.mock('@/components/plan/StatusDropdown', () => ({
  StatusDropdown: ({ currentStatus, disabled, onStatusChange }: any) => (
    <button
      type="button"
      data-testid={`status-dropdown-${currentStatus}`}
      data-row-action="true"
      disabled={disabled}
      onClick={() => onStatusChange('in_progress')}
    >
      {currentStatus}
    </button>
  ),
}));

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open, onClose, title }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/components/search/SearchBar', () => ({
  SearchBar: ({ value, onChange, onSubmit, placeholder }: any) => (
    <input
      type="text"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      onKeyDown={(e: any) => e.key === 'Enter' && onSubmit(value)}
      placeholder={placeholder}
      data-testid="search-bar"
    />
  ),
}));

vi.mock('@/components/search/QueryGuidePopover', () => ({
  QueryGuidePopover: () => <div data-testid="query-guide" />,
}));

vi.mock('@/components/search/SavedSearches', () => ({
  SavedSearches: () => <div data-testid="saved-searches" />,
}));

vi.mock('@/components/search/SearchResultsList', () => ({
  SearchResultsList: ({ results }: any) => (
    <div data-testid="search-results">{results.length} results</div>
  ),
}));

vi.mock('@/lib/hooks/useSettings', () => ({
  useSettings: () => ({ data: {} }),
  useUpdateSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.plans.length = 0;
    mocks.bulkDeleteMutateAsync.mockReset();
    mocks.bulkStatusMutateAsync.mockReset();
    mocks.updateStatusMutate.mockReset();
    mocks.addToast.mockReset();
    mocks.setItemsPerPage.mockReset();
    mocks.bulkStatusMutateAsync.mockResolvedValue({ succeeded: [], failed: [] });
    mocks.searchData = null;
    mocks.searchLoading = false;
  });

  it('should render without crashing', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Plans').length).toBeGreaterThan(0);
  });

  it('should display plan count', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText(/0 indexed/).length).toBeGreaterThan(0);
  });

  it('should have SearchBar component', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('search-bar')).toBeTruthy();
  });

  it('should have QueryGuidePopover', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('query-guide')).toBeTruthy();
  });

  it('should have SavedSearches', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('saved-searches')).toBeTruthy();
  });

  it('should have select button', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Select').length).toBeGreaterThan(0);
  });

  it('supports bulk status update in selection mode', async () => {
    mocks.plans.push({
      filename: 'plan-a.md',
      title: 'Plan A',
      createdAt: '2026-02-20T00:00:00.000Z',
      modifiedAt: '2026-02-20T00:00:00.000Z',
      size: 10,
      preview: 'Preview',
      sections: [],
      metadata: { status: 'todo' },
      readOnly: false,
      source: 'markdown',
    });

    mocks.bulkStatusMutateAsync.mockResolvedValue({ succeeded: ['plan-a.md'], failed: [] });

    const view = render(<HomePage />, { wrapper: createWrapper() });

    fireEvent.click(view.getAllByText('Select')[0]);
    const row = view.container.querySelector('[data-plan-row="plan-a.md"]');
    if (!row) throw new Error('plan row not found');
    fireEvent.click(row);
    fireEvent.change(view.getByLabelText('Bulk status target'), { target: { value: 'review' } });
    fireEvent.click(view.getByText('Update Status'));

    await waitFor(() => {
      expect(mocks.bulkStatusMutateAsync).toHaveBeenCalledWith({
        filenames: ['plan-a.md'],
        status: 'review',
      });
    });
  });

  it('selects plan when clicking modified area', () => {
    mocks.plans.push({
      filename: 'plan-a.md',
      title: 'Plan A',
      createdAt: '2026-02-20T00:00:00.000Z',
      modifiedAt: '2026-02-20T00:00:00.000Z',
      size: 10,
      preview: 'Preview',
      sections: [],
      metadata: { status: 'todo' },
      readOnly: false,
      source: 'markdown',
    });

    const view = render(<HomePage />, { wrapper: createWrapper() });

    fireEvent.click(view.getAllByText('Select')[0]);
    const modifiedCell = view.container.querySelector('[data-plan-modified="plan-a.md"]');
    if (!modifiedCell) throw new Error('modified cell not found');
    fireEvent.click(modifiedCell);

    const checkbox = view.container.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement | null;
    expect(checkbox?.checked).toBe(true);
  });

  it('should enter search mode when submitting a query', () => {
    mocks.searchData = {
      total: 2,
      results: [
        { filename: 'result-1.md', title: 'Result 1', matches: [] },
        { filename: 'result-2.md', title: 'Result 2', matches: [] },
      ],
    };

    render(<HomePage />, { wrapper: createWrapper() });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'status:in_progress' } });
    fireEvent.keyDown(searchBar, { key: 'Enter' });

    // Search results should be visible
    expect(screen.getByTestId('search-results')).toBeTruthy();
    expect(screen.getByText('2 results')).toBeTruthy();
  });

  it('should hide Select button in search mode', () => {
    mocks.searchData = {
      total: 1,
      results: [{ filename: 'r.md', title: 'R', matches: [] }],
    };

    render(<HomePage />, { wrapper: createWrapper() });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'status:todo' } });
    fireEvent.keyDown(searchBar, { key: 'Enter' });

    // Select button should be hidden in search mode
    expect(screen.queryByText('Select')).toBeNull();
  });

  it('should show result count summary in search mode', () => {
    mocks.searchData = {
      total: 3,
      results: [
        { filename: 'a.md', title: 'A', matches: [] },
        { filename: 'b.md', title: 'B', matches: [] },
        { filename: 'c.md', title: 'C', matches: [] },
      ],
    };

    render(<HomePage />, { wrapper: createWrapper() });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'keyword' } });
    fireEvent.keyDown(searchBar, { key: 'Enter' });

    expect(screen.getByText(/3 results for/)).toBeTruthy();
  });

  it('should return to plan list mode when clearing search', () => {
    mocks.plans.push({
      filename: 'plan-a.md',
      title: 'Plan A',
      createdAt: '2026-02-20T00:00:00.000Z',
      modifiedAt: '2026-02-20T00:00:00.000Z',
      size: 10,
      preview: 'Preview',
      sections: [],
      metadata: { status: 'todo' },
      readOnly: false,
      source: 'markdown',
    });

    mocks.searchData = {
      total: 1,
      results: [{ filename: 'r.md', title: 'R', matches: [] }],
    };

    render(<HomePage />, { wrapper: createWrapper() });

    // Enter search mode
    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'query' } });
    fireEvent.keyDown(searchBar, { key: 'Enter' });
    expect(screen.getByTestId('search-results')).toBeTruthy();

    // Clear search (submit empty string)
    fireEvent.change(searchBar, { target: { value: '' } });
    fireEvent.keyDown(searchBar, { key: 'Enter' });

    // Should be back to plan list mode
    expect(screen.queryByTestId('search-results')).toBeNull();
    expect(screen.getAllByText('Select').length).toBeGreaterThan(0);
  });

  it('allows status change for read-only Codex plans', () => {
    mocks.plans.push({
      filename: 'codex-session.md',
      title: 'Codex Session',
      createdAt: '2026-02-20T00:00:00.000Z',
      modifiedAt: '2026-02-20T00:00:00.000Z',
      size: 10,
      preview: 'Imported from Codex',
      sections: [],
      metadata: { status: 'todo' },
      readOnly: true,
      source: 'codex',
    });

    const view = render(<HomePage />, { wrapper: createWrapper() });

    const dropdown = view.getByTestId('status-dropdown-todo');
    expect(dropdown).not.toBeNull();
    expect((dropdown as HTMLButtonElement).disabled).toBe(false);
  });
});

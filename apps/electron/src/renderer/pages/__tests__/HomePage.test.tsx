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
  });

  it('should render without crashing', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Plans').length).toBeGreaterThan(0);
  });

  it('should display plan count', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText(/0 indexed/).length).toBeGreaterThan(0);
  });

  it('should have filter input', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(
      screen.getAllByPlaceholderText('Search by title, filename, section...').length
    ).toBeGreaterThan(0);
  });

  it('should always show status tabs', () => {
    render(<HomePage />, { wrapper: createWrapper() });
    expect(screen.getAllByRole('button', { name: 'All' }).length).toBeGreaterThan(0);
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

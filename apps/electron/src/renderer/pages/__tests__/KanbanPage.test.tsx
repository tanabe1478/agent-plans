import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KanbanPage } from '../KanbanPage';

const mocks = vi.hoisted(() => ({
  plans: [] as Array<Record<string, unknown>>,
  updateStatusMutate: vi.fn(),
  updateSettingsMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/usePlans', () => ({
  usePlans: () => ({
    data: mocks.plans,
    isLoading: false,
    error: null,
  }),
  useUpdateStatus: () => ({
    mutate: mocks.updateStatusMutate,
    isPending: false,
  }),
}));

vi.mock('@/lib/hooks/useSettings', () => ({
  useUpdateSettings: () => ({
    mutate: mocks.updateSettingsMutate,
    isPending: false,
  }),
}));

vi.mock('@/lib/hooks/useStatusColumns', () => ({
  useStatusColumns: () => ({
    columns: [{ id: 'todo', label: 'Todo', color: 'gray' }],
    getStatusLabel: (id: string) => id,
    getStatusColor: () => 'gray',
  }),
  getColorClassName: () => '',
}));

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

describe('KanbanPage', () => {
  beforeEach(() => {
    mocks.plans.length = 0;
    mocks.updateStatusMutate.mockReset();
    mocks.updateSettingsMutate.mockReset();
  });

  it('renders read-only Codex plans in columns', () => {
    mocks.plans.push({
      filename: 'codex-plan.md',
      title: 'Codex Plan',
      createdAt: '2026-02-20T00:00:00.000Z',
      modifiedAt: '2026-02-20T00:00:00.000Z',
      size: 10,
      preview: 'Imported from Codex',
      sections: [],
      metadata: { status: 'todo' },
      readOnly: true,
      source: 'codex',
    });

    render(<KanbanPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Codex Plan')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Codex Plan/i });
    const card = link.closest('div[draggable]');
    expect(card).not.toBeNull();
    expect((card as HTMLElement).getAttribute('draggable')).toBe('false');
  });
});

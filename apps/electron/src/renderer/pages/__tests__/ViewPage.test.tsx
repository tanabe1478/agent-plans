import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/hooks/usePlans', () => ({
  usePlan: vi.fn(() => ({
    data: {
      filename: 'test-plan.md',
      title: 'Test Plan',
      content: '# Test\n\nContent here',
      modifiedAt: '2025-01-01T00:00:00Z',
      size: 1024,
      sections: [{ title: 'Test', level: 1, line: 1 }],
      readOnly: false,
      source: 'local',
      metadata: { status: 'todo' },
    },
    isLoading: false,
    error: null,
  })),
  useUpdateStatus: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdatePlan: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/components/plan/MilkdownEditor', () => ({
  MilkdownEditor: ({
    initialContent,
    onChange,
    readOnly,
  }: {
    initialContent: string;
    onChange: (md: string) => void;
    readOnly?: boolean;
  }) => (
    <div data-testid="milkdown-editor" data-readonly={readOnly}>
      <textarea
        data-testid="mock-milkdown-textarea"
        defaultValue={initialContent}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock('@/components/plan/PlanActions', () => ({
  PlanActions: () => <div data-testid="plan-actions" />,
}));

vi.mock('@/components/plan/ProjectBadge', () => ({
  ProjectBadge: () => null,
}));

vi.mock('@/components/plan/SectionNav', () => ({
  SectionNav: () => <div data-testid="section-nav" />,
}));

vi.mock('@/components/plan/StatusDropdown', () => ({
  StatusDropdown: () => <div data-testid="status-dropdown" />,
}));

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({
    children,
    open,
    onClose,
    title,
  }: {
    children: React.ReactNode;
    open: boolean;
    onClose: () => void;
    title: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

import { usePlan } from '@/lib/hooks/usePlans';
import { ViewPage } from '../ViewPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/plan/test-plan.md']}>
          <Routes>
            <Route path="/plan/:filename" element={children} />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
};

describe('ViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render plan title', () => {
    render(<ViewPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Test Plan')).toBeTruthy();
  });

  it('should always render MilkdownEditor', () => {
    render(<ViewPage />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId('milkdown-editor').length).toBeGreaterThan(0);
  });

  it('should render editor as editable for non-readOnly plans', () => {
    render(<ViewPage />, { wrapper: createWrapper() });
    const editor = screen.getAllByTestId('milkdown-editor')[0];
    expect(editor.getAttribute('data-readonly')).toBe('false');
  });

  it('should render editor as readOnly for readOnly plans', () => {
    vi.mocked(usePlan).mockReturnValue({
      data: {
        filename: 'test.md',
        title: 'Read Only Plan',
        content: '# RO',
        modifiedAt: '2025-01-01T00:00:00Z',
        size: 100,
        sections: [],
        readOnly: true,
        source: 'local',
        metadata: { status: 'todo' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePlan>);

    render(<ViewPage />, { wrapper: createWrapper() });
    const editor = screen.getAllByTestId('milkdown-editor')[0];
    expect(editor.getAttribute('data-readonly')).toBe('true');
  });

  it('should not have Edit toggle button', () => {
    render(<ViewPage />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('edit-toggle-button')).toBeNull();
  });
});

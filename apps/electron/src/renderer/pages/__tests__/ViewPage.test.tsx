import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockAddToast = vi.fn();

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
  useResumeCommand: vi.fn(() => ({
    data: null,
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

const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/clipboard', () => ({
  writeClipboard: (...args: unknown[]) => mockWriteClipboard(...args),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: mockAddToast,
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

import { usePlan, useResumeCommand } from '@/lib/hooks/usePlans';
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

  it('should show Session panel when resume command is available', () => {
    vi.mocked(useResumeCommand).mockReturnValue({
      data: "cd '/home/user/project' && claude --resume 01234567-89ab-cdef-0123-456789abcdef",
    } as ReturnType<typeof useResumeCommand>);

    render(<ViewPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Session')).toBeTruthy();
    expect(
      screen.getByText(
        "cd '/home/user/project' && claude --resume 01234567-89ab-cdef-0123-456789abcdef"
      )
    ).toBeTruthy();
  });

  it('should not show Session panel when resume command is null', () => {
    vi.mocked(useResumeCommand).mockReturnValue({
      data: null,
    } as ReturnType<typeof useResumeCommand>);

    render(<ViewPage />, { wrapper: createWrapper() });
    expect(screen.queryByText('Session')).toBeNull();
  });

  it('should copy resume command to clipboard on Copy button click', async () => {
    const command =
      "cd '/home/user/project' && claude --resume 01234567-89ab-cdef-0123-456789abcdef";
    vi.mocked(useResumeCommand).mockReturnValue({
      data: command,
    } as ReturnType<typeof useResumeCommand>);

    render(<ViewPage />, { wrapper: createWrapper() });

    const copyButton = screen.getByTitle('Copy resume command');
    fireEvent.click(copyButton);
    await vi.waitFor(() => {
      expect(mockWriteClipboard).toHaveBeenCalledWith(command);
    });
    expect(mockAddToast).toHaveBeenCalledWith('Copied resume command', 'success');
  });

  it('should show error toast when clipboard write fails', async () => {
    const command =
      "cd '/home/user/project' && claude --resume 01234567-89ab-cdef-0123-456789abcdef";
    vi.mocked(useResumeCommand).mockReturnValue({
      data: command,
    } as ReturnType<typeof useResumeCommand>);
    mockWriteClipboard.mockRejectedValueOnce(new Error('clipboard error'));

    render(<ViewPage />, { wrapper: createWrapper() });

    const copyButton = screen.getByTitle('Copy resume command');
    fireEvent.click(copyButton);
    await vi.waitFor(() => {
      expect(mockAddToast).toHaveBeenCalled();
    });

    expect(mockAddToast).toHaveBeenCalledWith('Failed to copy', 'error');
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanActions } from '@/components/plan/PlanActions';

const mockOpenMutateAsync = vi.fn();
const mockAddToast = vi.fn();

vi.mock('@/lib/hooks', () => ({
  useDeletePlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRenamePlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useOpenPlan: () => ({
    mutateAsync: mockOpenMutateAsync,
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: mockAddToast,
  }),
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

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
}));

vi.mock('@/components/plan/DeleteConfirmDialog', () => ({
  DeleteConfirmDialog: () => null,
}));

describe('PlanActions', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockOpenMutateAsync.mockReset();
    mockOpenMutateAsync.mockResolvedValue(undefined);
    mockAddToast.mockReset();
  });

  it('shows multi-option external app picker', () => {
    render(<PlanActions filename="example.md" />);

    fireEvent.click(screen.getByRole('button', { name: /Open in/i }));

    expect(screen.getByRole('button', { name: 'VSCode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ghostty' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeTruthy();
  });

  it('calls openPlan with copy-path when copy path is clicked', async () => {
    render(<PlanActions filename="example.md" />);

    fireEvent.click(screen.getByRole('button', { name: /Open in/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }));

    await waitFor(() => {
      expect(mockOpenMutateAsync).toHaveBeenCalledWith({
        filename: 'example.md',
        app: 'copy-path',
      });
    });
    expect(mockAddToast).toHaveBeenCalledWith('Path copied to clipboard', 'success');
  });
});

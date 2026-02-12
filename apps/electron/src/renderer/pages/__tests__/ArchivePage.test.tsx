import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the hooks
vi.mock('@/lib/hooks/useArchive', () => ({
  useArchived: () => ({
    data: { archived: [] },
    isLoading: false,
    error: null,
  }),
  useRestore: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  usePermanentDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCleanupArchive: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: vi.fn(),
  }),
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
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

import { ArchivePage } from '../ArchivePage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('ArchivePage', () => {
  it('should render without crashing', () => {
    render(<ArchivePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Archive').length).toBeGreaterThan(0);
  });

  it('should display empty state when no archived plans', () => {
    render(<ArchivePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('No archived plans').length).toBeGreaterThan(0);
  });

  it('should have cleanup button', () => {
    render(<ArchivePage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Clean up expired').length).toBeGreaterThan(0);
  });
});

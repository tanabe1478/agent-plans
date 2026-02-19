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
  useUpdateStatus: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettingsLoading: () => false,
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: vi.fn(),
    itemsPerPage: 20,
    setItemsPerPage: vi.fn(),
  }),
  ITEMS_PER_PAGE_OPTIONS: [10, 20, 50, 100],
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
});

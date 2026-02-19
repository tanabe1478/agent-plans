import { StatusBadge } from '@components/plan/StatusBadge';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/useSettings', () => ({
  useSettings: () => ({
    data: undefined,
    isLoading: false,
    error: null,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('StatusBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders normalized label for legacy status', () => {
    renderWithProviders(<StatusBadge status={'todo'} />);
    expect(screen.getByText('ToDo')).toBeDefined();
  });

  it('renders custom status with fallback styling', () => {
    renderWithProviders(<StatusBadge status={'blocked'} />);
    expect(screen.getByText('blocked')).toBeDefined();
  });
});

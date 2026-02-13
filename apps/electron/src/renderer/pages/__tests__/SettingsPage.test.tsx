import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the hooks
vi.mock('@/lib/hooks/useSettings', () => ({
  useSettings: () => ({
    data: { frontmatterEnabled: false },
    isLoading: false,
    error: null,
  }),
  useUpdateSettings: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: vi.fn(),
  }),
}));

import { SettingsPage } from '../SettingsPage';

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

describe('SettingsPage', () => {
  it('should render without crashing', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('should display frontmatter features section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Frontmatter Features').length).toBeGreaterThan(0);
  });

  it('should have toggle switch', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByRole('switch', { name: /frontmatter features/i }).length).toBeGreaterThan(
      0
    );
  });

  it('should show feature list', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText(/Status management/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kanban board view/).length).toBeGreaterThan(0);
  });
});

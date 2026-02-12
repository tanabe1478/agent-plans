import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the hooks
vi.mock('@/lib/hooks/useImportExport', () => ({
  useBackups: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreateBackup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRestoreBackup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
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

import { BackupPage } from '../BackupPage';

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

describe('BackupPage', () => {
  it('should render without crashing', () => {
    render(<BackupPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Backups').length).toBeGreaterThan(0);
  });

  it('should display empty state when no backups', () => {
    render(<BackupPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('No backups yet').length).toBeGreaterThan(0);
  });

  it('should have create backup button', () => {
    render(<BackupPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Create Backup').length).toBeGreaterThan(0);
  });
});

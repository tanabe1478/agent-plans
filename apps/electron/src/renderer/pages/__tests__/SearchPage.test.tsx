import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Mock the hooks
vi.mock('@/lib/hooks/useSearch', () => ({
  useSearch: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
}));

// Mock components
vi.mock('@/components/search/SearchBar', () => ({
  SearchBar: ({ value, onChange, onSubmit }: any) => (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        onKeyDown={(e) => e.key === 'Enter' && onSubmit(value)}
      />
    </div>
  ),
}));

import { SearchPage } from '../SearchPage';

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

describe('SearchPage', () => {
  it('should render without crashing', () => {
    render(<SearchPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Search').length).toBeGreaterThan(0);
  });

  it('should have search bar', () => {
    render(<SearchPage />, { wrapper: createWrapper() });
    expect(screen.getAllByPlaceholderText('Search...').length).toBeGreaterThan(0);
  });
});

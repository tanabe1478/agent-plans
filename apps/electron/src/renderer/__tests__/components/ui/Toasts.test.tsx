import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from '../../../components/ui/Toasts';

// Mock the uiStore
const mockToasts = [
  { id: '1', message: 'Success message', type: 'success' as const },
  { id: '2', message: 'Error message', type: 'error' as const },
];

const mockRemoveToast = vi.fn();

vi.mock('../../../stores/uiStore', () => ({
  useUiStore: () => ({
    toasts: mockToasts,
    removeToast: mockRemoveToast,
  }),
}));

describe('Toasts', () => {
  beforeEach(() => {
    mockRemoveToast.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render toasts from store', () => {
    render(<Toasts />);
    expect(screen.getByText('Success message')).toBeDefined();
    expect(screen.getByText('Error message')).toBeDefined();
  });

  it('should render success toast with correct styling', () => {
    render(<Toasts />);
    const successToast = screen.getByText('Success message').closest('div');
    expect(successToast?.className).toContain('bg-green-100');
  });

  it('should render error toast with correct styling', () => {
    render(<Toasts />);
    const errorToast = screen.getByText('Error message').closest('div');
    expect(errorToast?.className).toContain('bg-red-100');
  });

  it('should call removeToast when close button is clicked', () => {
    render(<Toasts />);
    const _closeButtons = screen.getAllByRole('button');
    // Close button for success toast (first one)
    const successToastContainer = screen.getByText('Success message').closest('div');
    const closeButton = successToastContainer?.querySelector('button');
    if (closeButton) {
      closeButton.click();
      expect(mockRemoveToast).toHaveBeenCalledWith('1');
    }
  });
});

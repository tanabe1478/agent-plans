import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  savedSearches: [] as Array<{ name: string; query: string }>,
  updateSettingsMutate: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/lib/hooks/useSettings', () => ({
  useSettings: () => ({
    data: { savedSearches: mocks.savedSearches },
  }),
  useUpdateSettings: () => ({
    mutateAsync: mocks.updateSettingsMutate,
    isPending: false,
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: mocks.addToast,
  }),
}));

import { SavedSearches } from '@/components/search/SavedSearches';

describe('SavedSearches', () => {
  afterEach(() => {
    cleanup();
    mocks.savedSearches.length = 0;
    mocks.updateSettingsMutate.mockReset();
    mocks.addToast.mockReset();
  });

  it('should render bookmark button', () => {
    render(<SavedSearches currentQuery="" onApplyQuery={vi.fn()} />);
    expect(screen.getByTitle('Saved searches')).toBeTruthy();
  });

  it('should toggle dropdown on click', () => {
    render(<SavedSearches currentQuery="" onApplyQuery={vi.fn()} />);
    const btn = screen.getByTitle('Saved searches');

    fireEvent.click(btn);
    expect(screen.getByText('Saved Searches')).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByText('Saved Searches')).toBeNull();
  });

  it('should show empty state when no saved searches', () => {
    render(<SavedSearches currentQuery="" onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Saved searches'));
    expect(screen.getByText('No saved searches yet.')).toBeTruthy();
  });

  it('should list saved searches', () => {
    mocks.savedSearches.push(
      { name: 'My Search', query: 'status:todo' },
      { name: 'Another', query: 'keyword' }
    );
    render(<SavedSearches currentQuery="" onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Saved searches'));

    expect(screen.getByText('My Search')).toBeTruthy();
    expect(screen.getByText('Another')).toBeTruthy();
  });

  it('should call onApplyQuery when clicking a saved search', () => {
    mocks.savedSearches.push({ name: 'My Search', query: 'status:todo' });
    const onApplyQuery = vi.fn();
    render(<SavedSearches currentQuery="" onApplyQuery={onApplyQuery} />);
    fireEvent.click(screen.getByTitle('Saved searches'));
    fireEvent.click(screen.getByText('My Search'));
    expect(onApplyQuery).toHaveBeenCalledWith('status:todo');
  });

  it('should disable save button when currentQuery is empty', () => {
    render(<SavedSearches currentQuery="" onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Saved searches'));
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should save current query', async () => {
    mocks.updateSettingsMutate.mockResolvedValue({});
    render(<SavedSearches currentQuery="status:todo" onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Saved searches'));

    const nameInput = screen.getByPlaceholderText('Name...');
    fireEvent.change(nameInput, { target: { value: 'My Query' } });
    fireEvent.click(screen.getByText('Save'));

    expect(mocks.updateSettingsMutate).toHaveBeenCalledWith({
      savedSearches: [{ name: 'My Query', query: 'status:todo' }],
    });
  });

  it('should delete a saved search', async () => {
    mocks.savedSearches.push({ name: 'Delete Me', query: 'old' });
    mocks.updateSettingsMutate.mockResolvedValue({});
    render(<SavedSearches currentQuery="" onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Saved searches'));

    fireEvent.click(screen.getByLabelText('Delete "Delete Me"'));
    expect(mocks.updateSettingsMutate).toHaveBeenCalledWith({
      savedSearches: [],
    });
  });
});

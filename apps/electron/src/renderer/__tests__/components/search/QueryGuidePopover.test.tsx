import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryGuidePopover } from '@/components/search/QueryGuidePopover';

describe('QueryGuidePopover', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render help button', () => {
    render(<QueryGuidePopover onApplyQuery={vi.fn()} />);
    expect(screen.getByTitle('Query syntax guide')).toBeTruthy();
  });

  it('should toggle popover on click', () => {
    render(<QueryGuidePopover onApplyQuery={vi.fn()} />);
    const btn = screen.getByTitle('Query syntax guide');

    fireEvent.click(btn);
    expect(screen.getByText('Query Guide')).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByText('Query Guide')).toBeNull();
  });

  it('should show syntax guide entries', () => {
    render(<QueryGuidePopover onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Query syntax guide'));

    expect(screen.getByText('status:todo')).toBeTruthy();
    expect(screen.getByText('... AND ...')).toBeTruthy();
  });

  it('should show example buttons', () => {
    render(<QueryGuidePopover onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Query syntax guide'));

    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Todo or Review')).toBeTruthy();
  });

  it('should call onApplyQuery when clicking an example', () => {
    const onApplyQuery = vi.fn();
    render(<QueryGuidePopover onApplyQuery={onApplyQuery} />);
    fireEvent.click(screen.getByTitle('Query syntax guide'));

    fireEvent.click(screen.getByText('In Progress'));
    expect(onApplyQuery).toHaveBeenCalledWith('status:in_progress');
  });

  it('should close on Escape key', () => {
    render(<QueryGuidePopover onApplyQuery={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Query syntax guide'));
    expect(screen.getByText('Query Guide')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Query Guide')).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from '@/components/search/SearchBar';

describe('SearchBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('submits updated query when removing a filter chip', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(<SearchBar value="status:todo" onChange={onChange} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove status:todo filter' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(onSubmit).toHaveBeenCalledWith('');
  });

  it('keeps plain text terms when removing one filter chip', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(<SearchBar value="status:todo roadmap" onChange={onChange} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove status:todo filter' }));

    expect(onChange).toHaveBeenCalledWith('roadmap');
    expect(onSubmit).toHaveBeenCalledWith('roadmap');
  });
});

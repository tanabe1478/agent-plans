import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/workbench/CommandPalette';

const items = [
  {
    id: 'test-command',
    label: 'Test Command',
    run: vi.fn(),
  },
];

describe('CommandPalette', () => {
  afterEach(() => {
    cleanup();
  });

  it('focuses the command input when opened', async () => {
    render(<CommandPalette open items={items} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Type a command...');
    await waitFor(() => {
      expect(input).toBe(document.activeElement);
    });
  });

  it('focuses input when open changes from false to true', async () => {
    const { rerender } = render(<CommandPalette open={false} items={items} onClose={vi.fn()} />);
    rerender(<CommandPalette open items={items} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Type a command...');
    await waitFor(() => {
      expect(input).toBe(document.activeElement);
    });
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn().mockResolvedValue(undefined);
const mockSetReadonly = vi.fn();
const mockOn = vi.fn();

vi.mock('@milkdown/crepe', () => ({
  Crepe: vi.fn().mockImplementation(() => ({
    create: mockCreate,
    destroy: mockDestroy,
    setReadonly: mockSetReadonly,
    on: mockOn,
  })),
  CrepeFeature: {
    Latex: 'latex',
    ImageBlock: 'image-block',
  },
}));

vi.mock('@milkdown/crepe/theme/common/style.css', () => ({}));

import { Crepe } from '@milkdown/crepe';
import { MilkdownEditor } from '@/components/plan/MilkdownEditor';

describe('MilkdownEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render container element', () => {
    render(<MilkdownEditor initialContent="# Hello" onChange={vi.fn()} />);
    expect(screen.getByTestId('milkdown-editor')).toBeTruthy();
  });

  it('should create Crepe instance with initial content', async () => {
    render(<MilkdownEditor initialContent="# Hello" onChange={vi.fn()} />);

    // Allow async init
    await vi.waitFor(() => {
      expect(Crepe).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultValue: '# Hello',
        })
      );
    });
  });

  it('should call create on mount', async () => {
    render(<MilkdownEditor initialContent="test" onChange={vi.fn()} />);

    await vi.waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  it('should call destroy on unmount', async () => {
    const { unmount } = render(<MilkdownEditor initialContent="test" onChange={vi.fn()} />);

    await vi.waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    unmount();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('should set readonly mode', async () => {
    render(<MilkdownEditor initialContent="test" onChange={vi.fn()} readOnly={true} />);

    await vi.waitFor(() => {
      expect(mockSetReadonly).toHaveBeenCalledWith(true);
    });
  });

  it('should register markdownUpdated listener', async () => {
    render(<MilkdownEditor initialContent="test" onChange={vi.fn()} />);

    await vi.waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });
  });
});

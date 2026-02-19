import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEffectiveTheme } from '@/lib/theme';

describe('theme utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves system theme from matchMedia', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    expect(resolveEffectiveTheme('system')).toBe('dark');
  });

  it('returns monokai as-is for explicit theme', () => {
    expect(resolveEffectiveTheme('monokai')).toBe('monokai');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNextToggleTheme, resolveEffectiveTheme } from '@/lib/theme';

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

  it('toggles from explicit themes', () => {
    expect(getNextToggleTheme('light')).toBe('dark');
    expect(getNextToggleTheme('dark')).toBe('light');
  });
});

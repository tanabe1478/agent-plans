import type { Theme } from '@/stores/uiStore';

export type EffectiveTheme = 'light' | 'dark' | 'monokai';

export function resolveEffectiveTheme(theme: Theme): EffectiveTheme {
  if (theme === 'light' || theme === 'dark' || theme === 'monokai') {
    return theme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

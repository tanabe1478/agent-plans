import type { Theme } from '@/stores/uiStore';

export type EffectiveTheme = 'light' | 'dark';

export function resolveEffectiveTheme(theme: Theme): EffectiveTheme {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getNextToggleTheme(theme: Theme): EffectiveTheme {
  return resolveEffectiveTheme(theme) === 'dark' ? 'light' : 'dark';
}

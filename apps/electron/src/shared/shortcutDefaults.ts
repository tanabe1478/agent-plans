import type { AppShortcuts, ShortcutAction } from '@agent-plans/shared';

const SHORTCUT_ACTIONS: ShortcutAction[] = [
  'openCommandPalette',
  'openQuickOpen',
  'commandGoHome',
  'commandGoSearch',
  'commandOpenSettings',
  'commandOpenQuickOpen',
  'commandOpenCurrentReview',
];

export const DEFAULT_SHORTCUTS: AppShortcuts = {
  openCommandPalette: 'Mod+K',
  openQuickOpen: 'Mod+P',
  commandGoHome: 'Mod+1',
  commandGoSearch: 'Mod+2',
  commandOpenSettings: 'Mod+,',
  commandOpenQuickOpen: 'Mod+Shift+P',
  commandOpenCurrentReview: 'Mod+Shift+R',
};

export function mergeShortcuts(
  value?: Partial<Record<ShortcutAction, string>> | null
): AppShortcuts {
  const merged: AppShortcuts = { ...DEFAULT_SHORTCUTS };

  if (!value) {
    return merged;
  }

  for (const action of SHORTCUT_ACTIONS) {
    const candidate = value[action];
    if (typeof candidate === 'string' && candidate.trim()) {
      merged[action] = candidate;
    }
  }

  return merged;
}

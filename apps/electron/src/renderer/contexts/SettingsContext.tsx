import type { AppShortcuts } from '@agent-plans/shared';
import { createContext, type ReactNode, useContext } from 'react';
import { DEFAULT_SHORTCUTS } from '../../shared/shortcutDefaults';
import { useSettings } from '../lib/hooks/useSettings';

interface SettingsContextValue {
  shortcuts: AppShortcuts;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  shortcuts: DEFAULT_SHORTCUTS,
  isLoading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSettings();

  const value: SettingsContextValue = {
    shortcuts: {
      ...DEFAULT_SHORTCUTS,
      ...(data?.shortcuts ?? {}),
    },
    isLoading,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsLoading(): boolean {
  const ctx = useContext(SettingsContext);
  return ctx.isLoading;
}

export function useAppShortcuts(): AppShortcuts {
  const ctx = useContext(SettingsContext);
  return ctx.shortcuts;
}

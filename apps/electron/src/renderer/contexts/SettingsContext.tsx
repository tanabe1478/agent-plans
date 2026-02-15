import { type AppShortcuts, DEFAULT_SHORTCUTS } from '@ccplans/shared';
import { createContext, type ReactNode, useContext } from 'react';
import { useSettings } from '../lib/hooks/useSettings';

interface SettingsContextValue {
  frontmatterEnabled: boolean;
  shortcuts: AppShortcuts;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  frontmatterEnabled: true,
  shortcuts: DEFAULT_SHORTCUTS,
  isLoading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSettings();

  const value: SettingsContextValue = {
    frontmatterEnabled: data?.frontmatterEnabled ?? true,
    shortcuts: {
      ...DEFAULT_SHORTCUTS,
      ...(data?.shortcuts ?? {}),
    },
    isLoading,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useFrontmatterEnabled(): boolean {
  const ctx = useContext(SettingsContext);
  return ctx.frontmatterEnabled;
}

export function useSettingsLoading(): boolean {
  const ctx = useContext(SettingsContext);
  return ctx.isLoading;
}

export function useAppShortcuts(): AppShortcuts {
  const ctx = useContext(SettingsContext);
  return ctx.shortcuts;
}

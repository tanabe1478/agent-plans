import { DEFAULT_STATUS_COLUMNS, type StatusColumnDef } from '@agent-plans/shared';
import { useMemo } from 'react';
import { useSettings } from './useSettings';

const FALLBACK_COLOR = 'gray';

const COLOR_CLASS_MAP: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export function getColorClassName(color: string): string {
  return COLOR_CLASS_MAP[color] ?? COLOR_CLASS_MAP[FALLBACK_COLOR];
}

export function useStatusColumns() {
  const { data: settings } = useSettings();

  const columns: StatusColumnDef[] = useMemo(() => {
    const saved = settings?.statusColumns;
    if (saved && saved.length > 0) return saved;
    return DEFAULT_STATUS_COLUMNS;
  }, [settings?.statusColumns]);

  const columnMap = useMemo(() => {
    const map = new Map<string, StatusColumnDef>();
    for (const col of columns) {
      map.set(col.id, col);
    }
    return map;
  }, [columns]);

  const getStatusLabel = (id: string): string => {
    return columnMap.get(id)?.label ?? id;
  };

  const getStatusColor = (id: string): string => {
    return columnMap.get(id)?.color ?? FALLBACK_COLOR;
  };

  return { columns, getStatusLabel, getStatusColor, getColorClassName };
}

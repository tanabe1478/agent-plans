/**
 * React Query hooks for search operations via IPC
 */

import { useQuery } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => ipcClient.search.query(query),
    enabled: enabled && query.length > 0,
  });
}

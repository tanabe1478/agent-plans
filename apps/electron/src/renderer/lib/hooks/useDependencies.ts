/**
 * React Query hooks for dependencies operations via IPC
 */

import { useQuery } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useDependencyGraph() {
  return useQuery({
    queryKey: ['dependencies'],
    queryFn: ipcClient.dependencies.graph,
  });
}

export function usePlanDependencies(filename: string) {
  return useQuery({
    queryKey: ['dependencies', filename],
    queryFn: () => ipcClient.dependencies.get(filename),
    enabled: !!filename,
  });
}

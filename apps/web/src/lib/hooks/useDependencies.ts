import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useDependencyGraph() {
  return useQuery({
    queryKey: ['dependencies'],
    queryFn: api.dependencies.graph,
  });
}

export function usePlanDependencies(filename: string) {
  return useQuery({
    queryKey: ['dependencies', filename],
    queryFn: () => api.dependencies.forPlan(filename),
    enabled: !!filename,
  });
}

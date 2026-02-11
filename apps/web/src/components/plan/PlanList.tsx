import type { PlanMeta } from '@ccplans/shared';
import { useMemo } from 'react';
import { usePlanStore } from '@/stores/planStore';
import { PlanCard } from './PlanCard';

interface PlanListProps {
  plans: PlanMeta[];
  showCheckbox?: boolean;
}

export function PlanList({ plans, showCheckbox = false }: PlanListProps) {
  const { sortBy, sortOrder, searchQuery, statusFilter, projectFilter } = usePlanStore();

  const filteredAndSortedPlans = useMemo(() => {
    let result = [...plans];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (plan) =>
          plan.title.toLowerCase().includes(query) ||
          plan.filename.toLowerCase().includes(query) ||
          plan.preview.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((plan) => plan.frontmatter?.status === statusFilter);
    }

    // Filter by project
    if (projectFilter !== 'all') {
      result = result.filter((plan) => plan.frontmatter?.projectPath === projectFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'size':
          comparison = b.size - a.size;
          break;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [plans, sortBy, sortOrder, searchQuery, statusFilter, projectFilter]);

  if (filteredAndSortedPlans.length === 0) {
    const hasFilters = searchQuery || statusFilter !== 'all' || projectFilter !== 'all';
    return (
      <div className="text-center py-12 text-muted-foreground">
        {hasFilters ? 'No plans match the current filters' : 'No plans yet'}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filteredAndSortedPlans.map((plan) => (
        <PlanCard key={plan.filename} plan={plan} showCheckbox={showCheckbox} />
      ))}
    </div>
  );
}

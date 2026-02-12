import type { PlanStatus } from '@ccplans/shared';
import { STATUS_TRANSITIONS } from '@ccplans/shared';

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: PlanStatus, to: PlanStatus): boolean {
  if (from === to) return true;
  const allowed = STATUS_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Get the list of statuses that can be transitioned to from the current status
 */
export function getAvailableTransitions(current: PlanStatus): PlanStatus[] {
  return STATUS_TRANSITIONS[current] ?? [];
}

// Object export for IPC handlers
export const statusTransitionService = {
  isValidTransition,
  getAvailableTransitions,
};

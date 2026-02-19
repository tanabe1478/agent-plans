import type { PlanStatus } from '@agent-plans/shared';

/**
 * Check if a status transition is valid.
 * All transitions are now allowed (free transitions).
 */
export function isValidTransition(_from: PlanStatus | string, _to: PlanStatus | string): boolean {
  return true;
}

/**
 * Get the list of built-in statuses that can be transitioned to.
 * Returns built-in statuses only. For custom statuses, the renderer
 * reads from AppSettings.statusColumns via useStatusColumns().
 * @deprecated Prefer reading status columns from settings in the renderer.
 */
export function getAvailableTransitions(_current: PlanStatus | string): Array<PlanStatus | string> {
  return ['todo', 'in_progress', 'review', 'completed'];
}

// Object export for IPC handlers
export const statusTransitionService = {
  isValidTransition,
  getAvailableTransitions,
};

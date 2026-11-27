import type { WorkerAssignment } from '@interfaces';

// Anything but a positive count (blank, 0, NaN) means repeat forever.
export function workerOrderCount(value?: number): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : undefined;
}

// Null once a counted order's last unit is done; unlimited orders pass through unchanged.
export function workerAssignmentAfterUnit<A extends WorkerAssignment>(
  assignment: A | null,
): A | null {
  if (assignment?.remaining === undefined) return assignment;
  return assignment.remaining > 1
    ? { ...assignment, remaining: assignment.remaining - 1 }
    : null;
}

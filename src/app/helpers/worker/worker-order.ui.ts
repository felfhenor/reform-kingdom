import { workerOrderCount } from '@helpers/worker/worker-order';
import type { WorkerAssignment } from '@interfaces';
import { isEqual, omit } from 'es-toolkit/compat';

export function workerAssignmentSameJob(
  a: WorkerAssignment | null | undefined,
  b: WorkerAssignment | null | undefined,
): boolean {
  if (!a || !b) return !a && !b;
  return isEqual(omit(a, ['remaining']), omit(b, ['remaining']));
}

// A count draft survives ticks until the saved count catches up to it (a confirm landed).
export function workerOrderDraftKept(
  draft?: string,
  remaining?: number,
): boolean {
  return draft !== undefined && workerOrderCount(Number(draft)) !== remaining;
}

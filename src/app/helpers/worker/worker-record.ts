import type { GameState, WorkerId, WorkerState } from '@interfaces';

// The draft is a shallow copy: reassign nested fields (`status`, `xp`) instead of mutating them in place.
export function updateWorkerRecord(
  state: GameState,
  workerId: WorkerId,
  fn: (worker: WorkerState) => void,
): GameState {
  const existing = state.workers[workerId];
  if (!existing) return state;

  const draft = { ...existing };
  fn(draft);
  state.workers = { ...state.workers, [workerId]: draft };
  return state;
}

import { dictionaryWith } from '@helpers/engine/dictionary';
import type { GameState, WorkerId, WorkerState } from '@interfaces';
import { isDraft } from 'immer';

// Outside Immer the draft is a shallow copy, so reassign nested fields (`status`, `xp`) instead of mutating them in place.
export function updateWorkerRecord(
  state: GameState,
  workerId: WorkerId,
  fn: (worker: WorkerState) => void,
): GameState {
  const existing = state.workers[workerId];
  if (!existing) return state;

  if (isDraft(existing)) {
    fn(existing);
    return state;
  }

  const draft = { ...existing };
  fn(draft);
  state.workers = dictionaryWith(state.workers, workerId, draft);
  return state;
}

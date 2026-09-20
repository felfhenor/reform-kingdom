import { dictionaryWith } from '@helpers/engine/dictionary';
import type {
  GameState,
  TownId,
  TownNodeState,
  TownWorkerState,
  WorkerId,
} from '@interfaces';

function isUnchanged<T extends object>(draft: T, existing: T): boolean {
  const keys = new Set([...Object.keys(draft), ...Object.keys(existing)]);
  return [...keys].every(
    (key) => draft[key as keyof T] === existing[key as keyof T],
  );
}

// Replaces the town node (never mutates it) and skips the write when `fn` changed nothing.
export function updateTownNode(
  state: GameState,
  townId: TownId,
  fn: (town: TownNodeState) => void,
): GameState {
  const existing = state.world.towns[townId];
  if (!existing) return state;

  const draft = { ...existing };
  fn(draft);
  if (isUnchanged(draft, existing)) return state;

  state.world.towns = dictionaryWith(state.world.towns, townId, draft);
  return state;
}

export function updateTownWorker(
  state: GameState,
  townId: TownId,
  workerId: WorkerId,
  fn: (worker: TownWorkerState) => void,
): GameState {
  const existing = state.world.towns[townId]?.workers[workerId];
  if (!existing) return state;

  const draft = { ...existing };
  fn(draft);
  if (isUnchanged(draft, existing)) return state;

  return updateTownNode(state, townId, (town) => {
    town.workers = dictionaryWith(town.workers, workerId, draft);
  });
}

import { statBlockForLevel } from '@helpers/worker/worker-progression';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  TownContent,
  TownWorkerState,
  WorkerContent,
  WorkerStatBlock,
} from '@interfaces';

export function townWorkerStatsForLevel(
  worker: WorkerContent,
  level: number,
): WorkerStatBlock {
  return statBlockForLevel(worker.baseStats, worker.statsPerLevel, level);
}

// Mirrors defaultWorkerState() - the town is its own "home base" instead of the Duchy.
export function defaultTownWorkerState(
  town: TownContent,
  level: number,
): TownWorkerState {
  const node = worldNodeByName(town.name);
  const location: CurrentLocation = node
    ? { mapName: node.mapName, x: node.x, y: node.y }
    : { mapName: '', x: 0, y: 0 };

  return {
    level,
    location,
    status: { kind: 'AtTown' },
    assignment: null,
  };
}

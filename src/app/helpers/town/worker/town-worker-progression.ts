import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  TownContent,
  TownWorkerState,
} from '@interfaces';

// The town is its own "home base" instead of the Duchy.
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

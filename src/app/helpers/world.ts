import {
  updateGamestate,
  worldCurrentLocationState,
} from '@helpers/state-game';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  GameStateWorld,
  WorldNodeEntry,
} from '@interfaces';

export function setWorld(world: GameStateWorld): void {
  updateGamestate((gs) => {
    gs.world = world;
    return gs;
  });
}

export function currentLocationSet(location: CurrentLocation): void {
  updateGamestate((gs) => {
    gs.world.currentLocation = location;
    return gs;
  });
}

export function worldNodeAtCurrentLocation(): WorldNodeEntry | undefined {
  const location = worldCurrentLocationState();
  return worldNodeAt(location.mapName, location.x, location.y);
}

export function isPlayerAtKingdom(): boolean {
  const location = worldCurrentLocationState();
  const node = worldNodeAt(location.mapName, location.x, location.y);
  return node?.nodeData.type === 'Kingdom';
}

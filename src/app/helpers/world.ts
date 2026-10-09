import { ledgerMark } from '@helpers/engine/ledger';
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
    ledgerMark(gs.discoveredMaps, location.mapName);
    return gs;
  });
}

export function worldNodeAtCurrentLocation(): WorldNodeEntry | undefined {
  const location = worldCurrentLocationState();
  return worldNodeAt(location.mapName, location.x, location.y);
}

export function isPartyAtNode(nodeName: string): boolean {
  return worldNodeAtCurrentLocation()?.nodeName === nodeName;
}

export function isPlayerAtKingdom(): boolean {
  const location = worldCurrentLocationState();
  const node = worldNodeAt(location.mapName, location.x, location.y);
  return node?.nodeData.type === 'Kingdom';
}

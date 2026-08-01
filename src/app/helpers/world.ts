import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeAt } from '@helpers/world-nodes';
import type { CurrentLocation, GameStateWorld } from '@interfaces';

export function setWorld(world: GameStateWorld): void {
  updateGamestate((gs) => {
    gs.world = world;
    return gs;
  });
}

export function currentLocationGet(): CurrentLocation {
  return gamestate().world.currentLocation;
}

export function currentLocationSet(location: CurrentLocation): void {
  updateGamestate((gs) => {
    gs.world.currentLocation = location;
    return gs;
  });
}

export function isPlayerAtLocation(): boolean {
  const location = currentLocationGet();
  return !!worldNodeAt(location.mapName, location.x, location.y);
}

export function isPlayerAtKingdom(): boolean {
  const location = currentLocationGet();
  const node = worldNodeAt(location.mapName, location.x, location.y);
  return node?.nodeData.type === 'Kingdom';
}

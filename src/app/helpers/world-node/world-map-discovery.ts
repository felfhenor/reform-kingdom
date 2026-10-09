import { discoveredMapsState } from '@helpers/state-game';
import type { GameState, GameStateDiscoveredMaps } from '@interfaces';

export function isWorldMapVisited(mapName: string): boolean {
  return !!discoveredMapsState()[mapName]?.foundAt;
}

// Mutates an updateGamestate draft; keeps the first visit's foundAt.
export function worldMapMarkVisited(state: GameState, mapName: string): void {
  state.discoveredMaps[mapName] ??= { foundAt: Date.now() };
}

export function backfillDiscoveredMaps(
  discovered: GameStateDiscoveredMaps,
  mapNames: string[],
): GameStateDiscoveredMaps {
  const backfilled = { ...discovered };
  mapNames.forEach((mapName) => {
    backfilled[mapName] ??= { foundAt: Date.now() };
  });

  return backfilled;
}

export function pruneInvalidDiscoveredMaps(
  discovered: GameStateDiscoveredMaps,
  mapExists: (mapName: string) => boolean,
): GameStateDiscoveredMaps {
  return Object.fromEntries(
    Object.entries(discovered).filter(([mapName]) => mapExists(mapName)),
  );
}

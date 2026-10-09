import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { discoveredMapsState } from '@helpers/state-game';
import type { GameStateDiscoveredMaps } from '@interfaces';

export function isWorldMapVisited(mapName: string): boolean {
  return ledgerHas(discoveredMapsState(), mapName);
}

export function backfillDiscoveredMaps(
  discovered: GameStateDiscoveredMaps,
  mapNames: string[],
): GameStateDiscoveredMaps {
  const backfilled = { ...discovered };
  mapNames.forEach((mapName) => ledgerMark(backfilled, mapName));

  return backfilled;
}

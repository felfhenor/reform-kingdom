import { ledgerHas } from '@helpers/engine/ledger';
import { discoveredMapsState } from '@helpers/state-game';

export function isWorldMapVisited(mapName: string): boolean {
  return ledgerHas(discoveredMapsState(), mapName);
}

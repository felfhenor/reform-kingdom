import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import {
  discoveredGatherNodesState,
  updateGamestate,
} from '@helpers/state-game';
import type { GameStateDiscoveredGatherNodes } from '@interfaces';

export function isGatherNodeDiscovered(nodeName: string): boolean {
  return ledgerHas(discoveredGatherNodesState(), nodeName);
}

export function gatherNodeDiscover(nodeName: string): void {
  const alreadyDiscovered = isGatherNodeDiscovered(nodeName);

  updateGamestate((state) => {
    ledgerMark(state.discoveredGatherNodes, nodeName);
    return state;
  });

  if (!alreadyDiscovered) {
    analyticsSendDesignEvent(
      `World:GatherNode:Discover:${analyticsSafeSegment(nodeName)}`,
    );
  }
}

// One-time migration backfill for pre-tracking saves that have material progress but no recorded node
// visits; marks every GatherNode discovered. Callers gate this to run only once.
export function grandfatherGatherNodeDiscoveries(
  allGatherNodeNames: string[],
): GameStateDiscoveredGatherNodes {
  const discovered: GameStateDiscoveredGatherNodes = {};
  const foundAt = Date.now();

  allGatherNodeNames.forEach((nodeName) =>
    ledgerMark(discovered, nodeName, foundAt),
  );

  return discovered;
}

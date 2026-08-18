import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GameStateDiscoveredGatherNodes } from '@interfaces';

export function isGatherNodeDiscovered(nodeName: string): boolean {
  return !!gamestate().discoveredGatherNodes[nodeName]?.foundAt;
}

export function gatherNodeDiscover(nodeName: string): void {
  const alreadyDiscovered = isGatherNodeDiscovered(nodeName);

  updateGamestate((state) => {
    const existing = state.discoveredGatherNodes[nodeName];
    state.discoveredGatherNodes[nodeName] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };
    return state;
  });

  if (!alreadyDiscovered) {
    analyticsSendDesignEvent(
      `World:GatherNode:Discover:${analyticsSafeSegment(nodeName)}`,
    );
  }
}

// Takes an existence check (not `worldNodeByName`) to avoid a world-nodes.ts <-> gather-node-discovery.ts import cycle.
export function pruneInvalidGatherNodeDiscoveries(
  discovered: GameStateDiscoveredGatherNodes,
  nodeExists: (nodeName: string) => boolean,
): GameStateDiscoveredGatherNodes {
  const pruned: GameStateDiscoveredGatherNodes = {};

  Object.keys(discovered).forEach((nodeName) => {
    if (nodeExists(nodeName)) {
      pruned[nodeName] = discovered[nodeName];
    }
  });

  return pruned;
}

// One-time migration backfill for pre-tracking saves that have material progress but no recorded node
// visits; marks every GatherNode discovered. Callers gate this to run only once (see `migrate.ts`).
export function grandfatherGatherNodeDiscoveries(
  allGatherNodeNames: string[],
): GameStateDiscoveredGatherNodes {
  const discovered: GameStateDiscoveredGatherNodes = {};
  const foundAt = Date.now();

  allGatherNodeNames.forEach((nodeName) => {
    discovered[nodeName] = { foundAt };
  });

  return discovered;
}

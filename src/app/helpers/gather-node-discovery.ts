import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GameStateDiscoveredGatherNodes } from '@interfaces';

export function isGatherNodeDiscovered(nodeName: string): boolean {
  return !!gamestate().discoveredGatherNodes[nodeName]?.foundAt;
}

export function gatherNodeDiscover(nodeName: string): void {
  updateGamestate((state) => {
    const existing = state.discoveredGatherNodes[nodeName];
    state.discoveredGatherNodes[nodeName] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };
    return state;
  });
}

// Drops any discovery entries for nodes that no longer exist on any loaded
// map - e.g. after a map edit removes or renames a GatherNode. Takes an
// existence check rather than importing `worldNodeByName` directly, to avoid
// a `world-nodes.ts` <-> `gather-node-discovery.ts` import cycle.
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

// One-time migration backfill: saves from before gather-node discovery
// tracking existed have real material progress (things the player has
// legitimately gathered over hours of play) but no recorded node visits,
// since that history was never captured. Without this, every such save
// would suddenly see an empty auto-mode material picker despite having
// obviously found plenty of gather sources already. Marks every real
// GatherNode as discovered - callers gate this to only run once, when
// `discoveredGatherNodes` is empty but `materials` isn't (see `migrate.ts`).
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

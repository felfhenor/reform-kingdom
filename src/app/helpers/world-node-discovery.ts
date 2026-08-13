import { notifySuccess } from '@helpers/notify';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GameStateWorldDiscoveries } from '@interfaces';

export function isWorldNodeDiscovered(nodeName: string): boolean {
  return !!gamestate().worldDiscoveries[nodeName]?.foundAt;
}

// Marks a hidden node as revealed - only notifies the player on the first
// discovery, so re-selecting an already-discovered node stays silent.
export function worldNodeDiscover(nodeName: string): void {
  const alreadyDiscovered = isWorldNodeDiscovered(nodeName);

  updateGamestate((state) => {
    const existing = state.worldDiscoveries[nodeName];
    state.worldDiscoveries[nodeName] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };
    return state;
  });

  if (!alreadyDiscovered) {
    notifySuccess(`You discovered ${nodeName}!`);
  }
}

// Debug tool: reverts a node back to undiscovered.
export function worldNodeUndiscover(nodeName: string): void {
  updateGamestate((state) => {
    delete state.worldDiscoveries[nodeName];
    return state;
  });
}

// Drops any discovery entries for nodes that no longer exist on any loaded
// map - e.g. after a map edit removes or renames a node. Takes an existence
// check rather than importing `worldNodeByName` directly, to avoid a
// `world-nodes.ts` <-> `world-node-discovery.ts` import cycle.
export function pruneInvalidWorldDiscoveries(
  discovered: GameStateWorldDiscoveries,
  nodeExists: (nodeName: string) => boolean,
): GameStateWorldDiscoveries {
  const pruned: GameStateWorldDiscoveries = {};

  Object.keys(discovered).forEach((nodeName) => {
    if (nodeExists(nodeName)) {
      pruned[nodeName] = discovered[nodeName];
    }
  });

  return pruned;
}

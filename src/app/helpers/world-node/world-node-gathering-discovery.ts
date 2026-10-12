import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  isWorldNodeVisible,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { ItemId, WorldNodeEntry } from '@interfaces';

// Split out of world-node-gathering.ts so its pure lookups stay free of gamestate/discovery.

export function worldNodeGatherMaterialIds(entry: WorldNodeEntry): ItemId[] {
  const gathering = worldNodeGathering(entry);
  if (!gathering) return [];

  const ids = new Set<ItemId>();
  gatheringResultsAtLevel(gathering, worldNodeLevel(entry.nodeName)).forEach(
    (result) => {
      result.items.forEach((item) => ids.add(item.itemId));
    },
  );

  return [...ids];
}

export function discoveredGatherNodes(): WorldNodeEntry[] {
  return worldNodesOfType('GatherNode').filter(
    (entry) =>
      isGatherNodeDiscovered(entry.nodeName) && isWorldNodeVisible(entry),
  );
}

export function discoveredGatherNodesFor(itemId: ItemId): WorldNodeEntry[] {
  return discoveredGatherNodes().filter((entry) =>
    worldNodeGatherMaterialIds(entry).includes(itemId),
  );
}

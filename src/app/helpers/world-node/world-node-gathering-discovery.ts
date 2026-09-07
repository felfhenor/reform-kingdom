import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import { worldNodeGathering } from '@helpers/world-node/world-nodes';
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

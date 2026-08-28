import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  isWorldNodeVisible,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { ItemId, MaterialId, WorldNodeEntry } from '@interfaces';

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

// Materials actually obtained from a discovered node - a node's other possible drops stay hidden
// until their own weighted roll lands, since `worldNodeGatherMaterialIds` lists everything it could yield.
export function gatherableMaterialIds(): MaterialId[] {
  const ids = new Set<MaterialId>();

  worldNodesOfType('GatherNode')
    .filter(
      (entry) =>
        isGatherNodeDiscovered(entry.nodeName) && isWorldNodeVisible(entry),
    )
    .forEach((entry) => {
      worldNodeGatherMaterialIds(entry).forEach((id) =>
        ids.add(id as MaterialId),
      );
    });

  return [...ids].filter((id) => isMaterialDiscovered(id));
}

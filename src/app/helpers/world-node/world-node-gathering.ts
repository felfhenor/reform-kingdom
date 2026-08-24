import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { isMaterialDiscovered } from '@helpers/item/materials';
import {
  isWorldNodeVisible,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { ItemId, MaterialId, WorldNodeEntry } from '@interfaces';

export function worldNodeGatherTime(entry: WorldNodeEntry): number | undefined {
  return worldNodeGathering(entry)?.gatherTime;
}

export function worldNodeGatherMaterialIds(entry: WorldNodeEntry): ItemId[] {
  const gathering = worldNodeGathering(entry);
  if (!gathering) return [];

  const ids = new Set<ItemId>();
  gathering.gatherResults.forEach((result) => {
    result.items.forEach((item) => ids.add(item.itemId));
  });

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

// Materials any GatherNode's content could produce, ignoring discovery - the content-level check
// `pruneInvalidDecreeGatherClauses` uses to tell "not found yet" apart from "no longer exists".
export function allGatherableMaterialIds(): MaterialId[] {
  const ids = new Set<MaterialId>();

  worldNodesOfType('GatherNode').forEach((entry) => {
    worldNodeGatherMaterialIds(entry).forEach((id) =>
      ids.add(id as MaterialId),
    );
  });

  return [...ids];
}

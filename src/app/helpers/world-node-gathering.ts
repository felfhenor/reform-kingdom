import { isGatherNodeDiscovered } from '@helpers/gather-node-discovery';
import {
  isWorldNodeVisible,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-nodes';
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

// Every material obtainable from a GatherNode the player has actually
// visited before - the data source for the auto-mode "gather material"
// clause picker. Deliberately narrower than "every GatherNode in the
// world": a material that's only reachable from a node the player hasn't
// found yet (and might otherwise also be craftable) shouldn't be offered as
// a gather target before they've discovered where it actually comes from.
export function gatherableMaterialIds(): MaterialId[] {
  const ids = new Set<MaterialId>();

  worldNodesOfType('GatherNode')
    .filter(
      (entry) =>
        isGatherNodeDiscovered(entry.nodeName) && isWorldNodeVisible(entry),
    )
    .forEach((entry) => {
      worldNodeGatherMaterialIds(entry).forEach((id) => ids.add(id as MaterialId));
    });

  return [...ids];
}

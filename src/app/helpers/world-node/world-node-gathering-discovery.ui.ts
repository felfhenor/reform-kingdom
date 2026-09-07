import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import {
  isWorldNodeVisible,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { MaterialId } from '@interfaces';

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

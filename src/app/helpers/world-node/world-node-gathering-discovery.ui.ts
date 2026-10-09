import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import { worldNodeFarmOption } from '@helpers/world-node/world-node-status.ui';
import {
  isWorldNodeVisible,
  worldNodeByName,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  ExploreNodeFarmOption,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Discovered + visible GatherNodes with at least one discovered material - a node's other
// possible drops stay hidden until their own weighted roll lands
function discoveredGatherNodesWithMaterials(): WorldNodeEntry[] {
  return worldNodesOfType('GatherNode')
    .filter(
      (entry) =>
        isGatherNodeDiscovered(entry.nodeName) && isWorldNodeVisible(entry),
    )
    .filter((entry) =>
      worldNodeGatherMaterialIds(entry).some((id) => isMaterialDiscovered(id)),
    );
}

// The pool a GatherMaterial clause's location dropdown offers.
export function gatherNodeFarmOptions(): ExploreNodeFarmOption[] {
  return sortBy(
    discoveredGatherNodesWithMaterials().map(worldNodeFarmOption),
    (option) => option.nodeName,
  );
}

// Discovered materials a specific GatherNode can drop
export function gatherNodeMaterialIds(nodeName: string): MaterialId[] {
  const entry = worldNodeByName(nodeName);
  if (!entry) return [];

  return worldNodeGatherMaterialIds(entry).filter((id) =>
    isMaterialDiscovered(id),
  ) as MaterialId[];
}

import { isMaterialDiscovered } from '@helpers/item/materials';
import {
  discoveredGatherNodes,
  worldNodeGatherMaterialIds,
} from '@helpers/world-node/world-node-gathering-discovery';
import { worldNodeFarmOption } from '@helpers/world-node/world-node-status.ui';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  ExploreNodeFarmOption,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Discovered + visible GatherNodes with at least one discovered material - a node's other
// possible drops stay hidden until their own weighted roll lands
function discoveredGatherNodesWithMaterials(): WorldNodeEntry[] {
  return discoveredGatherNodes().filter((entry) =>
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

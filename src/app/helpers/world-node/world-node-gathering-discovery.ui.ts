import { isMaterialDiscovered } from '@helpers/item/materials';
import {
  discoveredGatherNodes,
  discoveredGatherNodesFor,
  worldNodeGatherMaterialIds,
} from '@helpers/world-node/world-node-gathering-discovery';
import { worldNodeFarmOption } from '@helpers/world-node/world-node-status.ui';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  ExploreNodeFarmOption,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

function discoveredMaterialIdsAt(entry: WorldNodeEntry): MaterialId[] {
  return worldNodeGatherMaterialIds(entry).filter((id) =>
    isMaterialDiscovered(id),
  ) as MaterialId[];
}

function sortedFarmOptions(entries: WorldNodeEntry[]): ExploreNodeFarmOption[] {
  return sortBy(entries.map(worldNodeFarmOption), (option) => option.nodeName);
}

// Discovered + visible GatherNodes with at least one discovered material - a node's other
// possible drops stay hidden until their own weighted roll lands
export function gatherNodeFarmOptions(): ExploreNodeFarmOption[] {
  return sortedFarmOptions(
    discoveredGatherNodes().filter(
      (entry) => discoveredMaterialIdsAt(entry).length > 0,
    ),
  );
}

export function gatherNodeMaterialIds(nodeName: string): MaterialId[] {
  const entry = worldNodeByName(nodeName);
  return entry ? discoveredMaterialIdsAt(entry) : [];
}

export function gatherableDiscoveredMaterialIds(): MaterialId[] {
  return uniq(discoveredGatherNodes().flatMap(discoveredMaterialIdsAt));
}

export function gatherNodeFarmOptionsFor(
  materialId: MaterialId,
): ExploreNodeFarmOption[] {
  return sortedFarmOptions(discoveredGatherNodesFor(materialId));
}

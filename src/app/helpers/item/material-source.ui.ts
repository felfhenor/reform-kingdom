import { recipesProducing } from '@helpers/crafting/recipes';
import { farmableExploreNodes } from '@helpers/decree/decree-farm-node';
import { farmNodeRewardOptions } from '@helpers/decree/decree-farm-node.ui';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { discoveredGatherNodesFor } from '@helpers/world-node/world-node-gathering-discovery';
import type { ItemId, WorldNodeEntry } from '@interfaces';
import { sortBy, uniqBy } from 'es-toolkit/compat';

function farmNodesFor(itemId: ItemId): WorldNodeEntry[] {
  return farmableExploreNodes().filter((entry) =>
    farmNodeRewardOptions(entry.nodeName).some(
      (option) => 'itemId' in option.reward && option.reward.itemId === itemId,
    ),
  );
}

// The nodes a worker gather assignment or a decree GatherMaterial/FarmNode clause can target; empty until found, so it never spoils.
export function materialSourceNodes(itemId: ItemId): WorldNodeEntry[] {
  if (!isMaterialDiscovered(itemId)) return [];

  const entries = [
    ...discoveredGatherNodesFor(itemId),
    ...farmNodesFor(itemId),
  ];
  return sortBy(
    uniqBy(entries, (entry) => entry.nodeName),
    (entry) => entry.nodeName,
  );
}

export function materialSourceIsCrafting(itemId: ItemId): boolean {
  if (!isMaterialDiscovered(itemId)) return false;

  return recipesProducing(itemId).length > 0;
}

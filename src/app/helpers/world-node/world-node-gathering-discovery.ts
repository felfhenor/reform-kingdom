import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  isWorldNodeVisible,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  GatherResult,
  ItemId,
  TradeskillId,
  WorldNodeEntry,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Split out of world-node-gathering.ts so its pure lookups stay free of gamestate/discovery.

function worldNodeGatherResults(entry: WorldNodeEntry): GatherResult[] {
  const gathering = worldNodeGathering(entry);
  if (!gathering) return [];

  return gatheringResultsAtLevel(gathering, worldNodeLevel(entry.nodeName));
}

export function worldNodeGatherMaterialIds(entry: WorldNodeEntry): ItemId[] {
  return uniq(
    worldNodeGatherResults(entry).flatMap((result) =>
      result.items.map((item) => item.itemId),
    ),
  );
}

export function worldNodeGatherMaterialTradeskillIds(
  entry: WorldNodeEntry,
  itemId: ItemId,
): TradeskillId[] {
  return uniq(
    worldNodeGatherResults(entry)
      .filter((result) => result.items.some((item) => item.itemId === itemId))
      .flatMap((result) => result.tradeskillIds),
  );
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

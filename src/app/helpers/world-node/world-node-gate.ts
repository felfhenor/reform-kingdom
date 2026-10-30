import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { worldNodeCollectibleGate } from '@helpers/world-node/world-nodes';
import type {
  CollectibleId,
  WorldNodeEntry,
  WorldNodeObtainedProgress,
} from '@interfaces';

export function worldNodeGateRequiredIds(
  entry: WorldNodeEntry,
): CollectibleId[] {
  return worldNodeCollectibleGate(entry)?.requiredCollectibleIds ?? [];
}

export function worldNodeGateProgress(
  entry: WorldNodeEntry,
): WorldNodeObtainedProgress {
  const requiredIds = worldNodeGateRequiredIds(entry);
  return {
    obtained: requiredIds.filter(isCollectibleDiscovered).length,
    total: requiredIds.length,
  };
}

// Non-gate nodes never block; a gate whose content is missing stays shut rather than silently opening.
export function isWorldNodeGateOpen(entry: WorldNodeEntry): boolean {
  if (entry.nodeData.type !== 'CollectibleGate') return true;

  const gate = worldNodeCollectibleGate(entry);
  return !!gate && gate.requiredCollectibleIds.every(isCollectibleDiscovered);
}

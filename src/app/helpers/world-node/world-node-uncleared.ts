import { isClearProofReward } from '@helpers/item/loot';
import {
  isRewardDiscovered,
  worldNodeCompletionRewards,
} from '@helpers/world-node/world-node-rewards';
import { isWorldNodeVisible } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

const ENCOUNTER_NODE_TYPES = new Set(['ExploreNode', 'ExploreRandomNode']);

// Materials also drop elsewhere, so a node with a guaranteed collectible/worker is judged by that alone.
function isEncounterNodeCleared(entry: WorldNodeEntry): boolean {
  const rewards = worldNodeCompletionRewards(entry);
  const proofs = rewards.filter(isClearProofReward);
  return (proofs.length > 0 ? proofs : rewards).some(isRewardDiscovered);
}

// A visible encounter node never cleared, which the map marks with sparkles.
export function isWorldNodeUncleared(entry: WorldNodeEntry): boolean {
  return (
    ENCOUNTER_NODE_TYPES.has(entry.nodeData.type) &&
    isWorldNodeVisible(entry) &&
    !isEncounterNodeCleared(entry)
  );
}

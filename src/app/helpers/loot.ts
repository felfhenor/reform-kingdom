import { rangeAtLevel } from '@helpers/leveled-range';
import { rngNumberRange } from '@helpers/rng';
import type { DroppedReward, ResolvedDrop } from '@interfaces';

// Display order for a dropped reward icon: collectibles first (rarest/most
// novel), then equipment, then recipes, then stackable items. Shared by the
// node completion reward panel and the bestiary monster drop list.
export function rewardDisplayOrder(reward: DroppedReward): number {
  if ('collectibleId' in reward) return 0;
  if ('equipmentId' in reward) return 1;
  if ('recipeId' in reward) return 2;
  return 3;
}

function resolveDrop(
  drop: DroppedReward,
  level: number,
): ResolvedDrop | undefined {
  const shouldDrop = rngNumberRange(0, 100) < drop.chance;
  if (!shouldDrop) return undefined;

  if ('equipmentId' in drop) {
    return { equipmentId: drop.equipmentId };
  }

  if ('collectibleId' in drop) {
    return { collectibleId: drop.collectibleId };
  }

  if ('recipeId' in drop) {
    return { recipeId: drop.recipeId };
  }

  const range = rangeAtLevel(drop, level);
  const quantity = rngNumberRange(range.min, range.max);
  if (quantity <= 0) return undefined;

  return { itemId: drop.itemId, quantity };
}

export function rollDroppedRewards(
  rewards: DroppedReward[],
  level: number,
): ResolvedDrop[] {
  return rewards
    .map((drop) => resolveDrop(drop, level))
    .filter((drop): drop is ResolvedDrop => !!drop);
}

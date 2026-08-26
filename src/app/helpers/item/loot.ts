import { rangeAtLevel } from '@helpers/engine/leveled-range';
import { rngNumberRange } from '@helpers/rng';
import type { DroppedReward, ResolvedDrop } from '@interfaces';

// Shared exhaustiveness helper for `switch (x.kind)` blocks over
// DroppedReward/ResolvedDrop - a missing case fails to compile here (via the
// `never` parameter type) rather than silently falling through at runtime.
export function assertNeverReward(value: never): never {
  throw new Error(`Unhandled reward kind: ${JSON.stringify(value)}`);
}

// Display order for a dropped reward icon: workers first (rarest/most
// novel), then collectibles, equipment, recipes, then stackable items.
// Shared by the node completion reward panel and the bestiary monster drop list.
export function rewardDisplayOrder(reward: DroppedReward): number {
  switch (reward.kind) {
    case 'Worker':
      return 0;
    case 'Collectible':
      return 1;
    case 'Equipment':
      return 2;
    case 'Recipe':
      return 3;
    case 'Item':
      return 4;
    default:
      return assertNeverReward(reward);
  }
}

function resolveDrop(
  drop: DroppedReward,
  level: number,
): ResolvedDrop | undefined {
  const shouldDrop = rngNumberRange(0, 100) < drop.chance;
  if (!shouldDrop) return undefined;

  switch (drop.kind) {
    case 'Equipment':
      return { equipmentId: drop.equipmentId, kind: 'Equipment' };
    case 'Collectible':
      return { collectibleId: drop.collectibleId, kind: 'Collectible' };
    case 'Recipe':
      return { recipeId: drop.recipeId, kind: 'Recipe' };
    case 'Worker':
      return { workerId: drop.workerId, kind: 'Worker' };
    case 'Item': {
      const range = rangeAtLevel(drop, level);
      const quantity = rngNumberRange(range.min, range.max);
      if (quantity <= 0) return undefined;
      return { itemId: drop.itemId, quantity, kind: 'Item' };
    }
    default:
      return assertNeverReward(drop);
  }
}

export function rollDroppedRewards(
  rewards: DroppedReward[],
  level: number,
): ResolvedDrop[] {
  return rewards
    .map((drop) => resolveDrop(drop, level))
    .filter((drop): drop is ResolvedDrop => !!drop);
}

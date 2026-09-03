import type {
  DroppedCollectibleReward,
  DroppedEquipmentReward,
  DroppedItemReward,
  DroppedRecipeReward,
  DroppedReward,
  DroppedWorkerReward,
  ItemId,
} from '@interfaces';

export function ensureDroppedReward(
  reward: Partial<DroppedItemReward> &
    Partial<DroppedEquipmentReward> &
    Partial<DroppedCollectibleReward> &
    Partial<DroppedRecipeReward> &
    Partial<DroppedWorkerReward> = {},
): DroppedReward {
  if (reward.equipmentId) {
    return {
      kind: 'Equipment',
      equipmentId: reward.equipmentId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.collectibleId) {
    return {
      kind: 'Collectible',
      collectibleId: reward.collectibleId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.recipeId) {
    return {
      kind: 'Recipe',
      recipeId: reward.recipeId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.workerId) {
    return {
      kind: 'Worker',
      workerId: reward.workerId,
      chance: reward.chance ?? 0,
    };
  }

  return {
    kind: 'Item',
    itemId: reward.itemId ?? ('UNKNOWN' as ItemId),
    min: reward.min ?? 0,
    max: reward.max ?? 0,
    bonusPerLevel: reward.bonusPerLevel,
    chance: reward.chance ?? 0,
  };
}

import { rngNumberRange } from '@helpers/rng';
import type { ItemId, MonsterContent } from '@interfaces';

export function monsterXpReward(monster: MonsterContent): number {
  return rngNumberRange(monster.xpMin, monster.xpMax + 1);
}

export function monsterDroppedItemRewards(
  monster: MonsterContent,
): Array<{ itemId: ItemId; quantity: number }> {
  return monster.droppedItems.map((drop) => ({
    itemId: drop.itemId,
    quantity: rngNumberRange(drop.min, drop.max + 1),
  }));
}

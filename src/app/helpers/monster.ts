import { rngNumberRange } from '@helpers/rng';
import type { ItemId, MonsterContent } from '@interfaces';

export function monsterXpReward(
  monster: MonsterContent,
  level: number,
): number {
  const levelBonus = monster.xp.multiplierPerLevel * (level - 1);
  return rngNumberRange(
    monster.xp.min + levelBonus,
    monster.xp.max + levelBonus + 1,
  );
}

export function monsterDroppedItemRewards(
  monster: MonsterContent,
  level: number,
): Array<{ itemId: ItemId; quantity: number }> {
  return monster.droppedItems
    .map((drop) => {
      const shouldDrop = rngNumberRange(0, 100) < drop.chance;
      if (!shouldDrop) return { itemId: drop.itemId, quantity: 0 };

      const levelBonus = drop.multiplierPerLevel * (level - 1);
      return {
        itemId: drop.itemId,
        quantity: rngNumberRange(
          drop.min + levelBonus,
          drop.max + levelBonus + 1,
        ),
      };
    })
    .filter((drop) => drop.quantity > 0);
}

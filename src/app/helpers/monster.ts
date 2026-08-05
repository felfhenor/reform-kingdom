import { rngNumberRange } from '@helpers/rng';
import type { MonsterContent } from '@interfaces';

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

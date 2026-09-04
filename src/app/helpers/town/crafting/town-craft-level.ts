import { tradeskillXpForLevel } from '@helpers/crafting/tradeskill';
import type { TownTradeskillState } from '@interfaces';

// Mirrors the player's tradeskillLeveledUp, but capped at the town's own authored maxLevel, not TRADESKILL_MAX_LEVEL.
export function townTradeskillLeveledUp(
  building: TownTradeskillState,
  amount: number,
  maxLevel: number,
): TownTradeskillState {
  let level = building.level;
  let current = building.xp.current + amount;
  let maximum = building.xp.maximum;

  while (level < maxLevel && current >= maximum) {
    current -= maximum;
    level += 1;
    maximum = tradeskillXpForLevel(level);
  }

  if (current > maximum) current = maximum;

  return { ...building, level, xp: { current, maximum } };
}

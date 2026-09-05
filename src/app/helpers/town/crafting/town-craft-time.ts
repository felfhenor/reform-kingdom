import { TRADESKILL_MAX_LEVEL } from '@helpers/crafting/tradeskill';
import { clamp } from 'es-toolkit/compat';
import type { RecipeContent, TownContent } from '@interfaces';

// Shared with town-craft-display.ts so the queue's remaining-time display stays in sync with actual tick processing.
export const RAID_LOSS_CRAFT_DEBUFF_MULTIPLIER = 2;

// Flat -1%/level (e.g. level 25 crafts 25% faster), floored at 1 tick so a maxed-out level never instant-completes.
export function townCraftTimeFor(
  recipe: RecipeContent,
  town: TownContent,
  level: number,
  debuffMultiplier = 1,
): number {
  const effectiveLevel = clamp(level, 1, TRADESKILL_MAX_LEVEL);
  const baseTime =
    recipe.craftTime *
    town.crafting.craftingDurationMultiplier *
    debuffMultiplier;

  return Math.max(1, Math.round(baseTime * (1 - effectiveLevel / 100)));
}

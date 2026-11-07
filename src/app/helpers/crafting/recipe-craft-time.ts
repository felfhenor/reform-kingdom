import { globalEffectSumsState } from '@helpers/state-game';
import type { RecipeContent } from '@interfaces';

export function recipeCraftTime(recipe: RecipeContent): number {
  const multiplier = 1 + globalEffectSumsState().craftTimeMultiplierBonus;
  return Math.max(1, Math.round(recipe.craftTime * Math.max(0, multiplier)));
}
